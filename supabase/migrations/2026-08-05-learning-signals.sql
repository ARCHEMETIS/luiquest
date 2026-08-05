-- Migration 5 ส.ค. 2026 (ตัวที่ 2) — เก็บ "สัญญาณการเรียนรู้" เพื่อตอบให้ได้ว่า roadmap ดีกับผู้เรียนจริงไหม
--
-- ทำไมต้องมี: ก่อนหน้านี้ระบบเก็บแค่ ติ๊กครบไหม / ได้ XP เท่าไร / เสร็จเมื่อไร
-- ซึ่งพิสูจน์ได้แค่ว่า "กดครบ" ไม่ได้พิสูจน์ว่า "เข้าใจ" — คำถามของเจ้าของตอบไม่ได้เลยด้วยข้อมูลที่มี
--
-- ★ หัวใจของการออกแบบ: วัดเป็น "คู่ก่อน-หลัง"
--   pre_lesson_correct  = ตอบข้อวัดก่อนอ่านบทเรียน
--   first_attempt_correct = ตอบข้ออีกข้อ (คนละข้อ วัดเรื่องเดียวกัน) หลังอ่านบทเรียน+ทำ checklist
--   ถ้าดูแค่ตอบหลังเรียนถูก จะแยกไม่ออกว่า "บทเรียนสอนได้ผล" หรือ "เขารู้อยู่แล้ว"
--   (ข้อสังเกตจาก Codex ตอน scrutinize แผน 5 ส.ค. — เป็นจุดที่ทำให้ตัวเลขมีความหมายจริง)

begin;

create table if not exists public.quest_learning_signals (
  user_id     uuid not null references public.profiles(id) on delete cascade,

  -- ★ จงใจไม่ใส่ FK ไป daily_quests/roadmaps (แพตเทิร์นเดียวกับ xp_awards)
  --   ถ้าใส่ FK แถวนี้จะโดน cascade ลบตอนผู้ใช้กด "ลบหัวข้อ" = หลักฐาน pilot หายก่อนวันนำเสนอ
  quest_id    uuid not null,

  -- snapshot ที่อยู่รอดแม้เควสต้นทางถูกลบ — ใช้รวมผลข้ามผู้เรียนได้ (quest_id เป็น uuid รายคน)
  topic_key   text not null,             -- 'topic:data-ml' — จาก _shared/topicKey.js
  level       text not null,
  day_number  integer not null,
  exercise_version text not null,        -- เวอร์ชันชุดโจทย์ เผื่อแก้โจทย์แล้วต้องแยกผลก่อน/หลังแก้

  -- ── ผลการวัด ──
  pre_lesson_correct    boolean,         -- เขียนครั้งเดียว ห้ามทับ
  first_attempt_correct boolean,         -- เขียนครั้งเดียว ห้ามทับ
  revealed_answer       boolean not null default false,  -- ขึ้นทางเดียว false -> true

  -- ── ความเห็นผู้เรียน (แก้ได้ เพราะเป็นความรู้สึก ไม่ใช่ผลการวัด) ──
  difficulty  text check (difficulty in ('too_easy', 'right', 'too_hard')),
  time_fit    text check (time_fit in ('within_budget', 'over_budget')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (user_id, quest_id)        -- ★ กันแถวซ้ำ: หนึ่งคน หนึ่งเควส หนึ่งแถวเท่านั้น
);

create index if not exists idx_learning_signals_cohort
  on public.quest_learning_signals(topic_key, level, day_number);

alter table public.quest_learning_signals enable row level security;

-- อ่านของตัวเองได้ (frontend ต้องรู้ว่าตอบไปแล้วหรือยัง จะได้ไม่ถามซ้ำตอน reload)
create policy "learning_signals_select_own" on public.quest_learning_signals
  for select to authenticated using (auth.uid() = user_id);

-- ★ ไม่มี policy insert/update ให้ client เด็ดขาด — เขียนผ่าน service role ใน Netlify function เท่านั้น
--   เหตุผล: ค่า "ตอบถูกครั้งแรก" ต้องเขียนได้ครั้งเดียวจริง ๆ ถ้าปล่อยให้ browser upsert เอง
--   ผู้ใช้รีเฟรชแล้วตอบใหม่ทับได้ = ตัวเลขที่จะเอาไปนำเสนอเชื่อไม่ได้
--   (และ audit 5 ส.ค. เพิ่งถอด policy เขียนของ friendships ทิ้งด้วยเหตุผลตระกูลเดียวกัน)

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: บันทึกสัญญาณแบบ atomic + บังคับ write-once ใน DB ไม่ใช่ใน React
--   p_event: 'pre' | 'post' | 'reveal' | 'rating'
--   coalesce(<คอลัมน์เดิม>, <ค่าใหม่>) = เขียนได้เฉพาะตอนยังว่าง ครั้งต่อไปไม่ทับ
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_learning_signal(
  p_user_id          uuid,
  p_quest_id         uuid,
  p_topic_key        text,
  p_level            text,
  p_day_number       integer,
  p_exercise_version text,
  p_event            text,
  p_correct          boolean default null,
  p_difficulty       text default null,
  p_time_fit         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.quest_learning_signals;
begin
  if p_event not in ('pre', 'post', 'reveal', 'rating') then
    raise exception 'p_event ไม่ถูกต้อง: %', p_event using errcode = 'check_violation';
  end if;

  insert into public.quest_learning_signals (
    user_id, quest_id, topic_key, level, day_number, exercise_version
  )
  values (p_user_id, p_quest_id, p_topic_key, p_level, p_day_number, p_exercise_version)
  on conflict (user_id, quest_id) do nothing;

  update public.quest_learning_signals
  set
    -- ★ write-once: เขียนเฉพาะตอนยังเป็น null เท่านั้น ตอบซ้ำ/รีเฟรชแล้วตอบใหม่ไม่ทับของเดิม
    pre_lesson_correct = case
      when p_event = 'pre' then coalesce(pre_lesson_correct, p_correct)
      else pre_lesson_correct end,
    first_attempt_correct = case
      when p_event = 'post' then coalesce(first_attempt_correct, p_correct)
      else first_attempt_correct end,
    -- ★ monotonic: เปิดเฉลยแล้วย้อนกลับเป็น false ไม่ได้
    revealed_answer = revealed_answer or (p_event = 'reveal'),
    -- ความรู้สึกเปลี่ยนใจได้ ไม่ต้อง write-once
    difficulty = case when p_event = 'rating' and p_difficulty is not null then p_difficulty else difficulty end,
    time_fit   = case when p_event = 'rating' and p_time_fit   is not null then p_time_fit   else time_fit end,
    updated_at = now()
  where user_id = p_user_id and quest_id = p_quest_id
  returning * into v_row;

  return jsonb_build_object(
    'pre_lesson_correct',    v_row.pre_lesson_correct,
    'first_attempt_correct', v_row.first_attempt_correct,
    'revealed_answer',       v_row.revealed_answer,
    'difficulty',            v_row.difficulty,
    'time_fit',              v_row.time_fit
  );
end;
$$;

-- ปิด EXECUTE จาก client เหมือน complete_quest/redeem_referral — security definer ไม่เช็คสิทธิ์เอง
revoke execute on function public.record_learning_signal(uuid, uuid, text, text, integer, text, text, boolean, text, text)
  from public, anon, authenticated;

commit;
