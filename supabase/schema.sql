-- ============================================================
--  ลุยเควส (LuiQuest) — Supabase schema (ticket #03 / build-wave1)
--  ที่มา: .scratch/app-v2-spec/assets/supabase-schema.md
--  รันทั้งไฟล์ใน Supabase SQL Editor (project luiquest)
--  16 ตาราง + 4 view + RLS ทุกตาราง + bucket payment-slips
--  bootstrap admin: update profiles set is_admin=true where id='<owner-uuid>'
-- ============================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- อนุญาตให้สร้างฟังก์ชันที่อ้างถึงตารางที่ยังไม่ถูกสร้าง (is_admin อ้าง profiles) ในไฟล์เดียว
set check_function_bodies = false;

-- helper: เช็คว่า user ปัจจุบันเป็น admin (เจ้าของ) ไหม — ใช้ในหลาย RLS policy
-- bootstrap admin คนแรก: update profiles set is_admin = true where id = '<owner-uuid>' (ทำมือครั้งเดียว)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ⚠️ ของจริงบน production = ไฟล์นี้ + migrations ทั้งหมดใน supabase/migrations/ (เรียงตามวันที่)
--    migration 2026-08-05-audit-fixes.sql "เขียนทับ" object เหล่านี้ และยังไม่ได้มิเรอร์กลับมาในไฟล์นี้:
--      complete_quest, redeem_referral, public_stats, leaderboard
--      + เพิ่มใหม่: is_premium_active, reserve_chat_quota, referrer_reward_cap
--    ติดตั้งใหม่จากศูนย์ต้องรัน schema.sql แล้วตามด้วย migrations ทุกไฟล์เสมอ ห้ามรันแค่ไฟล์นี้
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text,                       -- ดึงจาก Google
  avatar_url          text,                       -- ดึงจาก Google
  total_xp            integer not null default 0,
  current_streak      integer not null default 0,
  longest_streak      integer not null default 0,
  last_quest_date     date,                        -- ใช้คำนวณ streak (ต่อเนื่อง/ขาด)
  last_active_at      timestamptz,                 -- อัปเดตทุกครั้งเปิดแอพ → ใช้ทำ DAU สำรอง (#14)
  grade               text,                        -- letter grade A/B/C... (คำนวณจาก progress)
  -- ★ ห้ามเช็ค is_premium เดี่ยว ๆ — ไม่มีอะไรในระบบเซ็ตกลับเป็น false ต้องคู่กับ premium_until เสมอ
  --   (จ่ายครั้งเดียวได้สิทธิ์ตลอดชีพ — P0 จาก audit 5 ส.ค. 2026) ใช้ public.is_premium_active() ใน SQL
  --   หรือ isPremiumActive() ฝั่ง JS (create-payment.js / _shared/questGenerator.js)
  is_premium          boolean not null default false,   -- flag หลักที่ทุก gating เช็ค (#13)
  premium_until       timestamptz,                 -- วันหมดสิทธิ (now + 1 เดือน ต่อรอบจ่าย) — auto-expire runway สั้น (#13)
  last_streak_freeze_date date,                    -- streak freeze ทำงานล่าสุดวันไหน (พรีเมียม: ขาดได้ 1 วัน/7 วัน)
  referral_code       text unique not null,        -- โค้ดของ user เองไว้ให้คนอื่นสมัครผ่าน
  referred_by         uuid references public.profiles(id) on delete set null,  -- สมัครผ่านใคร
  leaderboard_opt_out boolean not null default false,  -- privacy: ซ่อนจาก leaderboard (#14 flag 4)
  is_admin            boolean not null default false,  -- true = เจ้าของ (ใช้ verify payment/admin)
  created_at          timestamptz not null default now()  -- = Registered metric (#14)
);

create index idx_profiles_total_xp on public.profiles(total_xp desc);
create index idx_profiles_created_at on public.profiles(created_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    -- Supabase ติดตั้ง pgcrypto ไว้ที่ schema `extensions` ไม่ใช่ `public` — ต้อง qualify
    -- ชื่อ ไม่งั้น trigger นี้ล้มทุกครั้ง (ทำให้สมัครสมาชิกไม่ได้เลย พบตอน verify ticket #10)
    'LQ' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6))  -- เช่น LQ9F3A2C
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.topics (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,     -- python | data-ml | web | ai-tools | excel | finance
  title        text not null,            -- ชื่อไทยแสดงผล
  description  text,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.roadmaps (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  topic_id         uuid references public.topics(id) on delete set null,  -- null = หัวข้อพิมพ์อิสระ
  topic_title      text not null,        -- ชื่อหัวข้อ (curated หรือ freeform) ไว้แสดง
  level            text not null check (level in ('beginner','intermediate','advanced')),  -- มือใหม่/พอมีพื้น/แน่น
  minutes_per_day  integer not null check (minutes_per_day in (15,30,60)),  -- จาก onboarding ขั้น 3
  content          jsonb,                -- โครง roadmap ที่ AI generate (สรุป/metadata) — cache ตลอดชีพ (#03)
  status           text not null default 'ready' check (status in ('generating','ready','failed')),  -- freeform gen สด
  is_active        boolean not null default true,   -- ฟรี = active ได้ 1, premium = หลายอัน (#06/#13)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- cache ตลอดชีพ: 1 roadmap ต่อ user ต่อ curated topic (พิมพ์อิสระ topic_id=null ไม่ติด constraint นี้)
create unique index uniq_roadmap_user_topic
  on public.roadmaps(user_id, topic_id)
  where topic_id is not null;

create index idx_roadmaps_user on public.roadmaps(user_id);
create index idx_roadmaps_active on public.roadmaps(user_id) where is_active;

create or replace function public.enforce_active_roadmap_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_prem boolean;
  active_count integer;
begin
  if new.is_active then
    select is_premium into is_prem from public.profiles where id = new.user_id;
    if not coalesce(is_prem, false) then
      select count(*) into active_count
      from public.roadmaps
      where user_id = new.user_id and is_active and id <> new.id;
      if active_count >= 1 then
        raise exception 'FREE_PLAN_ACTIVE_ROADMAP_LIMIT';  -- ฟรีมี active ได้ทีละ 1
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_active_roadmap_limit
  before insert or update of is_active on public.roadmaps
  for each row execute function public.enforce_active_roadmap_limit();

create table public.phases (
  id            uuid primary key default gen_random_uuid(),
  roadmap_id    uuid not null references public.roadmaps(id) on delete cascade,
  phase_number  integer not null,        -- คง quirk: phase เป็น integer
  title         text not null,
  description   text,
  created_at    timestamptz not null default now(),
  unique (roadmap_id, phase_number)
);

create index idx_phases_roadmap on public.phases(roadmap_id);

create table public.daily_quests (
  id             uuid primary key default gen_random_uuid(),
  roadmap_id     uuid not null references public.roadmaps(id) on delete cascade,
  phase_id       uuid references public.phases(id) on delete set null,
  day_number     integer not null,       -- ลำดับวันใน roadmap
  scheduled_date date,                    -- วันที่ควรโผล่ (pre-generate กลางคืน) — null = ยืดหยุ่นตาม pace ผู้ใช้
  title          text not null,
  description    text,
  content        jsonb,                   -- เนื้อเควสเต็ม (objectives, แหล่งเรียน ฯลฯ)
  xp_reward      integer not null default 10,
  source_starter_id uuid,  -- FK ไป starter_quests ย้ายไปเพิ่มด้วย alter ท้ายไฟล์ (starter_quests สร้างทีหลัง)
  created_at     timestamptz not null default now(),
  unique (roadmap_id, day_number)         -- กันสร้างซ้ำตอน pre-generate ยิงพร้อมกัน (บทเรียนจาก ml-quest)
);

create index idx_daily_quests_roadmap on public.daily_quests(roadmap_id);
create index idx_daily_quests_date on public.daily_quests(scheduled_date);

create table public.quest_checklist_items (
  id           uuid primary key default gen_random_uuid(),
  quest_id     uuid not null references public.daily_quests(id) on delete cascade,
  order_index  integer not null default 0,
  label        text not null,
  link_url     text,                     -- ลิงก์แหล่งเรียน (whitelist/ค้นหาเท่านั้น ตาม #02)
  created_at   timestamptz not null default now()
);

create index idx_checklist_quest on public.quest_checklist_items(quest_id);

-- รวม claim และการเขียน quest/checklist ไว้ที่ DB เพื่อกัน Gemini ซ้ำและเควสเขียนค้างครึ่งเดียว
create table public.quest_generation_claims (
  roadmap_id  uuid not null references public.roadmaps(id) on delete cascade,
  day_number  integer not null,
  claim_token uuid not null,
  status      text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  claimed_at  timestamptz not null default now(),
  quest_id    uuid references public.daily_quests(id) on delete set null,
  primary key (roadmap_id, day_number)
);

create index idx_quest_generation_claims_stale
  on public.quest_generation_claims(status, claimed_at);

create table public.quest_completions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  quest_id      uuid not null references public.daily_quests(id) on delete cascade,
  roadmap_id    uuid not null references public.roadmaps(id) on delete cascade,  -- denormalize เพื่อ query เร็ว
  xp_earned     integer not null default 0,
  checked_items jsonb,                   -- snapshot ids ที่ติ๊ก (audit gating)
  completed_at  timestamptz not null default now(),  -- ★ metric: activated + กราฟเควสรายวัน (#14)
  unique (user_id, quest_id)             -- ทำเควสเดิมซ้ำไม่ได้
);

create index idx_completions_user on public.quest_completions(user_id);
create index idx_completions_completed_at on public.quest_completions(completed_at);

-- 2026-08-04 — ปิดช่องปั๊ม XP ถาวรด้วย ledger ที่ไม่ผูกกับ roadmap
-- ตารางนี้ต้อง **ไม่มี FK ไป roadmaps/daily_quests** ไม่งั้นก็โดน cascade ตามไปอีก
create table public.xp_awards (
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

create index idx_xp_awards_user_date on public.xp_awards(user_id, award_date);
create index idx_xp_awards_lookup    on public.xp_awards(user_id, topic_key, award_date);
create index idx_xp_awards_created   on public.xp_awards(created_at);  -- กราฟโตในหน้า /stats
create unique index uniq_xp_award_per_quest
  on public.xp_awards(user_id, quest_id)
  where quest_id is not null;

create table public.starter_quests (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid not null references public.topics(id) on delete cascade,
  level        text not null check (level in ('beginner','intermediate','advanced')),
  day_number   integer not null default 1,  -- วันที่ใน roadmap bank
  title        text not null,
  description  text,
  content      jsonb,                    -- เนื้อเควสเต็ม
  checklist    jsonb,                    -- checklist items (embed ในนี้ ตอนก๊อปค่อยแตกเป็นแถว)
  xp_reward    integer not null default 10,
  created_at   timestamptz not null default now(),
  unique (topic_id, level, day_number)   -- อนุญาตหลายวันต่อหัวข้อ/ระดับ
);

-- FK ของ daily_quests.source_starter_id (เพิ่มตรงนี้เพราะ daily_quests สร้างก่อน starter_quests)
alter table public.daily_quests
  add constraint daily_quests_source_starter_fk
  foreign key (source_starter_id) references public.starter_quests(id) on delete set null;

create table public.referrals (
  id                  uuid primary key default gen_random_uuid(),
  referrer_id         uuid not null references public.profiles(id) on delete cascade,  -- คนชวน
  referred_id         uuid not null references public.profiles(id) on delete cascade,  -- คนถูกชวน
  referrer_xp_awarded integer not null default 0,
  referred_xp_awarded integer not null default 0,
  created_at          timestamptz not null default now(),
  unique (referred_id)   -- แต่ละคนถูกนับว่าสมัครผ่านคนอื่นได้ครั้งเดียว (กันปั๊ม XP)
);

create index idx_referrals_referrer on public.referrals(referrer_id);

-- Redeem referral แบบ atomic ในทีเดียว (#10) — กัน lost-update ถ้า referrer โดนอัปเดต total_xp
-- พร้อมกันจากที่อื่น (เช่น complete-quest.js) และกันสถานะค้างครึ่ง ๆ กลาง ๆ ถ้าขั้นใดขั้นหนึ่งพัง
-- (referrals insert สำเร็จแต่จ่าย XP ไม่ครบ) — ทั้งฟังก์ชันอยู่ใน transaction เดียวของ Postgres
create or replace function public.redeem_referral(p_referrer_id uuid, p_referred_id uuid, p_bonus integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred_total_xp integer;
begin
  insert into public.referrals (referrer_id, referred_id, referrer_xp_awarded, referred_xp_awarded)
  values (p_referrer_id, p_referred_id, p_bonus, p_bonus);

  update public.profiles
  set total_xp = total_xp + p_bonus, referred_by = p_referrer_id
  where id = p_referred_id
  returning total_xp into v_referred_total_xp;

  update public.profiles
  set total_xp = total_xp + p_bonus
  where id = p_referrer_id;

  insert into public.activity_log (user_id, event_type, metadata) values
    (p_referred_id, 'referral_signup', jsonb_build_object('referrer_id', p_referrer_id, 'xp_awarded', p_bonus)),
    (p_referrer_id, 'referral_signup', jsonb_build_object('referred_id', p_referred_id, 'xp_awarded', p_bonus));

  return v_referred_total_xp;
end;
$$;

-- Postgres แจก EXECUTE ให้ PUBLIC อัตโนมัติตอนสร้าง function (บั๊กเดียวกับ default privileges
-- ของ view ที่เจอตอน ticket #03) — ฟังก์ชันนี้ security definer + ไม่เช็คสิทธิ์เอง ถ้าไม่ revoke
-- ผู้ใช้ anon/authenticated จะยิง PostgREST /rpc/redeem_referral ตรง ๆ แจก XP เองได้เลย ต้องปิด
revoke execute on function public.redeem_referral(uuid, uuid, integer) from public, anon, authenticated;

-- complete_quest เวอร์ชันใหม่: บังคับเพดานรายวันจาก ledger ก่อนแจก XP
-- ทำไมใช้ "นับใต้ล็อก" แทน unique constraint: premium ต้องทำได้ >1 ครั้ง/วัน (จุดขายที่เจ้าของ
-- เลือก) ซึ่ง unique(user,topic,date) จะบล็อกตั้งแต่ครั้งที่ 2 — แถว profiles ถูกล็อกด้วย
-- `for update` ตลอด transaction อยู่แล้ว การนับใต้ล็อกจึงกัน race ได้จริงเท่ากัน
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
    -- ทำเควสนี้ไปแล้ว (แทนที่ handler 23505 เดิมใน complete-quest.js) — คืนค่าปัจจุบัน ไม่แจก XP ซ้ำ
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
  -- เดิมตัดจาก streak — เปลี่ยนเป็น XP เมื่อ 23 ก.ค. 2026 (เหตุผลใน src/lib/gradeBands.js)
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

-- ปิด EXECUTE จาก client เหมือน redeem_referral — security definer ไม่เช็คสิทธิ์เอง ถ้าไม่ revoke
-- anon/authenticated ยิง PostgREST /rpc/complete_quest ตรง ๆ ข้าม gating checklist ได้
revoke execute on function public.complete_quest(uuid, uuid, uuid, integer, jsonb, date, jsonb, jsonb, text, integer, integer)
  from public, anon, authenticated;

create or replace function public.create_quest_with_checklist(
  p_roadmap_id       uuid,
  p_phase_id         uuid,
  p_day_number       integer,
  p_scheduled_date   date,
  p_title            text,
  p_description      text,
  p_content          jsonb,
  p_xp_reward        integer,
  p_source_starter_id uuid,
  p_checklist        jsonb,
  p_claim_token      uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim     record;
  v_quest     public.daily_quests%rowtype;
  v_checklist jsonb;
begin
  if jsonb_typeof(coalesce(p_checklist, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_checklist, '[]'::jsonb)) = 0 then
    raise exception 'เควสต้องมี checklist อย่างน้อย 1 ข้อ';
  end if;

  if p_claim_token is not null then
    select * into v_claim
    from public.quest_generation_claims
    where roadmap_id = p_roadmap_id
      and day_number = p_day_number
      and status = 'generating'
      and claim_token = p_claim_token
    for update;

    if not found then
      raise exception 'generation claim หมดอายุหรือถูกแทนที่แล้ว';
    end if;
  end if;

  insert into public.daily_quests (
    roadmap_id, phase_id, day_number, scheduled_date, title, description,
    content, xp_reward, source_starter_id
  )
  values (
    p_roadmap_id, p_phase_id, p_day_number, p_scheduled_date, p_title, p_description,
    coalesce(p_content, '{}'::jsonb), p_xp_reward, p_source_starter_id
  )
  returning * into v_quest;

  insert into public.quest_checklist_items (quest_id, order_index, label, link_url)
  select
    v_quest.id,
    coalesce(nullif(item->>'order_index', '')::integer, ordinality::integer - 1),
    item->>'label',
    nullif(item->>'link_url', '')
  from jsonb_array_elements(p_checklist) with ordinality as items(item, ordinality);

  if p_claim_token is not null then
    update public.quest_generation_claims
    set status = 'ready', quest_id = v_quest.id, claimed_at = now()
    where roadmap_id = p_roadmap_id
      and day_number = p_day_number
      and claim_token = p_claim_token;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', c.id, 'order_index', c.order_index, 'label', c.label, 'link_url', c.link_url)
      order by c.order_index
    ),
    '[]'::jsonb
  ) into v_checklist
  from public.quest_checklist_items c
  where c.quest_id = v_quest.id;

  return jsonb_build_object('quest', to_jsonb(v_quest), 'checklist', v_checklist);
end;
$$;

revoke execute on function public.create_quest_with_checklist(uuid, uuid, integer, date, text, text, jsonb, integer, uuid, jsonb, uuid)
  from public, anon, authenticated;

create or replace function public.get_eligible_roadmaps_for_generation(p_limit integer default 3)
returns table (
  id                 uuid,
  topic_id           uuid,
  topic_title        text,
  level              text,
  minutes_per_day    integer,
  content            jsonb,
  day_number         integer,
  last_generated_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    r.topic_id,
    r.topic_title,
    r.level,
    r.minutes_per_day,
    r.content,
    latest.day_number + 1,
    latest.created_at
  from public.roadmaps r
  join lateral (
    select q.id, q.day_number, q.created_at
    from public.daily_quests q
    where q.roadmap_id = r.id
    order by q.day_number desc
    limit 1
  ) latest on true
  left join public.quest_generation_claims claim
    on claim.roadmap_id = r.id
   and claim.day_number = latest.day_number + 1
  where r.is_active = true
    and r.status = 'ready'
    and exists (
      select 1
      from public.quest_completions c
      where c.quest_id = latest.id
        and c.user_id = r.user_id
    )
    and not exists (
      select 1
      from public.daily_quests next_q
      where next_q.roadmap_id = r.id
        and next_q.day_number = latest.day_number + 1
    )
    and not exists (
      select 1
      from public.quest_generation_claims claim
      where claim.roadmap_id = r.id
        and claim.day_number = latest.day_number + 1
        and (
          claim.status = 'ready'
          or (claim.status in ('generating', 'failed') and claim.claimed_at >= now() - interval '2 minutes')
        )
      )
  order by greatest(latest.created_at, coalesce(claim.claimed_at, latest.created_at)) asc, r.created_at asc, r.id asc
  limit greatest(0, least(coalesce(p_limit, 3), 3));
$$;

revoke execute on function public.get_eligible_roadmaps_for_generation(integer)
  from public, anon, authenticated;

create table public.chat_messages (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  roadmap_id  uuid references public.roadmaps(id) on delete cascade,
  quest_id    uuid references public.daily_quests(id) on delete set null,
  role        text not null check (role in ('user','assistant')),
  message     text not null,
  created_at  timestamptz not null default now()
);

create index idx_chat_user_date on public.chat_messages(user_id, created_at);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  ref_code      text unique not null,     -- LQ-XXXX ใส่หมายเหตุโอน / match คน↔ยอด
  amount        integer not null default 39,   -- บาท/เดือน (เก็บฟิลด์ไว้เผื่อปรับ 29/59 — #13 flag 3)
  status        text not null default 'pending'
                check (status in ('pending','submitted','verified','rejected')),
  slip_url      text,                     -- path รูปสลิปใน bucket payment-slips
  reject_reason text,
  created_at    timestamptz not null default now(),
  submitted_at  timestamptz,              -- ตอนอัปสลิป
  verified_at   timestamptz,              -- ตอน admin กด verify
  verified_by   uuid references public.profiles(id) on delete set null  -- admin ที่ verify (audit)
);

create index idx_payments_user on public.payments(user_id);
create index idx_payments_status on public.payments(status);

-- กันจ่ายซ้ำซ้อน: 1 user มี payment ที่ยังค้าง (pending/submitted) ได้ทีละ 1 (#13 edge case)
create unique index uniq_open_payment_per_user
  on public.payments(user_id)
  where status in ('pending','submitted');

create table public.activity_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  event_type  text not null,   -- login | quest_complete | chat | roadmap_start | share | referral_signup | premium_submit ...
  metadata    jsonb,           -- payload เสริม (เช่น topic, quest_id) — optional
  created_at  timestamptz not null default now()  -- ★ ต้องมีตั้งแต่ deploy วันแรก ไม่งั้นกราฟ DAU ย้อนหลังหาย
);

create index idx_activity_user_date on public.activity_log(user_id, created_at);
create index idx_activity_type_date on public.activity_log(event_type, created_at);

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
create view public.payment_admin_stats as
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

-- เพื่อน/duo (เห็น streak กัน) — #06 Wave 2
create table public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index idx_friend_addressee on public.friendships(addressee_id);

-- web push subscription (กัน streak ขาด) — #06 Wave 2
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,     -- key สำหรับ encrypt payload
  auth       text not null,
  created_at timestamptz not null default now()
);
create index idx_push_user on public.push_subscriptions(user_id);

-- Leaderboard: อันดับ XP รวมทั้งแอพ (#06) — เคารพ opt-out, โชว์ badge premium (#13)
create view public.leaderboard as
select
  row_number() over (order by total_xp desc, created_at asc) as rank,
  id as user_id,
  display_name,
  avatar_url,
  total_xp,
  current_streak,
  is_premium               -- ใช้โชว์ badge "ผู้สนับสนุน" (social proof)
from public.profiles
where leaderboard_opt_out = false;

-- Public stats: aggregate สำหรับหน้า /stats (#14) — ไม่มี PII เลย
create view public.public_stats as
select
  (select count(*) from public.profiles) as registered_total,
  (select count(distinct user_id) from public.quest_completions) as activated_total,
  (select count(*) from public.quest_completions) as quests_completed_total,
  (select coalesce(max(longest_streak), 0) from public.profiles) as max_streak,
  (select coalesce(round(avg(current_streak), 1), 0) from public.profiles
     where current_streak > 0) as avg_active_streak,
  (select count(distinct user_id) from public.activity_log
     where created_at >= date_trunc('day', now())) as dau_today;

-- กราฟโต: ยอดผู้ใช้สะสมรายวัน (#14 — เส้นโตขึ้นเรื่อย ๆ ที่ pitch ต้องการ)
create view public.stats_daily_growth as
select
  d::date as day,
  (select count(*) from public.profiles p where p.created_at::date <= d::date) as cumulative_users
from generate_series(
  (select min(created_at)::date from public.profiles),
  current_date,
  interval '1 day'
) d;

grant select on public.public_stats     to anon, authenticated;  -- /stats เปิดสาธารณะ (อาจารย์เปิดลิงก์ดูได้)
grant select on public.stats_daily_growth to anon, authenticated;
grant select on public.leaderboard       to authenticated;        -- leaderboard เฉพาะคนล็อกอิน
revoke select on public.leaderboard      from anon;               -- default privileges แอบให้ anon อ่าน view ได้ ต้อง revoke ทิ้ง (เจอตอน verify ticket 03)

alter table public.profiles              enable row level security;
alter table public.topics                enable row level security;
alter table public.roadmaps              enable row level security;
alter table public.phases                enable row level security;
alter table public.daily_quests          enable row level security;
alter table public.quest_checklist_items enable row level security;
alter table public.quest_completions     enable row level security;
alter table public.xp_awards             enable row level security;
alter table public.quest_generation_claims enable row level security;
alter table public.starter_quests        enable row level security;
alter table public.referrals             enable row level security;
alter table public.chat_messages         enable row level security;
alter table public.payments              enable row level security;
alter table public.activity_log          enable row level security;
alter table public.friendships           enable row level security;
alter table public.push_subscriptions    enable row level security;

-- อ่านได้เฉพาะแถวตัวเอง (การโชว์คนอื่นไปทาง view leaderboard ที่ bypass RLS)
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- อัปเดตได้เฉพาะแถวตัวเอง — แต่ห้ามแก้ฟิลด์สิทธิ์/progress/ระบบเอง เหลือ display_name/avatar_url/opt-out ให้ user แก้ได้
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_premium  = (select is_premium  from public.profiles where id = auth.uid())
    and premium_until is not distinct from (select premium_until from public.profiles where id = auth.uid())
    and is_admin    = (select is_admin    from public.profiles where id = auth.uid())
    and total_xp    = (select total_xp    from public.profiles where id = auth.uid())
    and current_streak = (select current_streak from public.profiles where id = auth.uid())
    and longest_streak  = (select longest_streak  from public.profiles where id = auth.uid())
    and last_quest_date is not distinct from (select last_quest_date from public.profiles where id = auth.uid())
    and last_active_at  is not distinct from (select last_active_at  from public.profiles where id = auth.uid())
    and grade           is not distinct from (select grade           from public.profiles where id = auth.uid())
    and referral_code   = (select referral_code   from public.profiles where id = auth.uid())
    and referred_by     is not distinct from (select referred_by     from public.profiles where id = auth.uid())
    and created_at      = (select created_at      from public.profiles where id = auth.uid())
  );

-- admin อ่านได้ทุกแถว (หน้า admin)
create policy "profiles_select_admin" on public.profiles
  for select to authenticated using (public.is_admin());

create policy "topics_select_all" on public.topics
  for select to anon, authenticated using (is_active);

create policy "starter_quests_select_all" on public.starter_quests
  for select to anon, authenticated using (true);  -- ต้องอ่านได้ตอน onboarding

create policy "topics_write_admin" on public.topics
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "starter_quests_write_admin" on public.starter_quests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- roadmaps: client อ่านของตัวเองได้อย่างเดียว — write ทุกอย่าง (สร้าง/สลับ active/ลบ) ทำผ่าน
-- service role ใน Netlify Functions เท่านั้น กัน client insert ตรงข้าม free cap 3 หัวข้อ
-- (scrutinize 2026-07-15 nit — cap เดิมเช็คแค่ใน questGenerator.js)
create policy "roadmaps_select_own" on public.roadmaps
  for select to authenticated
  using (auth.uid() = user_id);

-- phases: อ่านอย่างเดียวผ่าน roadmap ownership — write ผ่าน service role เท่านั้น
create policy "phases_select_own" on public.phases
  for select to authenticated
  using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()));

-- daily_quests: อ่านเฉพาะเควสใน roadmap ตัวเอง — ห้าม client write เด็ดขาด ไม่งั้นตั้ง
-- xp_reward เองแล้วปั๊ม XP ได้ (scrutinize 2026-07-15 Blocker 1); insert จริงทำโดย service role
create policy "daily_quests_select_own" on public.daily_quests
  for select to authenticated
  using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.user_id = auth.uid()));

-- checklist items: อ่านอย่างเดียวผ่าน quest → roadmap → user — ห้าม client delete ไม่งั้น
-- ลบ checklist เพื่อข้าม gating ใน complete-quest ได้ (scrutinize 2026-07-15 Blocker 2)
create policy "checklist_select_own" on public.quest_checklist_items
  for select to authenticated
  using (exists (
    select 1 from public.daily_quests q
    join public.roadmaps r on r.id = q.roadmap_id
    where q.id = quest_id and r.user_id = auth.uid()));

create policy "completions_select_own" on public.quest_completions
  for select to authenticated using (auth.uid() = user_id);

-- RLS: อ่านของตัวเองได้ (เผื่อ frontend อยากโชว์ประวัติ) — เขียนผ่าน service role (RPC) เท่านั้น
create policy "xp_awards_select_own" on public.xp_awards
  for select to authenticated using (auth.uid() = user_id);
-- ไม่มี insert/update/delete policy โดยตั้งใจ — ถ้า client เขียนเองได้ ก็ปั๊ม XP ได้อีกทาง

-- ไม่มี insert/update/delete policy → insert ทำผ่าน service role (RPC complete_quest) เท่านั้น
-- กัน client เสก activated_total/quests_completed_total ปลอม (scrutinize 2026-07-15 Major 3)

create policy "referrals_select_involved" on public.referrals
  for select to authenticated
  using (auth.uid() = referrer_id or auth.uid() = referred_id);
-- insert/update ไม่เปิดให้ client — ทำผ่าน service role function (ให้ XP ทั้งคู่, กันปั๊ม)

create policy "chat_select_own" on public.chat_messages
  for select to authenticated using (auth.uid() = user_id);
-- frontend อ่านอย่างเดียว (src/pages/Coach.jsx:51 เป็น .select() ล้วน) ไม่เคย insert
-- ข้อความจริงถูกเขียนโดย netlify/functions/chat.js ผ่าน service role หลัง Gemini ตอบสำเร็จ
-- ปล่อย insert policy ไว้ = ใครก็ยัดข้อความขนาดใหญ่เข้ามาเท่าไหร่ก็ได้ด้วย anon key

-- เจ้าของอ่าน payment ของตัวเอง / admin อ่านทุกแถว
create policy "payments_select_own_or_admin" on public.payments
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());
-- payment ทุกแถวสร้างและอัปเดตผ่าน function service role เท่านั้น
-- (create-payment / submit-slip / verify-payment) — client ต้องการแค่ select ของตัวเอง

-- admin อัปเดตได้ทุกแถว (verify/reject → ตั้ง verified/rejected + verified_by)
create policy "payments_update_admin" on public.payments
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ไม่มี insert policy ฝั่ง client → activity_log เขียนผ่าน service role เท่านั้น
-- กันปลอม DAU/metric จาก anon key (scrutinize 2026-07-15 Major 3)
create policy "activity_select_own_or_admin" on public.activity_log
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

-- ฟีเจอร์เพื่อนยังไม่ได้ทำ frontend ไม่แตะตารางนี้เลย — เปิดแค่ select เหมือน push_subscriptions
-- policy insert/update เดิมถูกถอดออก 5 ส.ค. 2026: insert ไม่บังคับ status='pending' และ update
-- แก้ได้ทุกคอลัมน์ → สร้างสถานะ "เป็นเพื่อนกันแล้ว" กับใครก็ได้เอง เอากลับมาเมื่อสร้างฟีเจอร์จริง
create policy "friend_select_involved" on public.friendships
  for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- web push เป็นงาน Wave 2 ที่ยังไม่ได้ทำ frontend ไม่แตะตารางนี้เลยสักบรรทัด
-- policy เดิมเป็น for all จึงเปิด insert/update/delete ให้ authenticated ทุกคน — เอากลับมาเมื่อสร้างฟีเจอร์จริง

-- สร้าง bucket แบบ private (ไม่ public)
insert into storage.buckets (id, name, public)
values ('payment-slips', 'payment-slips', false)
on conflict (id) do nothing;

-- user อัปโหลดสลิปเข้าโฟลเดอร์ของตัวเอง (prefix = uid)
create policy "slips_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-slips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- อ่านสลิปได้เฉพาะเจ้าของไฟล์ หรือ admin (เจ้าของดูตอน verify)
create policy "slips_select_own_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-slips'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- 1) topics (6 หัวข้อ curated ตาม #02)
insert into public.topics (slug, title, description, sort_order) values
  ('python',   'Python เริ่มจากศูนย์',        'เขียนโปรแกรม Python ตั้งแต่ 0',        1),
  ('data-ml',  'Data/ML',                     'วิเคราะห์ข้อมูล + Machine Learning',   2),
  ('web',      'สร้างเว็บ (HTML/CSS/JS)',      'ทำเว็บของตัวเองตั้งแต่พื้นฐาน',        3),
  ('ai-tools', 'ใช้ AI ให้เป็น',              'prompt + เครื่องมือ AI ในการทำงาน',    4),
  ('excel',    'Excel/Google Sheets',         'ตาราง สูตร วิเคราะห์ข้อมูลงานจริง',    5),
  ('finance',  'การเงินส่วนบุคคล',            'วางแผนเงิน ออม ลงทุนเบื้องต้น',        6)
on conflict (slug) do nothing;

-- 2) starter_quests — โครง 18 แถว (topic × level). เนื้อ content/checklist เติมทีหลัง
-- ตัวอย่าง 1 หัวข้อ (python) ครบ 3 ระดับ — ทำแพทเทิร์นเดียวกันให้ครบ 6 หัวข้อ = 18 แถว
insert into public.starter_quests (topic_id, level, day_number, title, description, xp_reward, content, checklist)
select t.id, v.level, 1, v.title, v.description, 10, '{}'::jsonb, '[]'::jsonb
from public.topics t
join (values
  ('python','beginner',     'เควสแรก: ติดตั้ง Python + พิมพ์ "สวัสดี"', 'รู้จัก Python แล้วรันโค้ดแรกใน Colab'),
  ('python','intermediate', 'เควสแรก: ทบทวนตัวแปร + เขียน loop สั้น ๆ',  'วอร์มพื้นฐานที่พอมีอยู่แล้วให้แน่น'),
  ('python','advanced',     'เควสแรก: เขียนฟังก์ชัน + จัดการ error',      'ต่อยอดสำหรับคนเขียนเป็นแล้ว')
) as v(slug, level, title, description) on t.slug = v.slug
on conflict (topic_id, level, day_number) do nothing;
