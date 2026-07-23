-- ล็อกคอลัมน์ server-owned ของ profiles — client แก้ได้เฉพาะชื่อ รูป และ leaderboard opt-out
-- drop/recreate ทำให้ migration รันซ้ำได้ และ service-role/RPC ยังเขียน progress ได้เพราะ bypass RLS
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_premium     = (select is_premium     from public.profiles where id = auth.uid())
    and premium_until  is not distinct from (select premium_until  from public.profiles where id = auth.uid())
    and is_admin       = (select is_admin       from public.profiles where id = auth.uid())
    and total_xp       = (select total_xp       from public.profiles where id = auth.uid())
    and current_streak = (select current_streak from public.profiles where id = auth.uid())
    and longest_streak  = (select longest_streak  from public.profiles where id = auth.uid())
    and last_quest_date is not distinct from (select last_quest_date from public.profiles where id = auth.uid())
    and last_active_at  is not distinct from (select last_active_at  from public.profiles where id = auth.uid())
    and grade           is not distinct from (select grade           from public.profiles where id = auth.uid())
    and referral_code   = (select referral_code   from public.profiles where id = auth.uid())
    and referred_by     is not distinct from (select referred_by     from public.profiles where id = auth.uid())
    and created_at      = (select created_at      from public.profiles where id = auth.uid())
  );
