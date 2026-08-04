-- ตรวจ payment + ต่ออายุสิทธิ์ + บันทึก activity ใน transaction เดียว
-- security definer จำเป็นเพราะ endpoint ใช้ service role แต่ห้ามเปิด RPC ให้ client ยิงเอง
create or replace function public.verify_payment(p_payment_id uuid, p_admin_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment       public.payments%rowtype;
  v_premium_until timestamptz;
begin
  if not exists (
    select 1 from public.profiles where id = p_admin_id and is_admin = true
  ) then
    raise exception using errcode = '42501', message = 'admin_required';
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

  update public.profiles
  set is_premium = true,
      premium_until = greatest(now(), coalesce(premium_until, now())) + interval '1 month'
  where id = v_payment.user_id
  returning premium_until into v_premium_until;

  if not found then
    raise exception using errcode = 'P0003', message = 'payment_owner_not_found';
  end if;

  update public.payments
  set status = 'verified',
      verified_at = now(),
      verified_by = p_admin_id
  where id = v_payment.id;

  insert into public.activity_log (user_id, event_type, metadata)
  values (
    v_payment.user_id,
    'premium_submit',
    jsonb_build_object(
      'payment_id', v_payment.id,
      'ref_code', v_payment.ref_code,
      'amount', v_payment.amount,
      'action', 'verify',
      'verified_by', p_admin_id
    )
  );

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'ref_code', v_payment.ref_code,
    'status', 'verified',
    'premium_until', v_premium_until,
    'verified_by', p_admin_id
  );
end;
$$;

revoke execute on function public.verify_payment(uuid, uuid) from public, anon, authenticated;

-- Aggregate ใน SQL เพื่อให้ admin endpoint ไม่ต้องดึง payment history ทั้งหมดมารวมเอง
create or replace view public.payment_admin_stats as
with monthly as (
  select
    to_char(date_trunc('month', verified_at), 'YYYY-MM') as month,
    sum(amount)::integer as amount
  from public.payments
  where status = 'verified' and verified_at is not null
  group by date_trunc('month', verified_at)
  order by date_trunc('month', verified_at)
)
select
  coalesce((select sum(amount)::integer from public.payments where status = 'verified'), 0)::integer as revenue_total,
  coalesce((select jsonb_agg(jsonb_build_object('month', month, 'amount', amount) order by month) from monthly), '[]'::jsonb) as revenue_by_month,
  (select count(distinct user_id)::integer from public.payments where status = 'verified') as payers_total,
  (select count(*)::integer from public.payments where status = 'pending') as pending_count,
  (select count(*)::integer from public.payments where status = 'submitted') as submitted_count;

revoke all on public.payment_admin_stats from public, anon, authenticated;
grant select on public.payment_admin_stats to service_role;
