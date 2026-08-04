-- Allow one authored starter quest per topic, level, and roadmap day.
-- Existing starter quests are day 1; safe to run repeatedly.

begin;

alter table public.starter_quests
  add column if not exists day_number integer not null default 1;

do $$
declare
  old_constraint text;
begin
  select c.conname
    into old_constraint
  from pg_constraint c
  where c.conrelid = 'public.starter_quests'::regclass
    and c.contype = 'u'
    and pg_get_constraintdef(c.oid) = 'UNIQUE (topic_id, level)';

  if old_constraint is not null then
    execute format('alter table public.starter_quests drop constraint %I', old_constraint);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.starter_quests'::regclass
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (topic_id, level, day_number)'
  ) then
    alter table public.starter_quests
      add constraint starter_quests_topic_level_day_key
      unique (topic_id, level, day_number);
  end if;
end
$$;

commit;
