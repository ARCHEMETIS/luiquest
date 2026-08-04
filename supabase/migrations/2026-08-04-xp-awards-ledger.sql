-- 2026-08-04 — ปิดช่องปั๊ม XP ถาวรด้วย ledger ที่ไม่ผูกกับ roadmap
--
-- ปัญหาที่แก้ (P0, ยืนยันจากโค้ดจริง):
--   `quest_completions.roadmap_id` เป็น on delete cascade → กด "ลบหัวข้อ" ทีเดียว
--   แถว completion หายหมด แต่ `profiles.total_xp` ไม่ถูกหักคืน และ complete_quest มี guard
--   แค่ unique(user_id, quest_id) ซึ่งหายไปพร้อมกัน → สร้างหัวข้อเดิมใหม่ = quest_id ใหม่ =
--   ทำซ้ำได้ XP อีก วนไม่จำกัด กดผ่านหน้าเว็บปกติ ไม่ต้อง hack (leaderboard = metric ที่วิชาวัด)
--
-- ทำไมต้องเป็นตารางใหม่ ไม่ใช่แค่ guard รายวันในโค้ดเดิม:
--   guard ที่ key ด้วย roadmap_id/quest_id ใช้ไม่ได้ เพราะ id เกิดใหม่ทุกครั้งที่สร้างหัวข้อ
--   ต้อง key ด้วยของที่ "อยู่รอด" = ตัวหัวข้อเอง (slug ของ curated / ชื่อที่ normalize ของ freeform)
--   และตารางนี้ต้อง **ไม่มี FK ไป roadmaps/daily_quests** ไม่งั้นก็โดน cascade ตามไปอีก
--
-- ได้แถมมาอีก 3 อย่าง:
--   1. เพดาน "1 เควส/วัน/หัวข้อ" จริง → เก็บ 3 หัวข้อ = ทำได้ 3 เควส/วัน (เจ้าของอยากได้แบบนี้)
--   2. ปิดช่อง cron: pre-generate สร้างเควสวันถัดไปตอนตี 2 แล้วเคลมซ้ำได้ก่อนรีเซ็ตตี 5
--   3. metric ใน /stats เลิกหดย้อนหลังตอนมีคนลบหัวข้อ (นับจาก ledger แทน quest_completions)
--
-- รันซ้ำได้ (idempotent) — ปลอดภัยกับ DB ที่มีข้อมูลอยู่แล้ว

create table if not exists public.xp_awards (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,

  -- ★ กุญแจที่อยู่รอดแม้ลบ roadmap:
  --   curated  = 'topic:<topics.slug>'         (slug คงที่ตลอด ไม่ผูกกับ roadmap ของใคร)
  --   freeform = 'free:<ชื่อหัวข้อ normalize>'  (roadmaps.topic_id เป็น null สำหรับ freeform)
  topic_key   text not null,

  award_date  date not null,              -- วันตามเวลาไทย (คำนวณฝั่ง JS เหมือน p_today เดิม)
  xp          integer not null,

  -- อ้างอิงเพื่อ audit เท่านั้น — **จงใจไม่ใส่ FK** ถ้าใส่แล้วจะโดน cascade ตอนลบ roadmap
  -- ซึ่งคือบั๊กที่ตารางนี้ตั้งใจแก้ตั้งแต่แรก
  roadmap_id  uuid,
  quest_id    uuid,

  created_at  timestamptz not null default now()
);

create index if not exists idx_xp_awards_user_date on public.xp_awards(user_id, award_date);
create index if not exists idx_xp_awards_lookup    on public.xp_awards(user_id, topic_key, award_date);
create index if not exists idx_xp_awards_created   on public.xp_awards(created_at);  -- กราฟโตในหน้า /stats

-- RLS: อ่านของตัวเองได้ (เผื่อ frontend อยากโชว์ประวัติ) — เขียนผ่าน service role (RPC) เท่านั้น
alter table public.xp_awards enable row level security;

drop policy if exists "xp_awards_select_own" on public.xp_awards;
create policy "xp_awards_select_own" on public.xp_awards
  for select to authenticated using (auth.uid() = user_id);
-- ไม่มี insert/update/delete policy โดยตั้งใจ — ถ้า client เขียนเองได้ ก็ปั๊ม XP ได้อีกทาง

-- ───────────────────────────────────────────────────────────────────────────
-- backfill: ย้ายประวัติที่มีอยู่เข้ามา เพื่อไม่ให้คนที่ทำเควสไปแล้ววันนี้ได้ XP ซ้ำทันทีที่ deploy
-- (เอาเท่าที่ยังมีหลักฐานเหลืออยู่ — แถวที่ถูก cascade ลบไปแล้วกู้คืนไม่ได้ ยอมรับตามจริง)
-- ───────────────────────────────────────────────────────────────────────────
insert into public.xp_awards (user_id, topic_key, award_date, xp, roadmap_id, quest_id, created_at)
select
  qc.user_id,
  case
    when t.slug is not null then 'topic:' || t.slug
    else 'free:' || lower(trim(regexp_replace(coalesce(r.topic_title, 'unknown'), '\s+', ' ', 'g')))
  end as topic_key,
  -- completed_at เป็น timestamptz — แปลงเป็น "วันไทย" ให้ตรงกับ p_today ที่ JS ส่งมา
  (qc.completed_at at time zone 'Asia/Bangkok')::date as award_date,
  qc.xp_earned,
  qc.roadmap_id,
  qc.quest_id,
  qc.completed_at
from public.quest_completions qc
left join public.roadmaps r on r.id = qc.roadmap_id
left join public.topics   t on t.id = r.topic_id
-- ถ้ามีหลายเควสของหัวข้อเดียวกันในวันเดียว (ข้อมูลเก่าก่อนมี guard) เก็บอันแรกพอ
on conflict do nothing;

-- กันซ้ำระดับ DB สำหรับ "ผู้ใช้ฟรี 1 ครั้ง/วัน/หัวข้อ" ทำที่ระดับ RPC แทน unique constraint
-- เพราะ premium ต้องทำได้มากกว่า 1 ครั้ง/วัน (จุดขายที่เจ้าของเลือก) — unique จะบล็อกทันที
-- RPC ล็อกแถว profiles ด้วย `for update` อยู่แล้ว การนับใต้ล็อกนั้นกัน race ได้จริง
-- แต่ยังกัน "เควสเดียวกันเคลมซ้ำ" ไว้อีกชั้น (quest_id ยังคงเดิมตราบใดที่ไม่ลบ roadmap)
create unique index if not exists uniq_xp_award_per_quest
  on public.xp_awards(user_id, quest_id)
  where quest_id is not null;

-- ───────────────────────────────────────────────────────────────────────────
-- complete_quest เวอร์ชันใหม่: บังคับเพดานรายวันจาก ledger ก่อนแจก XP
--
-- เปลี่ยนจากเดิม 3 จุด (นอกนั้นคงตรรกะเดิมทุกบรรทัด):
--   1. ล็อกแถว profiles **ก่อน** ทุกอย่าง — เดิมล็อกทีหลัง ทำให้การนับโควตาแข่งกันได้
--   2. เช็คจำนวนครั้งที่ได้ XP ของ (user, หัวข้อ, วันนี้) จาก xp_awards ที่ไม่โดน cascade
--   3. จด xp_awards ทุกครั้งที่แจก XP จริง
--
-- ทำไมใช้ "นับใต้ล็อก" แทน unique constraint: premium ต้องทำได้ >1 ครั้ง/วัน (จุดขายที่เจ้าของ
-- เลือก) ซึ่ง unique(user,topic,date) จะบล็อกตั้งแต่ครั้งที่ 2 — แถว profiles ถูกล็อกด้วย
-- `for update` ตลอด transaction อยู่แล้ว การนับใต้ล็อกจึงกัน race ได้จริงเท่ากัน
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.complete_quest(
  p_user_id           uuid,
  p_quest_id          uuid,
  p_roadmap_id        uuid,
  p_xp                integer,
  p_checked_items     jsonb,
  p_today             date,      -- "วันนี้" ตามเวลาไทย คำนวณฝั่ง JS (bangkokDateStr)
  p_grade_bands       jsonb,     -- [{grade,min}, ...] เรียงจาก min น้อย→มาก
  p_metadata          jsonb,     -- payload ของ activity_log event quest_complete
  p_topic_key         text,      -- 'topic:<slug>' | 'free:<ชื่อ normalize>' — อยู่รอดแม้ลบ roadmap
  p_free_allowance    integer default 1,   -- ฟรี: 1 เควสที่ได้ XP ต่อวัน ต่อหัวข้อ
  p_premium_allowance integer default 3    -- premium: จุดขาย "ทำเควสได้มากกว่า 1 ต่อวัน"
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile      record;
  v_existing_xp  integer;
  v_new_streak   integer;
  v_new_longest  integer;
  v_new_total    integer;
  v_grade        text;
  v_awards_today integer;
  v_allowance    integer;
begin
  -- ★ ล็อกแถว profile เป็นอย่างแรก: ทั้งการนับโควตารายวันและการบวก total_xp ต้องอยู่ใต้ล็อกเดียวกัน
  -- ไม่งั้นสองคำขอพร้อมกันจะนับเห็น 0 ทั้งคู่แล้วแจก XP ซ้ำ (เคสเดียวกับที่ chat.js เป็นอยู่)
  select total_xp, current_streak, longest_streak, last_quest_date, is_premium
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'ไม่พบโปรไฟล์ผู้ใช้ %', p_user_id;
  end if;

  -- idempotent: unique (user_id, quest_id) — double-submit/race แทรกซ้ำจะ conflict แล้วข้าม
  insert into public.quest_completions (user_id, quest_id, roadmap_id, xp_earned, checked_items)
  values (p_user_id, p_quest_id, p_roadmap_id, p_xp, p_checked_items)
  on conflict (user_id, quest_id) do nothing;

  if not found then
    -- ทำเควสนี้ไปแล้ว — คืนค่าปัจจุบัน ไม่แจก XP ซ้ำ
    select xp_earned into v_existing_xp
    from public.quest_completions
    where user_id = p_user_id and quest_id = p_quest_id;

    return jsonb_build_object(
      'already_completed', true,
      'daily_limit_reached', false,
      'xp_earned', coalesce(v_existing_xp, p_xp),
      'total_xp', v_profile.total_xp,
      'current_streak', v_profile.current_streak,
      'longest_streak', v_profile.longest_streak,
      'grade', (select grade from public.profiles where id = p_user_id)
    );
  end if;

  -- ★ เพดานรายวันจาก ledger ที่ไม่ผูกกับ roadmap → ลบหัวข้อแล้วสร้างใหม่ก็ยังชนเพดานเดิม
  v_allowance := case when v_profile.is_premium then p_premium_allowance else p_free_allowance end;

  select count(*) into v_awards_today
  from public.xp_awards
  where user_id = p_user_id
    and topic_key = p_topic_key
    and award_date = p_today;

  if v_awards_today >= v_allowance then
    -- เควสถือว่าทำเสร็จแล้ว (แถว completion บันทึกไปแล้ว UI จะได้ไม่ค้าง) แต่ไม่แจก XP
    return jsonb_build_object(
      'already_completed', false,
      'daily_limit_reached', true,
      'xp_earned', 0,
      'total_xp', v_profile.total_xp,
      'current_streak', v_profile.current_streak,
      'longest_streak', v_profile.longest_streak,
      'grade', (select grade from public.profiles where id = p_user_id)
    );
  end if;

  -- จดลง ledger ก่อนแตะ total_xp — ถ้าชน uniq_xp_award_per_quest แปลว่าเควสนี้เคยจ่าย XP ไปแล้ว
  insert into public.xp_awards (user_id, topic_key, award_date, xp, roadmap_id, quest_id)
  values (p_user_id, p_topic_key, p_today, p_xp, p_roadmap_id, p_quest_id)
  on conflict do nothing;

  if not found then
    return jsonb_build_object(
      'already_completed', true,
      'daily_limit_reached', false,
      'xp_earned', 0,
      'total_xp', v_profile.total_xp,
      'current_streak', v_profile.current_streak,
      'longest_streak', v_profile.longest_streak,
      'grade', (select grade from public.profiles where id = p_user_id)
    );
  end if;

  -- streak logic เดียวกับ _shared/gameplay.js nextStreak (วันเดิม=คงเดิม, เมื่อวาน=+1, อื่น ๆ/null=เริ่ม 1)
  v_new_streak := case
    when v_profile.last_quest_date = p_today then v_profile.current_streak
    when v_profile.last_quest_date = p_today - 1 then v_profile.current_streak + 1
    else 1
  end;
  v_new_longest := greatest(v_profile.longest_streak, v_new_streak);

  -- grade = band ที่ min สูงสุดซึ่ง "XP รวมใหม่" ถึง (ตรรกะเดียวกับ computeGrade)
  select b->>'grade' into v_grade
  from jsonb_array_elements(p_grade_bands) b
  where (b->>'min')::integer <= (v_profile.total_xp + p_xp)
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
    'daily_limit_reached', false,
    'xp_earned', p_xp,
    'total_xp', v_new_total,
    'current_streak', v_new_streak,
    'longest_streak', v_new_longest,
    'grade', coalesce(v_grade, 'F')
  );
end;
$$;

-- ปิด EXECUTE จาก client เหมือนเดิม — security definer ไม่เช็คสิทธิ์เอง ถ้าไม่ revoke
-- anon/authenticated ยิง PostgREST /rpc/complete_quest ตรง ๆ ข้าม gating checklist ได้
revoke execute on function public.complete_quest(uuid, uuid, uuid, integer, jsonb, date, jsonb, jsonb, text, integer, integer)
  from public, anon, authenticated;

-- ทิ้งลายเซ็นเก่า (8 พารามิเตอร์) — ถ้าปล่อยไว้ ตรรกะเดิมที่ยังไม่มีเพดานรายวันจะยังเรียกได้อยู่
drop function if exists public.complete_quest(uuid, uuid, uuid, integer, jsonb, date, jsonb, jsonb);
