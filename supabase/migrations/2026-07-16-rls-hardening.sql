-- ============================================================
--  Migration 2026-07-16: RLS hardening + atomic complete_quest
--  แก้ตาม .scratch/scrutinize-findings-2026-07-15.md
--    Blocker 1 — daily_quests/phases FOR ALL → client ตั้ง xp_reward เองได้
--    Blocker 2 — checklist FOR ALL → client ลบ checklist ข้าม gating ได้
--    Major 3   — client insert quest_completions/activity_log ตรงได้ (metric ปลอม)
--    Nit       — roadmaps FOR ALL → client insert ข้าม free cap 3 หัวข้อได้
--    Major 4   — race lost-update ใน complete-quest.js → RPC atomic
--  รันทั้งไฟล์ใน Supabase SQL Editor (project luiquest) — idempotent รันซ้ำได้
--  ต้อง deploy โค้ด complete-quest.js เวอร์ชันที่เรียก RPC "ทันทีหลัง" รัน migration นี้
--  (โค้ดเก่ายังทำงานได้ระหว่างรอ deploy — ใช้ service role ที่ bypass RLS อยู่แล้ว)
-- ============================================================

begin;

-- ---------- Blocker 1 + 2 + Nit: จำกัด policy เหลือ SELECT อย่างเดียว ----------
-- write จริงทั้งหมด (generate roadmap/phase/quest/checklist, สลับ active, ลบ) ทำผ่าน
-- service role ใน Netlify Functions ซึ่ง bypass RLS — client (anon key) ต้องอ่านได้อย่างเดียว
-- ยืนยันแล้ว (grep src/ 2026-07-16): client แตะแค่ topics select + chat_messages select

drop policy if exists "roadmaps_all_own" on public.roadmaps;
drop policy if exists "roadmaps_select_own" on public.roadmaps;
create policy "roadmaps_select_own" on public.roadmaps
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "phases_all_own" on public.phases;
drop policy if exists "phases_select_own" on public.phases;
create policy "phases_select_own" on public.phases
  for select to authenticated
  using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()));

drop policy if exists "daily_quests_all_own" on public.daily_quests;
drop policy if exists "daily_quests_select_own" on public.daily_quests;
create policy "daily_quests_select_own" on public.daily_quests
  for select to authenticated
  using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()));

drop policy if exists "checklist_all_own" on public.quest_checklist_items;
drop policy if exists "checklist_select_own" on public.quest_checklist_items;
create policy "checklist_select_own" on public.quest_checklist_items
  for select to authenticated
  using (exists (
    select 1 from public.daily_quests q
    join public.roadmaps r on r.id = q.roadmap_id
    where q.id = quest_id and r.user_id = auth.uid()));

-- ---------- Major 3: ปิด client insert ตรงเข้า quest_completions / activity_log ----------
-- insert จริงทำผ่าน service role (complete-quest / activity functions) เท่านั้น
drop policy if exists "completions_insert_own" on public.quest_completions;
drop policy if exists "activity_insert_own" on public.activity_log;

-- ---------- Major 4: RPC complete_quest — atomic insert completion + XP/streak/grade ----------
-- แนวเดียวกับ redeem_referral: security definer + revoke execute จาก client
-- gating checklist + ownership เช็คฝั่ง complete-quest.js ก่อนเรียก
-- p_grade_bands: GRADE_BANDS จาก src/lib/gradeBands.js (single source of truth ฝั่ง JS)
create or replace function public.complete_quest(
  p_user_id       uuid,
  p_quest_id      uuid,
  p_roadmap_id    uuid,
  p_xp            integer,
  p_checked_items jsonb,
  p_today         date,      -- "วันนี้" ตามเวลาไทย คำนวณฝั่ง JS (bangkokDateStr)
  p_grade_bands   jsonb,     -- [{grade,min}, ...] เรียงจาก min น้อย→มาก
  p_metadata      jsonb      -- payload ของ activity_log event quest_complete
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile     record;
  v_existing_xp integer;
  v_new_streak  integer;
  v_new_longest integer;
  v_new_total   integer;
  v_grade       text;
begin
  -- idempotent: unique (user_id, quest_id) — double-submit/race แทรกซ้ำจะ conflict แล้วข้าม
  insert into public.quest_completions (user_id, quest_id, roadmap_id, xp_earned, checked_items)
  values (p_user_id, p_quest_id, p_roadmap_id, p_xp, p_checked_items)
  on conflict (user_id, quest_id) do nothing;

  if not found then
    -- ทำเควสนี้ไปแล้ว (แทน handler 23505 เดิมใน complete-quest.js) — คืนค่าปัจจุบัน ไม่แจก XP ซ้ำ
    select xp_earned into v_existing_xp
    from public.quest_completions
    where user_id = p_user_id and quest_id = p_quest_id;

    select total_xp, current_streak, longest_streak, grade
    into v_profile
    from public.profiles where id = p_user_id;

    return jsonb_build_object(
      'already_completed', true,
      'xp_earned', coalesce(v_existing_xp, p_xp),
      'total_xp', v_profile.total_xp,
      'current_streak', v_profile.current_streak,
      'longest_streak', v_profile.longest_streak,
      'grade', v_profile.grade
    );
  end if;

  -- lock แถว profile: ธุรกรรมอื่นที่แตะ total_xp (เควสขนาน/redeem_referral) ต้องรอคิว → ไม่มี lost update
  select total_xp, current_streak, longest_streak, last_quest_date
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  -- streak logic เดียวกับ _shared/gameplay.js nextStreak (วันเดิม=คงเดิม, เมื่อวาน=+1, อื่น ๆ/null=เริ่ม 1)
  v_new_streak := case
    when v_profile.last_quest_date = p_today then v_profile.current_streak
    when v_profile.last_quest_date = p_today - 1 then v_profile.current_streak + 1
    else 1
  end;
  v_new_longest := greatest(v_profile.longest_streak, v_new_streak);

  -- grade = band ที่ min สูงสุดซึ่ง streak ใหม่ถึง (ตรรกะเดียวกับ computeGrade)
  select b->>'grade' into v_grade
  from jsonb_array_elements(p_grade_bands) b
  where (b->>'min')::integer <= v_new_streak
  order by (b->>'min')::integer desc
  limit 1;

  update public.profiles
  set total_xp        = total_xp + p_xp,
      current_streak  = v_new_streak,
      longest_streak  = v_new_longest,
      last_quest_date = p_today,
      last_active_at  = now(),
      grade           = coalesce(v_grade, grade)
  where id = p_user_id
  returning total_xp into v_new_total;

  insert into public.activity_log (user_id, event_type, metadata)
  values (p_user_id, 'quest_complete', p_metadata);

  return jsonb_build_object(
    'already_completed', false,
    'xp_earned', p_xp,
    'total_xp', v_new_total,
    'current_streak', v_new_streak,
    'longest_streak', v_new_longest,
    'grade', coalesce(v_grade, 'F')
  );
end;
$$;

-- ปิด EXECUTE จาก client เหมือน redeem_referral — Postgres แจก EXECUTE ให้ PUBLIC อัตโนมัติ
-- ถ้าไม่ revoke anon/authenticated ยิง PostgREST /rpc/complete_quest ตรง ๆ ข้าม gating ได้
revoke execute on function public.complete_quest(uuid, uuid, uuid, integer, jsonb, date, jsonb, jsonb) from public, anon, authenticated;

commit;

-- ---------- ตรวจหลังรัน (optional) ----------
-- select tablename, policyname, cmd from pg_policies
--  where tablename in ('roadmaps','phases','daily_quests','quest_checklist_items','quest_completions','activity_log')
--  order by tablename, policyname;
-- คาดหวัง: ตาราง 4 ตัวแรกเหลือ policy คำสั่ง SELECT อย่างเดียว,
--          quest_completions เหลือ completions_select_own, activity_log เหลือ activity_select_own_or_admin
