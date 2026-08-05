-- Migration 5 ส.ค. 2026 — ปิดผลตรวจ audit 6 มุม (รายงานเต็ม: .scratch/audit-2026-08-05/findings.md)
-- รันทั้งไฟล์ได้ในทีเดียว ปลอดภัยกับข้อมูล production ที่มีอยู่ (ไม่มีคำสั่งลบข้อมูลผู้ใช้)
--
-- สิ่งที่ปิดในไฟล์นี้:
--   1) P0 ปั๊ม XP: เพดาน XP รายวันคิดต่อ "คน/วัน" แทน "คน/หัวข้อ/วัน"
--   2) P0 พรีเมียมไม่หมดอายุ: ทุกจุดใน SQL เช็ค premium_until ด้วย
--   3) จุดขายพรีเมียม: 3 เควส/วันจริง + streak freeze สัปดาห์ละครั้ง
--   4) P1 referral: กันชวนไขว้ + เพดานจำนวนคนที่ให้ XP ผู้ชวน
--   5) P1 bucket สลิป: เพดานขนาด/ชนิดไฟล์ + กันยื่นสลิปไฟล์เดิมซ้ำ
--   6) P0 โควตาแชท race: จองโควตาใต้ล็อกก่อนเรียก Gemini
--   7) P2 friendships: ปิด write จาก client (ฟีเจอร์ยังไม่ได้ใช้)
--   8) P1 ตัวเลขหน้า /stats เดินถอยหลังได้ตอนผู้ใช้ลบหัวข้อ

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) คอลัมน์ใหม่: วันที่ใช้ streak freeze ครั้งล่าสุด (จุดขายพรีเมียม)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists last_streak_freeze_date date;

comment on column public.profiles.last_streak_freeze_date is
  'วันที่ streak freeze ทำงานล่าสุด — พรีเมียมขาดได้ 1 วันต่อ 7 วันโดย streak ไม่ขาด';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) helper: "พรีเมียมที่ยังไม่หมดอายุ" — ที่เดียวสำหรับทุก SQL ที่ต้องเช็คสิทธิ์
--    ต้องตรงกับ isPremiumActive() ใน netlify/functions/create-payment.js เป๊ะ ๆ
--    (is_premium ต้องจริง และ premium_until ต้องยังไม่ถึง — null = ไม่นับว่าใช้งานอยู่)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_premium_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(is_premium, false) and premium_until is not null and premium_until > now()
  from public.profiles
  where id = p_user_id;
$$;

revoke execute on function public.is_premium_active(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) complete_quest — เพดานรายวันต่อ "คน" + พรีเมียมเช็ควันหมดอายุ + streak freeze
--
--    ★ การเปลี่ยนที่สำคัญที่สุดของ migration นี้:
--      เดิมนับ xp_awards ด้วย (user_id, topic_key, award_date) = เพดาน "ต่อหัวข้อ"
--      → เปลี่ยนชื่อหัวข้อนิดเดียว ("python basics" vs "python basics.") ได้โควตาใหม่ทันที
--      → วน สร้าง-ทำเควส-ลบ ปั๊ม XP ได้ไม่จำกัด (P0 จาก audit 5 ส.ค.)
--      ตอนนี้นับด้วย (user_id, award_date) เฉย ๆ = ต่อคนต่อวัน ปิดทุกวิธีเลี่ยงในคราวเดียว
--      โดยไม่ต้องไล่ normalize Unicode ให้ครบทุกกรณี
--      topic_key ยังเก็บลง ledger เหมือนเดิม (ใช้ audit + เผื่อทำแรงค์แยกหัวข้อทีหลัง)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.complete_quest(
  p_user_id           uuid,
  p_quest_id          uuid,
  p_roadmap_id        uuid,
  p_xp                integer,
  p_checked_items     jsonb,
  p_today             date,      -- "วันเรียน" ตามเวลาไทย คำนวณฝั่ง JS (learningDayStr — ตัดตี 5)
  p_grade_bands       jsonb,     -- [{grade,min}, ...] เรียงจาก min น้อย→มาก
  p_metadata          jsonb,     -- payload ของ activity_log event quest_complete
  p_topic_key         text,      -- 'topic:<slug>' | 'free:<ชื่อ normalize>' — เก็บไว้ audit
  p_free_allowance    integer default 1,   -- ฟรี: 1 เควสที่ได้ XP ต่อวัน (รวมทุกหัวข้อ)
  p_premium_allowance integer default 3    -- พรีเมียม: 3 เควสที่ได้ XP ต่อวัน (จุดขายที่ขายไว้จริง)
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
  v_premium      boolean;
  v_froze        boolean := false;
begin
  -- ★ ล็อกแถว profile เป็นอย่างแรก: ทั้งการนับโควตารายวันและการบวก total_xp ต้องอยู่ใต้ล็อกเดียวกัน
  select total_xp, current_streak, longest_streak, last_quest_date, is_premium, premium_until,
         last_streak_freeze_date
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'ไม่พบโปรไฟล์ผู้ใช้ %', p_user_id;
  end if;

  -- พรีเมียมต้อง "ยังไม่หมดอายุ" ถึงจะได้สิทธิ์ — เดิมเช็คแค่ธง is_premium ที่ไม่มีใครเซ็ตกลับเป็น false
  -- (จ่าย 39 บาทครั้งเดียวได้สิทธิ์ตลอดชีพ — P0 จาก audit 5 ส.ค.)
  v_premium := coalesce(v_profile.is_premium, false)
               and v_profile.premium_until is not null
               and v_profile.premium_until > now();

  -- idempotent: unique (user_id, quest_id) — double-submit/race แทรกซ้ำจะ conflict แล้วข้าม
  -- ★ ใส่ xp_earned = 0 ไปก่อน แล้วค่อยอัปเดตเป็น p_xp ตอนจ่าย XP จริงตอนท้าย
  --   เดิมใส่ p_xp ตั้งแต่แรกก่อนเช็คเพดาน → เควสที่ชนเพดาน (ได้ 0 XP) ถูกบันทึกว่าได้ 20 XP
  --   พอ retry/กดซ้ำ ระบบคืนค่าจากแถวนี้ UI เลยฉลอง "+20 XP" ที่ไม่เคยได้จริง (P1 จาก audit)
  insert into public.quest_completions (user_id, quest_id, roadmap_id, xp_earned, checked_items)
  values (p_user_id, p_quest_id, p_roadmap_id, 0, p_checked_items)
  on conflict (user_id, quest_id) do nothing;

  if not found then
    -- ทำเควสนี้ไปแล้ว — คืนค่าปัจจุบัน ไม่แจก XP ซ้ำ
    select xp_earned into v_existing_xp
    from public.quest_completions
    where user_id = p_user_id and quest_id = p_quest_id;

    return jsonb_build_object(
      'already_completed', true,
      'daily_limit_reached', false,
      'streak_frozen', false,
      'xp_earned', coalesce(v_existing_xp, 0),
      'total_xp', v_profile.total_xp,
      'current_streak', v_profile.current_streak,
      'longest_streak', v_profile.longest_streak,
      'last_quest_date', v_profile.last_quest_date,
      'grade', (select grade from public.profiles where id = p_user_id)
    );
  end if;

  -- ★ เพดานรายวัน "ต่อคน" (ไม่ผูกหัวข้อ ไม่ผูก roadmap) — ลบหัวข้อ/เปลี่ยนชื่อหัวข้อก็ยังชนเพดานเดิม
  v_allowance := case when v_premium then p_premium_allowance else p_free_allowance end;

  select count(*) into v_awards_today
  from public.xp_awards
  where user_id = p_user_id
    and award_date = p_today;

  if v_awards_today >= v_allowance then
    -- เควสถือว่าทำเสร็จแล้ว (แถว completion บันทึกไปแล้ว UI จะได้ไม่ค้าง) แต่ไม่แจก XP
    return jsonb_build_object(
      'already_completed', false,
      'daily_limit_reached', true,
      'streak_frozen', false,
      'xp_earned', 0,
      'total_xp', v_profile.total_xp,
      'current_streak', v_profile.current_streak,
      'longest_streak', v_profile.longest_streak,
      'last_quest_date', v_profile.last_quest_date,
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
      'streak_frozen', false,
      'xp_earned', 0,
      'total_xp', v_profile.total_xp,
      'current_streak', v_profile.current_streak,
      'longest_streak', v_profile.longest_streak,
      'last_quest_date', v_profile.last_quest_date,
      'grade', (select grade from public.profiles where id = p_user_id)
    );
  end if;

  -- ── streak: วันเดิม=คงเดิม, เมื่อวาน=+1, อื่น ๆ/null=เริ่มใหม่ที่ 1 ──
  -- ★ streak freeze (จุดขายพรีเมียม): ขาดไป 1 วันพอดี และไม่ได้ใช้ freeze มาแล้วภายใน 7 วัน
  --   → ต่อ streak ให้เหมือนไม่ได้ขาด จำกัดสัปดาห์ละครั้งเพื่อกันเล่นวันเว้นวันแล้วนับติดตลอด
  if v_profile.last_quest_date = p_today then
    v_new_streak := v_profile.current_streak;
  elsif v_profile.last_quest_date = p_today - 1 then
    v_new_streak := v_profile.current_streak + 1;
  elsif v_premium
        and v_profile.last_quest_date = p_today - 2
        and (v_profile.last_streak_freeze_date is null
             or v_profile.last_streak_freeze_date <= p_today - 7) then
    v_new_streak := v_profile.current_streak + 1;
    v_froze := true;
  else
    v_new_streak := 1;
  end if;

  v_new_longest := greatest(v_profile.longest_streak, v_new_streak);

  -- grade = band ที่ min สูงสุดซึ่ง "XP รวมใหม่" ถึง
  select b->>'grade' into v_grade
  from jsonb_array_elements(p_grade_bands) b
  where (b->>'min')::integer <= (v_profile.total_xp + p_xp)
  order by (b->>'min')::integer desc
  limit 1;

  -- บันทึก XP จริงลงแถว completion (ตอนแทรกใส่ 0 ไว้ก่อน — ดูคอมเมนต์ด้านบน)
  update public.quest_completions
  set xp_earned = p_xp
  where user_id = p_user_id and quest_id = p_quest_id;

  update public.profiles
  set total_xp        = total_xp + p_xp,
      current_streak  = v_new_streak,
      longest_streak  = v_new_longest,
      last_quest_date = p_today,
      last_active_at  = now(),
      grade           = coalesce(v_grade, grade),
      last_streak_freeze_date = case when v_froze then p_today else last_streak_freeze_date end
  where id = p_user_id
  returning total_xp into v_new_total;

  insert into public.activity_log (user_id, event_type, metadata)
  values (p_user_id, 'quest_complete', p_metadata);

  return jsonb_build_object(
    'already_completed', false,
    'daily_limit_reached', false,
    'streak_frozen', v_froze,
    'xp_earned', p_xp,
    'total_xp', v_new_total,
    'current_streak', v_new_streak,
    'longest_streak', v_new_longest,
    'last_quest_date', p_today,
    'grade', coalesce(v_grade, 'F')
  );
end;
$$;

revoke execute on function public.complete_quest(uuid, uuid, uuid, integer, jsonb, date, jsonb, jsonb, text, integer, integer)
  from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) โควตาแชท: จองใต้ล็อกก่อนเรียก Gemini (P0 — คนเดียวดูดโควตาทั้งแอพได้)
--
--    เดิม chat.js นับ → เรียก Gemini → ค่อยจด: ยิงขนาน 100 requests อ่านเห็น count=0 ทุกตัว
--    แล้วเข้าเรียก Gemini หมด (ลิมิตจริง 10) โควตาฟรี ~560 req/วันเป็นของทั้งแอพร่วมกัน
--
--    ★ จงใจ "จองแล้วไม่คืน" แม้ Gemini พัง: ถ้าคืนโควตาตอนล้มเหลว คนยิงรัวจะได้ยิงฟรีไม่จำกัด
--      ผู้ใช้เสีย 1 ใน 10 ข้อความตอนระบบล่ม แลกกับการที่โควตาของทุกคนไม่ถูกดูดหมด
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reserve_chat_quota(
  p_user_id       uuid,
  p_day_start     timestamptz,
  p_free_limit    integer default 10,
  p_premium_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile   record;
  v_premium   boolean;
  v_limit     integer;
  v_used      integer;
begin
  -- ล็อกแถว profile ก่อนนับ — คำขอที่ยิงพร้อมกันจะเข้าคิวกันตรงนี้ ไม่ได้เห็น count เดียวกันทั้งหมด
  select is_premium, premium_until
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'ไม่พบโปรไฟล์ผู้ใช้ %', p_user_id;
  end if;

  v_premium := coalesce(v_profile.is_premium, false)
               and v_profile.premium_until is not null
               and v_profile.premium_until > now();

  v_limit := case when v_premium then p_premium_limit else p_free_limit end;

  select count(*) into v_used
  from public.activity_log
  where user_id = p_user_id
    and event_type = 'chat'
    and created_at >= p_day_start;

  if v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'limit', v_limit);
  end if;

  -- ★ จดโควตา "ตอนเริ่มยิง" ไม่ใช่ตอนสำเร็จ — แถวนี้คือตัวจอง
  insert into public.activity_log (user_id, event_type, metadata)
  values (p_user_id, 'chat', jsonb_build_object('reserved_at', now()));

  return jsonb_build_object('allowed', true, 'remaining', v_limit - v_used - 1, 'limit', v_limit);
end;
$$;

revoke execute on function public.reserve_chat_quota(uuid, timestamptz, integer, integer)
  from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) referral: กันชวนไขว้ + เพดานจำนวนคนที่ให้ XP ผู้ชวน (P1)
--
--    เดิม DB การันตีแค่ unique(referred_id) = แต่ละบัญชีถูกชวนได้ครั้งเดียว
--    → A ใช้โค้ด B (+20 ทั้งคู่) แล้ว B ใช้โค้ด A ได้อีก (+20 ทั้งคู่) — ชวนไขว้ปั๊มได้
--    → และหนึ่งโค้ดมีคนกดได้ไม่จำกัด ผู้ชวนได้ +20 ทุกคน (สคริปต์สมัครบัญชีเอาได้เรื่อย ๆ)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.referrals
  drop constraint if exists referrals_no_self;
alter table public.referrals
  add constraint referrals_no_self check (referrer_id <> referred_id);

-- ผู้ชวน 1 คนได้ XP จากการชวนสูงสุดกี่คน (เกินจากนี้ยังบันทึก referral แต่ไม่จ่าย XP ผู้ชวน)
create or replace function public.referrer_reward_cap()
returns integer language sql immutable as $$ select 10 $$;

drop function if exists public.redeem_referral(uuid, uuid, integer);

create or replace function public.redeem_referral(
  p_referrer_id uuid,
  p_referred_id uuid,
  p_bonus       integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred_total_xp integer;
  v_referrer_rewards  integer;
  v_referrer_bonus    integer;
begin
  if p_referrer_id = p_referred_id then
    raise exception 'ใช้ลิงก์ชวนของตัวเองไม่ได้' using errcode = 'check_violation';
  end if;

  -- ★ กันชวนไขว้: ถ้าอีกฝ่ายเคยใช้โค้ดของเรามาแล้ว ห้ามใช้โค้ดเขากลับเพื่อรับ XP รอบสอง
  if exists (
    select 1 from public.referrals
    where referrer_id = p_referred_id and referred_id = p_referrer_id
  ) then
    raise exception 'ชวนกันไปมาไม่ได้' using errcode = 'check_violation';
  end if;

  -- ★ เพดานผู้ชวน: นับใต้ transaction เดียวกับ insert ด้านล่าง จึงกัน race ได้
  select count(*) into v_referrer_rewards
  from public.referrals
  where referrer_id = p_referrer_id and referrer_xp_awarded > 0;

  v_referrer_bonus := case when v_referrer_rewards >= public.referrer_reward_cap() then 0 else p_bonus end;

  insert into public.referrals (referrer_id, referred_id, referrer_xp_awarded, referred_xp_awarded)
  values (p_referrer_id, p_referred_id, v_referrer_bonus, p_bonus);

  update public.profiles
  set total_xp = total_xp + p_bonus, referred_by = p_referrer_id
  where id = p_referred_id
  returning total_xp into v_referred_total_xp;

  if v_referrer_bonus > 0 then
    update public.profiles
    set total_xp = total_xp + v_referrer_bonus
    where id = p_referrer_id;
  end if;

  insert into public.activity_log (user_id, event_type, metadata) values
    (p_referred_id, 'referral_signup', jsonb_build_object('referrer_id', p_referrer_id, 'xp_awarded', p_bonus)),
    (p_referrer_id, 'referral_signup', jsonb_build_object('referred_id', p_referred_id, 'xp_awarded', v_referrer_bonus));

  return jsonb_build_object(
    'referred_total_xp',   v_referred_total_xp,
    'referred_xp_awarded', p_bonus,
    'referrer_xp_awarded', v_referrer_bonus
  );
end;
$$;

revoke execute on function public.redeem_referral(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.referrer_reward_cap() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) สลิปการจ่ายเงิน: เพดานไฟล์ + กันยื่นไฟล์เดิมซ้ำ (P1)
--
--    เดิมลิมิต 5MB + image/* อยู่แค่ในเบราว์เซอร์ (src/pages/Premium.jsx) ยิง storage ตรง ๆ
--    ถมไฟล์อะไรก็ได้เท่าไหร่ก็ได้ใต้โฟลเดอร์ตัวเอง → เต็ม 1GB free tier → ทุกคนอัปสลิปไม่ได้
-- ─────────────────────────────────────────────────────────────────────────────
update storage.buckets
set file_size_limit  = 5242880,   -- 5 MB เท่ากับที่ frontend บอกผู้ใช้ไว้
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
where id = 'payment-slips';

-- สลิปหนึ่งไฟล์ผูกได้กับการจ่ายเงินรายการเดียว — กันเอา path ที่เคยอนุมัติแล้วมายื่นซ้ำ
create unique index if not exists uniq_payment_slip_url
  on public.payments(slip_url)
  where slip_url is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) friendships: ปิด write จาก client (P2)
--
--    ฟีเจอร์เพื่อนยังไม่ได้ทำ frontend ไม่แตะตารางนี้เลย แต่ policy เดิมเปิดให้ผู้ใช้
--    insert แถวโดยไม่บังคับ status='pending' และ update ได้ทุกคอลัมน์
--    → สร้างสถานะ "เป็นเพื่อนกันแล้ว" กับใครก็ได้เอง
--    ทำแบบเดียวกับที่ push_subscriptions ทำไปแล้ว: อ่านได้ เขียนไม่ได้ จนกว่าจะสร้างฟีเจอร์จริง
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "friend_insert_own" on public.friendships;
drop policy if exists "friend_update_involved" on public.friendships;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.5) leaderboard: ป้ายพรีเมียมต้องหายเมื่อหมดอายุ
--      view เดิมส่ง is_premium ดิบ → คนที่หมดอายุแล้วยังติดป้ายอยู่ตลอดไป
--      (คงชื่อ/ลำดับคอลัมน์เดิมเป๊ะ — create or replace view เปลี่ยนชื่อคอลัมน์ไม่ได้)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.leaderboard as
select
  row_number() over (order by total_xp desc, created_at asc) as rank,
  id as user_id,
  display_name,
  avatar_url,
  total_xp,
  current_streak,
  (is_premium and premium_until is not null and premium_until > now()) as is_premium
from public.profiles
where leaderboard_opt_out = false;

grant select on public.leaderboard to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) /stats: ตัวเลขต้องไม่เดินถอยหลังตอนผู้ใช้ลบหัวข้อ (P1)
--
--    quest_completions โดน cascade ตอนลบ roadmap → activated_total / quests_completed_total
--    ที่โชว์หน้า /stats (อาจารย์เปิดดูได้) ลดลงได้ ทั้งที่ XP ของผู้ใช้ยังอยู่
--    xp_awards จงใจไม่มี FK ไป roadmaps จึงอยู่รอด — ใช้เป็นแหล่งนับแทน
-- ─────────────────────────────────────────────────────────────────────────────
--    ★ ต้องคงชื่อ/ลำดับคอลัมน์เดิมเป๊ะ ๆ (create or replace view เปลี่ยนชื่อคอลัมน์ไม่ได้ และ
--      src/pages/Stats.jsx อ่านชื่อเหล่านี้ตรง ๆ) — เปลี่ยนแค่ "แหล่งข้อมูล" ของ 2 บรรทัดแรกเท่านั้น
create or replace view public.public_stats as
select
  (select count(*) from public.profiles) as registered_total,
  (select count(distinct user_id) from public.xp_awards) as activated_total,
  (select count(*) from public.xp_awards) as quests_completed_total,
  (select coalesce(max(longest_streak), 0) from public.profiles) as max_streak,
  (select coalesce(round(avg(current_streak), 1), 0) from public.profiles
     where current_streak > 0) as avg_active_streak,
  (select count(distinct user_id) from public.activity_log
     where created_at >= date_trunc('day', now())) as dau_today;

grant select on public.public_stats to anon, authenticated;

commit;
