-- แก้ตามผลรีวิวโค้ด 18 ก.ย. 2026 — ต่อจาก 2026-09-18-app-feedback.sql
-- ทั้งสามข้อเป็นเรื่องความสอดคล้องกับของเดิมในโปรเจกต์ ไม่ใช่ฟีเจอร์ใหม่
-- ไฟล์นี้ตั้งใจให้รันซ้ำได้ และรันตอนไหนก็ได้หลังไฟล์แรก (ระหว่างนี้ของเดิมยังทำงานปกติ)

begin;

-- ① trigger function ต้อง pin search_path + ถอนสิทธิ์เรียก ให้เหมือนทุกฟังก์ชันในโปรเจกต์นี้
--    ทุกฟังก์ชันใน schema.sql และทุก migration ก่อนหน้าทำครบ ยกเว้นตัวนี้ตัวเดียว
--    ⇒ Supabase security advisor จะฟ้อง function_search_path_mutable และเปิดประเด็นที่ audit 5 ส.ค. ปิดไปแล้ว
--
-- ② เพดานรายวันต้องนับตาม "วันเรียน" ของแอพ (เวลาไทยลบ 5 ชั่วโมง) ไม่ใช่เที่ยงคืน UTC
--    เที่ยงคืน UTC = 7 โมงเช้าไทย ⇒ ส่ง 06:30 กับ 07:30 จะถูกคิดคนละวัน ส่วน 08:00 กับ 23:00 อยู่วันเดียวกัน
--    ไม่ตรงกับ exam_plans / xp_awards / streak ที่ใช้เส้นแบ่งเดียวกันหมด
--    และทำให้ข้อความ "พรุ่งนี้ส่งใหม่ได้อีก" ในแอพผิด (จริง ๆ เคลียร์ตอนตี 5)
create or replace function public.app_feedback_daily_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_learning_date date := (timezone('Asia/Bangkok', now()) - interval '5 hours')::date;
  v_count integer;
begin
  select count(*) into v_count
    from public.app_feedback
   where user_id = new.user_id
     and (timezone('Asia/Bangkok', created_at) - interval '5 hours')::date = v_learning_date;

  if v_count >= 5 then
    raise exception 'FEEDBACK_DAILY_CAP' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.app_feedback_daily_cap() from public, anon, authenticated;

-- index เดิม (user_id, created_at desc) ยังใช้ได้กับ query นี้ เพราะกรองด้วย user_id ก่อน
-- แล้วค่อยคัด created_at ทีละแถวของคนคนเดียว ซึ่งมีไม่เกิน 5 แถวต่อวันอยู่แล้ว

-- ③ /stats ต้องบอก "จำนวนคน" ไม่ใช่ "จำนวนครั้ง"
--    คนเดียวส่งได้ 5 ครั้ง/วัน ไม่จำกัดจำนวนวัน ⇒ นับครั้งแล้วคนเดียวปั่นเลขบนหน้าสาธารณะได้
--    และคะแนนเฉลี่ยต้องถ่วงให้ทุกคนมีน้ำหนักเท่ากัน (เฉลี่ยของค่าเฉลี่ยรายคน)
--    ไม่งั้นคนที่ส่ง 10 ครั้งมีเสียงดังกว่าคนที่ส่งครั้งเดียว 10 เท่า
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
  (select count(distinct user_id) from public.app_feedback) as feedback_total,
  (select coalesce(round(avg(per_user_avg), 1), 0)
     from (
       select avg(rating)::numeric as per_user_avg
       from public.app_feedback
       group by user_id
     ) t) as feedback_avg_rating;

grant select on public.public_stats to anon, authenticated;

commit;
