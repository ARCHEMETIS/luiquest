-- ระบบรับ feedback ในแอพ (อาจารย์สั่งเพิ่ม 18 ก.ย. 2026)
-- เขียนตรงจาก browser ผ่าน RLS — ไม่ต้องมี Netlify Function ไม่กินเครดิต
-- ⚠️ ต้องรัน **หลัง** 2026-08-09-exam-plans.sql เพราะ view public_stats ท้ายไฟล์นี้
--    อ้าง xp_awards.award_kind ที่ไฟล์นั้นเป็นคนเพิ่ม
-- ไฟล์นี้ตั้งใจให้รันซ้ำได้

begin;

create table if not exists public.app_feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  rating     smallint not null,
  category   text not null default 'other',
  message    text,
  created_at timestamptz not null default now(),

  constraint app_feedback_rating_check
    check (rating between 1 and 5),
  constraint app_feedback_category_check
    check (category in ('bug', 'idea', 'content', 'ui', 'other')),
  -- ข้อความว่าง ๆ ไม่ต้องเก็บ (ให้เป็น null ไปเลย) ส่วนยาวเกิน 1000 กันคนวางนิยายใส่
  constraint app_feedback_message_check
    check (message is null or char_length(btrim(message)) between 1 and 1000)
);

create index if not exists idx_app_feedback_created
  on public.app_feedback(created_at desc);
create index if not exists idx_app_feedback_user_created
  on public.app_feedback(user_id, created_at desc);

-- เพดาน 5 ครั้ง/คน/วัน — กันกดรัวจนตัวเลขบนสไลด์เพี้ยน
-- เจตนาใช้ security invoker (ค่า default): RLS ทำให้ count เห็นเฉพาะแถวของคนที่กำลังส่ง
-- ซึ่งเป็นสิ่งที่ต้องการพอดี และไม่ต้องเปิดสิทธิ์ definer ให้ใครเรียกมั่ว
create or replace function public.app_feedback_daily_cap()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.app_feedback
   where user_id = new.user_id
     and created_at >= date_trunc('day', now());

  if v_count >= 5 then
    raise exception 'FEEDBACK_DAILY_CAP' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists app_feedback_daily_cap_trigger on public.app_feedback;
create trigger app_feedback_daily_cap_trigger
  before insert on public.app_feedback
  for each row execute function public.app_feedback_daily_cap();

alter table public.app_feedback enable row level security;

-- ส่งได้เฉพาะในนามตัวเอง
drop policy if exists "app_feedback_insert_own" on public.app_feedback;
create policy "app_feedback_insert_own"
  on public.app_feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- เห็นเฉพาะของตัวเอง — ความเห็นคนอื่นเป็นเรื่องส่วนตัว เจ้าของแอพอ่านรวมผ่าน service role
drop policy if exists "app_feedback_select_own" on public.app_feedback;
create policy "app_feedback_select_own"
  on public.app_feedback for select to authenticated
  using ((select auth.uid()) = user_id);

-- จงใจไม่มี policy update/delete: ส่งแล้วแก้ไม่ได้ ลบไม่ได้ (ข้อมูลวิจัยต้องนิ่ง)
revoke all on table public.app_feedback from public, anon, authenticated;
grant select, insert on table public.app_feedback to authenticated;

-- ── /stats: เพิ่มตัวเลข feedback แบบรวม ────────────────────────────────────
-- โชว์ได้เฉพาะ "จำนวน" กับ "คะแนนเฉลี่ย" — ห้ามมีข้อความหรือตัวตนคนเขียนหลุดออกมา
-- (สเปก §6 ล็อกไว้ว่าหน้า /stats สาธารณะห้ามมี PII)
create or replace view public.public_stats as
select
  (select count(*) from public.profiles) as registered_total,
  (select count(distinct user_id) from public.xp_awards) as activated_total,
  (select count(*) from public.xp_awards where award_kind = 'quest') as quests_completed_total,
  (select coalesce(max(longest_streak), 0) from public.profiles) as max_streak,
  (select coalesce(round(avg(current_streak), 1), 0) from public.profiles
     where current_streak > 0) as avg_active_streak,
  (select count(distinct user_id) from public.activity_log
     where created_at >= date_trunc('day', now())) as dau_today,
  (select count(*) from public.app_feedback) as feedback_total,
  (select coalesce(round(avg(rating), 1), 0) from public.app_feedback) as feedback_avg_rating;

grant select on public.public_stats to anon, authenticated;

commit;
