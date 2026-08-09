-- Migration 9 ส.ค. 2026 — ตรวจสลิปอัตโนมัติแบบ fail closed และเก็บหลักฐานตรวจสอบย้อนหลัง
-- เขียนให้รันซ้ำได้ และไม่มีคำสั่งลบ/แก้ข้อมูล payment เดิม

begin;

-- เก็บผลทุกครั้งแม้ไม่ผ่าน เพื่อให้ admin ยังตรวจสลิปจริงต่อได้โดยหลักฐานไม่หาย
alter table public.payments
  add column if not exists slip_trans_ref text,
  add column if not exists slip_verification_status text,
  add column if not exists slip_verification_checked_at timestamptz,
  add column if not exists slip_verification_raw jsonb,
  add column if not exists slip_verified_amount numeric(12, 2),
  add column if not exists slip_receiver_account text,
  add column if not exists approved_automatically boolean not null default false,
  add column if not exists auto_verified_at timestamptz;

comment on column public.payments.slip_trans_ref is
  'เลขอ้างอิงธุรกรรมจากผู้ตรวจสลิป — ต้องใช้ได้กับ payment เดียวทั่วระบบ';
comment on column public.payments.slip_verification_status is
  'ผลตรวจอัตโนมัติล่าสุด; ไม่เปลี่ยน status หลักเป็น rejected เพราะยังต้องเปิดทางให้ admin ตรวจเอง';
comment on column public.payments.approved_automatically is
  'true เมื่อระบบอนุมัติจาก SlipOK; false คือยังไม่อนุมัติหรืออนุมัติโดยมนุษย์';
comment on column public.payments.auto_verified_at is
  'เวลาที่ระบบอนุมัติอัตโนมัติ แยกจาก verified_at ซึ่งใช้ร่วมกับการอนุมัติโดย admin';

-- partial index ยอมให้แถวที่ API ไม่มี transRef เป็น null ได้ แต่ transRef จริงห้ามซ้ำข้ามบัญชีเด็ดขาด
create unique index if not exists uniq_payment_slip_trans_ref
  on public.payments(slip_trans_ref)
  where slip_trans_ref is not null;

-- ไม่มี FK ใหม่: transRef/ผล SlipOK ไม่มีตารางแม่ และไม่สร้าง user ปลอมเป็น "ระบบ"
-- เพราะการลบ/cascade หรือ set null จะทำหลักฐานการอนุมัติเงินหาย; verified_by จึงสงวนไว้ให้ admin มนุษย์เดิม
create or replace function public.auto_verify_payment(
  p_payment_id uuid,
  p_trans_ref text,
  p_api_genuine boolean,
  p_verified_amount numeric,
  p_receiver_account text,
  p_expected_receiver_account text,
  p_verification_raw jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment       public.payments%rowtype;
  v_premium_until timestamptz;
  v_trans_ref     text;
  v_verified_at   timestamptz := now();
begin
  v_trans_ref := upper(regexp_replace(coalesce(p_trans_ref, ''), '\s', '', 'g'));
  if p_api_genuine is distinct from true then
    raise exception using errcode = 'P0004', message = 'slip_not_genuine';
  end if;
  if v_trans_ref = '' then
    raise exception using errcode = 'P0004', message = 'transaction_reference_required';
  end if;
  if nullif(btrim(coalesce(p_receiver_account, '')), '') is null
     or p_receiver_account is distinct from p_expected_receiver_account then
    raise exception using errcode = 'P0004', message = 'receiver_mismatch';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment_not_found';
  end if;
  if v_payment.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'payment_not_submitted';
  end if;
  -- เช็คยอดซ้ำใน transaction จาก amount บน payment เพื่อกัน code ฝั่ง function ส่งค่าคาดหวังผิด
  if p_verified_amount is null
     or round(p_verified_amount * 100) <> (v_payment.amount::numeric * 100) then
    raise exception using errcode = 'P0004', message = 'amount_mismatch';
  end if;

  -- unique index claim เลขอ้างอิงตรงนี้; ถ้าชน transaction ทั้งก้อน rollback จึงไม่มีการให้ Premium ครึ่งทาง
  update public.payments
  set slip_trans_ref = v_trans_ref,
      slip_verification_status = 'approved',
      slip_verification_checked_at = v_verified_at,
      slip_verification_raw = p_verification_raw,
      slip_verified_amount = p_verified_amount,
      slip_receiver_account = p_receiver_account,
      approved_automatically = true,
      auto_verified_at = v_verified_at,
      status = 'verified',
      verified_at = v_verified_at,
      verified_by = null
  where id = v_payment.id;

  update public.profiles
  set is_premium = true,
      premium_until = greatest(now(), coalesce(premium_until, now())) + interval '1 month'
  where id = v_payment.user_id
  returning premium_until into v_premium_until;

  if not found then
    raise exception using errcode = 'P0003', message = 'payment_owner_not_found';
  end if;

  insert into public.activity_log (user_id, event_type, metadata)
  values (
    v_payment.user_id,
    'premium_submit',
    jsonb_build_object(
      'payment_id', v_payment.id,
      'ref_code', v_payment.ref_code,
      'amount', v_payment.amount,
      'action', 'auto_verify',
      'slip_trans_ref', v_trans_ref,
      'approved_automatically', true
    )
  );

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'ref_code', v_payment.ref_code,
    'status', 'verified',
    'premium_until', v_premium_until,
    'verified_by', null,
    'approved_automatically', true,
    'auto_verified_at', v_verified_at
  );
end;
$$;

-- RPC เดิม verify_payment ยังบังคับ admin เหมือนเดิม; RPC ใหม่นี้เปิดเฉพาะ service role ของ function
revoke execute on function public.auto_verify_payment(uuid, text, boolean, numeric, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.auto_verify_payment(uuid, text, boolean, numeric, text, text, jsonb)
  to service_role;

commit;
