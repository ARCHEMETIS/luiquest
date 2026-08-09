-- แผนอ่านสอบ v1 — backend ทั้งหมดอยู่ใน Postgres เพื่อไม่ใช้ Netlify/Gemini
-- ไฟล์นี้ตั้งใจให้รันซ้ำได้ และไม่มี client policy สำหรับ insert/update/delete

begin;

create table if not exists public.exam_plans (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  title                    text not null,
  start_date               date not null,
  exam_date                date not null,
  minutes_per_day          smallint not null,
  topics                   text[] not null,
  review_day_count         smallint not null,
  required_minutes_per_day smallint not null,
  schedule_version         smallint not null default 1,
  fit_status               text not null,
  overload_acknowledged_at timestamptz,
  status                   text not null default 'active',
  finished_at              timestamptz,
  archived_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint exam_plans_title_check
    check (char_length(btrim(title)) between 1 and 120),
  constraint exam_plans_date_check
    check (exam_date > start_date),
  constraint exam_plans_minutes_check
    check (minutes_per_day between 15 and 180 and mod(minutes_per_day, 15) = 0),
  constraint exam_plans_topics_check
    check (cardinality(topics) between 1 and 100),
  constraint exam_plans_review_days_check
    check (review_day_count >= 0 and review_day_count < exam_date - start_date),
  constraint exam_plans_required_minutes_check
    check (required_minutes_per_day > 0),
  constraint exam_plans_schedule_version_check
    check (schedule_version = 1),
  constraint exam_plans_fit_status_check
    check (fit_status in ('fits', 'overloaded')),
  constraint exam_plans_fit_ack_check
    check (
      (fit_status = 'fits' and overload_acknowledged_at is null)
      or (fit_status = 'overloaded' and overload_acknowledged_at is not null)
    ),
  constraint exam_plans_status_check
    check (status in ('active', 'finished', 'archived')),
  constraint exam_plans_status_shape_check
    check (
      (status = 'active' and finished_at is null and archived_at is null)
      or (status = 'finished' and finished_at is not null and archived_at is null)
      or (status = 'archived' and archived_at is not null)
    )
);

create index if not exists idx_exam_plans_user_status_exam
  on public.exam_plans(user_id, status, exam_date);

create table if not exists public.exam_plan_items (
  id                      uuid primary key default gen_random_uuid(),
  exam_plan_id            uuid not null references public.exam_plans(id) on delete cascade,
  scheduled_date          date not null,
  kind                    text not null,
  topic_indexes           smallint[] not null,
  topic_minutes           smallint[] not null,
  planned_minutes         smallint not null,
  status                  text not null default 'scheduled',
  completed_at            timestamptz,
  completed_learning_date date,
  skipped_at              timestamptz,
  skip_reason             text,
  reschedule_count        smallint not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint exam_plan_items_kind_check
    check (kind in ('first_pass', 'review')),
  constraint exam_plan_items_allocations_check
    check (
      cardinality(topic_indexes) between 1 and 100
      and cardinality(topic_indexes) = cardinality(topic_minutes)
    ),
  constraint exam_plan_items_minutes_check
    check (planned_minutes > 0),
  constraint exam_plan_items_status_check
    check (status in ('scheduled', 'completed', 'skipped')),
  constraint exam_plan_items_skip_reason_check
    check (skip_reason is null or skip_reason = 'missed'),
  constraint exam_plan_items_reschedule_check
    check (reschedule_count >= 0),
  constraint exam_plan_items_status_shape_check
    check (
      (
        status = 'scheduled'
        and completed_at is null
        and completed_learning_date is null
        and skipped_at is null
        and skip_reason is null
      )
      or (
        status = 'completed'
        and completed_at is not null
        and completed_learning_date is not null
        and skipped_at is null
        and skip_reason is null
      )
      or (
        status = 'skipped'
        and completed_at is null
        and completed_learning_date is null
        and skipped_at is not null
        and skip_reason is not null
      )
    ),
  constraint exam_plan_items_one_day
    unique (exam_plan_id, scheduled_date) deferrable initially immediate
);

create index if not exists idx_exam_plan_items_plan_status_date
  on public.exam_plan_items(exam_plan_id, status, scheduled_date);

-- ledger ต้องอยู่รอดแม้ operational plan ถูกลบ จึงจงใจไม่ใส่ FK สองคอลัมน์นี้
alter table public.xp_awards
  add column if not exists award_kind text not null default 'quest',
  add column if not exists exam_plan_id uuid,
  add column if not exists exam_plan_item_id uuid;

alter table public.xp_awards
  drop constraint if exists xp_awards_kind_check,
  drop constraint if exists xp_awards_exam_source_shape_check;

alter table public.xp_awards
  add constraint xp_awards_kind_check
    check (award_kind in ('quest', 'exam_plan_item')),
  add constraint xp_awards_exam_source_shape_check
    check (
      (
        award_kind = 'quest'
        and exam_plan_id is null
        and exam_plan_item_id is null
      )
      or (
        award_kind = 'exam_plan_item'
        and exam_plan_id is not null
        and exam_plan_item_id is not null
        and roadmap_id is null
        and quest_id is null
      )
    );

create unique index if not exists uniq_xp_award_per_exam_plan_item
  on public.xp_awards(user_id, exam_plan_item_id)
  where award_kind = 'exam_plan_item';

create index if not exists idx_xp_awards_kind_user_date
  on public.xp_awards(award_kind, user_id, award_date);

create or replace function public.exam_plans_topics_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- item ใช้ index แบบคงที่ ถ้าแก้ array ทีหลังชื่อหัวข้อของหลักฐานเก่าจะเปลี่ยนความหมาย
  if new.topics is distinct from old.topics then
    raise exception using errcode = '22023', message = 'EXAM_PLAN_TOPICS_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists exam_plans_topics_immutable_trigger on public.exam_plans;
create trigger exam_plans_topics_immutable_trigger
  before update on public.exam_plans
  for each row execute function public.exam_plans_topics_immutable();

create or replace function public.validate_exam_plan_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.exam_plans%rowtype;
  v_minutes integer;
begin
  select * into v_plan
  from public.exam_plans
  where id = new.exam_plan_id;

  if not found then
    raise exception using errcode = '23503', message = 'EXAM_PLAN_NOT_FOUND';
  end if;
  if v_plan.status = 'archived' then
    raise exception using errcode = '22023', message = 'EXAM_PLAN_ARCHIVED';
  end if;
  if new.scheduled_date < v_plan.start_date or new.scheduled_date >= v_plan.exam_date then
    raise exception using errcode = '23514', message = 'EXAM_PLAN_ITEM_DATE_OUT_OF_RANGE';
  end if;
  if exists (
    select 1 from unnest(new.topic_indexes) as x(value)
    where value is null or value < 1 or value > cardinality(v_plan.topics)
  ) then
    raise exception using errcode = '23514', message = 'EXAM_PLAN_ITEM_TOPIC_OUT_OF_RANGE';
  end if;
  if exists (
    select 1 from unnest(new.topic_minutes) as x(value)
    where value is null or value <= 0
  ) then
    raise exception using errcode = '23514', message = 'EXAM_PLAN_ITEM_MINUTES_INVALID';
  end if;

  select coalesce(sum(value), 0) into v_minutes
  from unnest(new.topic_minutes) as x(value);
  if new.planned_minutes <> v_minutes then
    raise exception using errcode = '23514', message = 'EXAM_PLAN_ITEM_MINUTES_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_exam_plan_item_trigger on public.exam_plan_items;
create constraint trigger validate_exam_plan_item_trigger
  after insert or update on public.exam_plan_items
  deferrable initially immediate
  for each row execute function public.validate_exam_plan_item();

alter table public.exam_plans enable row level security;
alter table public.exam_plan_items enable row level security;

drop policy if exists "exam_plans_select_own" on public.exam_plans;
create policy "exam_plans_select_own"
  on public.exam_plans for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "exam_plan_items_select_own" on public.exam_plan_items;
create policy "exam_plan_items_select_own"
  on public.exam_plan_items for select to authenticated
  using (
    exists (
      select 1 from public.exam_plans p
      where p.id = exam_plan_items.exam_plan_id
        and p.user_id = (select auth.uid())
    )
  );

revoke all on table public.exam_plans, public.exam_plan_items
  from public, anon, authenticated;
grant select on table public.exam_plans, public.exam_plan_items
  to authenticated;

-- pure SQL mirror ของ src/lib/examSchedule.js; client เรียกตรงไม่ได้
create or replace function public.generate_exam_plan_schedule(
  p_start_date date,
  p_exam_date date,
  p_minutes_per_day integer,
  p_topics text[]
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_topic_count integer := cardinality(p_topics);
  v_available_days integer := p_exam_date - p_start_date;
  v_review_days integer;
  v_first_days integer;
  v_first_required integer;
  v_review_required integer;
  v_fits_first boolean;
  v_fits_review boolean;
  v_required_per_day integer;
  v_items jsonb := '[]'::jsonb;
  v_phase integer;
  v_kind text;
  v_minutes_per_topic integer;
  v_phase_days integer;
  v_phase_start integer;
  v_phase_required integer;
  v_phase_fits boolean;
  v_session_budget integer;
  v_session_count integer;
  v_session_index integer;
  v_session_offset integer;
  v_session_left integer;
  v_topic_index integer;
  v_topic_left integer;
  v_take integer;
  v_indexes smallint[];
  v_minutes smallint[];
begin
  if v_topic_count is null or v_topic_count < 1 or v_topic_count > 100 then
    raise exception using errcode = '22023', message = 'INVALID_EXAM_TOPICS';
  end if;
  if v_available_days < 1 then
    raise exception using errcode = '22023', message = 'INVALID_EXAM_DATE';
  end if;
  if p_minutes_per_day < 15 or p_minutes_per_day > 180 or mod(p_minutes_per_day, 15) <> 0 then
    raise exception using errcode = '22023', message = 'INVALID_EXAM_MINUTES';
  end if;

  v_review_days := case
    when v_available_days = 1 then 0
    else least(v_available_days - 1, greatest(1, (v_available_days + 4) / 5))
  end;
  v_first_days := v_available_days - v_review_days;
  v_first_required := v_topic_count * 30;
  v_review_required := case when v_review_days > 0 then v_topic_count * 10 else 0 end;
  v_fits_first := v_first_required <= v_first_days * p_minutes_per_day;
  v_fits_review := v_review_days = 0 or v_review_required <= v_review_days * p_minutes_per_day;
  v_required_per_day := greatest(
    ((v_first_required + (v_first_days * 5) - 1) / (v_first_days * 5)) * 5,
    case when v_review_days > 0
      then ((v_review_required + (v_review_days * 5) - 1) / (v_review_days * 5)) * 5
      else 0
    end
  );

  for v_phase in 1..2 loop
    if v_phase = 1 then
      v_kind := 'first_pass';
      v_minutes_per_topic := 30;
      v_phase_days := v_first_days;
      v_phase_start := 0;
      v_phase_required := v_first_required;
      v_phase_fits := v_fits_first;
    else
      v_kind := 'review';
      v_minutes_per_topic := 10;
      v_phase_days := v_review_days;
      v_phase_start := v_first_days;
      v_phase_required := v_review_required;
      v_phase_fits := v_fits_review;
    end if;

    if v_phase_days = 0 then
      continue;
    end if;

    -- ล้นแล้วไม่ตัดเนื้อหา: ใช้งบจริงที่ปัดขึ้นทีละ 5 นาทีและรายงาน overloaded แยกต่างหาก
    v_session_budget := case when v_phase_fits then p_minutes_per_day
      else ((v_phase_required + (v_phase_days * 5) - 1) / (v_phase_days * 5)) * 5
    end;
    v_session_count := least(
      v_phase_days,
      (v_phase_required + v_session_budget - 1) / v_session_budget
    );
    v_topic_index := 1;
    v_topic_left := v_minutes_per_topic;

    for v_session_index in 0..(v_session_count - 1) loop
      if v_session_count = 1 then
        v_session_offset := case when v_kind = 'review' then v_phase_days - 1 else 0 end;
      else
        v_session_offset := round(
          v_session_index::numeric * (v_phase_days - 1) / (v_session_count - 1)
        )::integer;
      end if;

      v_session_left := v_session_budget;
      v_indexes := '{}'::smallint[];
      v_minutes := '{}'::smallint[];

      while v_session_left > 0 and v_topic_index <= v_topic_count loop
        v_take := least(v_session_left, v_topic_left);
        v_indexes := array_append(v_indexes, v_topic_index::smallint);
        v_minutes := array_append(v_minutes, v_take::smallint);
        v_session_left := v_session_left - v_take;
        v_topic_left := v_topic_left - v_take;

        if v_topic_left = 0 then
          v_topic_index := v_topic_index + 1;
          v_topic_left := v_minutes_per_topic;
        end if;
      end loop;

      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'scheduled_date', p_start_date + v_phase_start + v_session_offset,
        'kind', v_kind,
        'topic_indexes', to_jsonb(v_indexes),
        'topic_minutes', to_jsonb(v_minutes),
        'planned_minutes', coalesce((select sum(x) from unnest(v_minutes) as x), 0)
      ));
    end loop;
  end loop;

  return jsonb_build_object(
    'review_day_count', v_review_days,
    'required_minutes_per_day', v_required_per_day,
    'fit_status', case when v_fits_first and v_fits_review then 'fits' else 'overloaded' end,
    'overloaded', not (v_fits_first and v_fits_review),
    'first_pass_required', v_first_required,
    'review_required', v_review_required,
    'items', v_items
  );
end;
$$;

revoke all on function public.generate_exam_plan_schedule(date, date, integer, text[])
  from public, anon, authenticated;

create or replace function public.list_exam_plans()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Bangkok', now()) - interval '5 hours')::date;
  v_plans jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  -- หลังวันสอบ item ที่ค้างต้องเป็น terminal ด้วย ไม่เช่นนั้น dialog วันขาดจะตามผู้ใช้ตลอดไป
  update public.exam_plan_items i
  set status = 'skipped',
      skipped_at = now(),
      skip_reason = 'missed',
      updated_at = now()
  from public.exam_plans p
  where p.id = i.exam_plan_id
    and p.user_id = v_user_id
    and p.status = 'active'
    and p.exam_date <= v_today
    and i.status = 'scheduled';

  update public.exam_plans p
  set status = 'finished', finished_at = now(), updated_at = now()
  where p.user_id = v_user_id
    and p.status = 'active'
    and (
      p.exam_date <= v_today
      or not exists (
        select 1 from public.exam_plan_items i
        where i.exam_plan_id = p.id and i.status = 'scheduled'
      )
    );

  select coalesce(
    jsonb_agg(
      to_jsonb(p) || jsonb_build_object(
        'items', coalesce((
          select jsonb_agg(to_jsonb(i) order by i.scheduled_date, i.created_at)
          from public.exam_plan_items i
          where i.exam_plan_id = p.id
        ), '[]'::jsonb)
      ) order by p.exam_date, p.created_at
    ),
    '[]'::jsonb
  ) into v_plans
  from public.exam_plans p
  where p.user_id = v_user_id;

  return jsonb_build_object('learning_date', v_today, 'plans', v_plans);
end;
$$;

revoke all on function public.list_exam_plans()
  from public, anon, authenticated;
grant execute on function public.list_exam_plans()
  to authenticated;

create or replace function public.create_exam_plan(
  p_title text,
  p_exam_date date,
  p_minutes_per_day integer,
  p_topics text[],
  p_accept_overload boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Bangkok', now()) - interval '5 hours')::date;
  v_profile record;
  v_topics text[];
  v_title text := btrim(p_title);
  v_schedule jsonb;
  v_plan public.exam_plans%rowtype;
  v_item jsonb;
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  -- ล็อกโปรไฟล์ไว้ก่อนนับแผน — สองคำขอพร้อมกันจะเข้าแถวและเห็น insert ของกันและกันเสมอ ไม่งั้นแหกเพดานได้
  select id into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PROFILE_NOT_FOUND';
  end if;

  if v_title is null or char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception using errcode = '22023', message = 'INVALID_EXAM_TITLE';
  end if;
  if p_exam_date is null or p_exam_date <= v_today then
    raise exception using errcode = '22023', message = 'INVALID_EXAM_DATE';
  end if;
  if p_minutes_per_day is null
      or p_minutes_per_day < 15
      or p_minutes_per_day > 180
      or mod(p_minutes_per_day, 15) <> 0 then
    raise exception using errcode = '22023', message = 'INVALID_EXAM_MINUTES';
  end if;

  select array_agg(topic order by ordinal) into v_topics
  from (
    select btrim(value) as topic, ordinal
    from unnest(p_topics) with ordinality as supplied(value, ordinal)
    where btrim(value) <> ''
  ) normalized;

  if cardinality(v_topics) is null or cardinality(v_topics) < 1 or cardinality(v_topics) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_EXAM_TOPICS';
  end if;
  if exists (select 1 from unnest(v_topics) as x(topic) where char_length(topic) > 200) then
    raise exception using errcode = '22023', message = 'EXAM_TOPIC_TOO_LONG';
  end if;

  -- ★ แผนอ่านสอบเปิดฟรีให้ทุกคน ไม่ผูกกับพรีเมียม (เจ้าของตัดสินใจ 9 ส.ค. 2026 — เดิมฟรีได้ 1 แผน)
  --   แต่ยังต้องมีเพดาน เพราะ RPC นี้เขียนได้ตรงจาก browser และหนึ่งแผนสร้าง item ได้ถึง 100 แถว
  --   ปล่อยไม่จำกัด = endpoint เขียนฐานข้อมูลแบบไร้ก้น 20 แผนพร้อมกันเกินพอสำหรับสอบทั้งเทอม
  if (
    select count(*) from public.exam_plans
    where user_id = v_user_id and status <> 'archived'
  ) >= 20 then
    raise exception using errcode = 'P0001', message = 'EXAM_PLAN_LIMIT';
  end if;

  v_schedule := public.generate_exam_plan_schedule(
    v_today, p_exam_date, p_minutes_per_day, v_topics
  );

  if (v_schedule->>'overloaded')::boolean and not coalesce(p_accept_overload, false) then
    return jsonb_build_object(
      'created', false,
      'code', 'PLAN_OVER_CAPACITY',
      'selected_minutes_per_day', p_minutes_per_day,
      'required_minutes_per_day', (v_schedule->>'required_minutes_per_day')::integer,
      'first_pass_required', (v_schedule->>'first_pass_required')::integer,
      'review_required', (v_schedule->>'review_required')::integer,
      'review_day_count', (v_schedule->>'review_day_count')::integer
    );
  end if;

  insert into public.exam_plans (
    user_id, title, start_date, exam_date, minutes_per_day, topics,
    review_day_count, required_minutes_per_day, fit_status,
    overload_acknowledged_at
  ) values (
    v_user_id, v_title, v_today, p_exam_date, p_minutes_per_day, v_topics,
    (v_schedule->>'review_day_count')::smallint,
    (v_schedule->>'required_minutes_per_day')::smallint,
    v_schedule->>'fit_status',
    case when v_schedule->>'fit_status' = 'overloaded' then now() else null end
  ) returning * into v_plan;

  for v_item in select value from jsonb_array_elements(v_schedule->'items') loop
    insert into public.exam_plan_items (
      exam_plan_id, scheduled_date, kind, topic_indexes, topic_minutes, planned_minutes
    ) values (
      v_plan.id,
      (v_item->>'scheduled_date')::date,
      v_item->>'kind',
      array(select value::smallint from jsonb_array_elements_text(v_item->'topic_indexes') as x(value)),
      array(select value::smallint from jsonb_array_elements_text(v_item->'topic_minutes') as x(value)),
      (v_item->>'planned_minutes')::smallint
    );
  end loop;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.scheduled_date), '[]'::jsonb)
  into v_items
  from public.exam_plan_items i
  where i.exam_plan_id = v_plan.id;

  return jsonb_build_object(
    'created', true,
    'plan', to_jsonb(v_plan),
    'items', v_items
  );
end;
$$;

revoke all on function public.create_exam_plan(text, date, integer, text[], boolean)
  from public, anon, authenticated;
grant execute on function public.create_exam_plan(text, date, integer, text[], boolean)
  to authenticated;

create or replace function public.move_exam_plan_day(
  p_item_id uuid,
  p_scheduled_date date,
  p_conflict_action text default 'reject'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Bangkok', now()) - interval '5 hours')::date;
  v_item record;
  v_conflict public.exam_plan_items%rowtype;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_conflict_action not in ('reject', 'swap') then
    raise exception using errcode = '22023', message = 'INVALID_CONFLICT_ACTION';
  end if;

  select
    i.id, i.exam_plan_id, i.scheduled_date, i.status,
    p.start_date, p.exam_date, p.status as plan_status
  into v_item
  from public.exam_plan_items i
  join public.exam_plans p on p.id = i.exam_plan_id
  where i.id = p_item_id and p.user_id = v_user_id
  for update of p, i;

  if not found then
    raise exception using errcode = 'P0002', message = 'EXAM_PLAN_ITEM_NOT_FOUND';
  end if;
  if v_item.plan_status <> 'active'
      or v_item.exam_date <= v_today
      or v_item.status <> 'scheduled'
      or v_item.scheduled_date < v_today then
    raise exception using errcode = '22023', message = 'EXAM_PLAN_ITEM_NOT_MOVABLE';
  end if;
  if p_scheduled_date is null
      or p_scheduled_date < greatest(v_item.start_date, v_today)
      or p_scheduled_date >= v_item.exam_date then
    raise exception using errcode = '22023', message = 'EXAM_PLAN_MOVE_DATE_OUT_OF_RANGE';
  end if;
  if p_scheduled_date = v_item.scheduled_date then
    select to_jsonb(i) into v_result from public.exam_plan_items i where i.id = p_item_id;
    return jsonb_build_object(
      'moved', true,
      'swapped', false,
      'item', v_result,
      'swapped_item', null
    );
  end if;

  select * into v_conflict
  from public.exam_plan_items
  where exam_plan_id = v_item.exam_plan_id
    and scheduled_date = p_scheduled_date
  for update;

  if v_conflict.id is not null and p_conflict_action = 'reject' then
    return jsonb_build_object(
      'moved', false,
      'code', 'DATE_OCCUPIED',
      'conflicting_item_id', v_conflict.id
    );
  end if;
  if v_conflict.id is not null and v_conflict.status <> 'scheduled' then
    return jsonb_build_object(
      'moved', false,
      'code', 'DATE_OCCUPIED_TERMINAL',
      'conflicting_item_id', v_conflict.id
    );
  end if;

  set constraints public.exam_plan_items_one_day deferred;

  if v_conflict.id is not null then
    update public.exam_plan_items i
    set scheduled_date = v_item.scheduled_date,
        reschedule_count = reschedule_count + 1,
        updated_at = now()
    from public.exam_plans p
    where i.id = v_conflict.id
      and p.id = i.exam_plan_id
      and p.user_id = v_user_id
      and p.status = 'active'
      and i.status = 'scheduled';
  end if;

  update public.exam_plan_items i
  set scheduled_date = p_scheduled_date,
      reschedule_count = reschedule_count + 1,
      updated_at = now()
  from public.exam_plans p
  where i.id = p_item_id
    and p.id = i.exam_plan_id
    and p.user_id = v_user_id
    and p.status = 'active'
    and i.status = 'scheduled';

  select jsonb_build_object(
    'moved', true,
    'swapped', v_conflict.id is not null,
    'item', to_jsonb(i),
    'swapped_item', case when v_conflict.id is null then null else (
      select to_jsonb(other_item) from public.exam_plan_items other_item
      where other_item.id = v_conflict.id
    ) end
  ) into v_result
  from public.exam_plan_items i
  where i.id = p_item_id;

  return v_result;
end;
$$;

revoke all on function public.move_exam_plan_day(uuid, date, text)
  from public, anon, authenticated;
grant execute on function public.move_exam_plan_day(uuid, date, text)
  to authenticated;

create or replace function public.delete_exam_plan_day(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Bangkok', now()) - interval '5 hours')::date;
  v_plan_id uuid;
  v_plan_finished boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  delete from public.exam_plan_items i
  using public.exam_plans p
  where i.id = p_item_id
    and p.id = i.exam_plan_id
    and p.user_id = v_user_id
    and p.status = 'active'
    and p.exam_date > v_today
    and i.status = 'scheduled'
  returning i.exam_plan_id into v_plan_id;

  if v_plan_id is null then
    raise exception using errcode = 'P0002', message = 'EXAM_PLAN_ITEM_NOT_DELETABLE';
  end if;

  update public.exam_plans p
  set status = 'finished', finished_at = now(), updated_at = now()
  where p.id = v_plan_id
    and p.user_id = v_user_id
    and p.status = 'active'
    and not exists (
      select 1 from public.exam_plan_items i
      where i.exam_plan_id = p.id and i.status = 'scheduled'
    );
  v_plan_finished := found;

  return jsonb_build_object(
    'deleted', true,
    'item_id', p_item_id,
    'plan_id', v_plan_id,
    'plan_finished', v_plan_finished
  );
end;
$$;

revoke all on function public.delete_exam_plan_day(uuid)
  from public, anon, authenticated;
grant execute on function public.delete_exam_plan_day(uuid)
  to authenticated;

create or replace function public.resolve_missed_exam_day(
  p_item_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Bangkok', now()) - interval '5 hours')::date;
  v_item record;
  v_delta integer;
  v_shifted jsonb;
  v_plan_finished boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if p_action not in ('shift', 'skip') then
    raise exception using errcode = '22023', message = 'INVALID_MISSED_DAY_ACTION';
  end if;

  select
    i.id, i.exam_plan_id, i.scheduled_date, i.status,
    p.exam_date, p.status as plan_status
  into v_item
  from public.exam_plan_items i
  join public.exam_plans p on p.id = i.exam_plan_id
  where i.id = p_item_id and p.user_id = v_user_id
  for update of p, i;

  if not found then
    raise exception using errcode = 'P0002', message = 'EXAM_PLAN_ITEM_NOT_FOUND';
  end if;
  if v_item.plan_status <> 'active'
      or v_item.exam_date <= v_today
      or v_item.status <> 'scheduled'
      or v_item.scheduled_date >= v_today then
    raise exception using errcode = '22023', message = 'EXAM_PLAN_ITEM_NOT_MISSED';
  end if;

  if p_action = 'skip' then
    update public.exam_plan_items i
    set status = 'skipped', skipped_at = now(), skip_reason = 'missed', updated_at = now()
    from public.exam_plans p
    where i.id = p_item_id
      and p.id = i.exam_plan_id
      and p.user_id = v_user_id
      and p.status = 'active'
      and i.status = 'scheduled'
      and i.scheduled_date < v_today;

    update public.exam_plans p
    set status = 'finished', finished_at = now(), updated_at = now()
    where p.id = v_item.exam_plan_id
      and p.user_id = v_user_id
      and p.status = 'active'
      and not exists (
        select 1 from public.exam_plan_items i
        where i.exam_plan_id = p.id and i.status = 'scheduled'
      );
    v_plan_finished := found;

    return jsonb_build_object(
      'resolved', true,
      'action', 'skip',
      'item_id', p_item_id,
      'plan_finished', v_plan_finished
    );
  end if;

  v_delta := v_today - v_item.scheduled_date;

  if exists (
    select 1
    from public.exam_plan_items i
    where i.exam_plan_id = v_item.exam_plan_id
      and i.status = 'scheduled'
      and i.scheduled_date >= v_item.scheduled_date
      and i.scheduled_date + v_delta >= v_item.exam_date
  ) or exists (
    select 1
    from public.exam_plan_items moving
    join public.exam_plan_items terminal
      on terminal.exam_plan_id = moving.exam_plan_id
     and terminal.scheduled_date = moving.scheduled_date + v_delta
     and terminal.status in ('completed', 'skipped')
    where moving.exam_plan_id = v_item.exam_plan_id
      and moving.status = 'scheduled'
      and moving.scheduled_date >= v_item.scheduled_date
  ) then
    return jsonb_build_object('resolved', false, 'code', 'RESCHEDULE_DOES_NOT_FIT');
  end if;

  set constraints public.exam_plan_items_one_day deferred;

  with shifted as (
    update public.exam_plan_items i
    set scheduled_date = i.scheduled_date + v_delta,
        reschedule_count = i.reschedule_count + 1,
        updated_at = now()
    from public.exam_plans p
    where p.id = i.exam_plan_id
      and p.user_id = v_user_id
      and p.status = 'active'
      and i.exam_plan_id = v_item.exam_plan_id
      and i.status = 'scheduled'
      and i.scheduled_date >= v_item.scheduled_date
    returning i.id, i.scheduled_date, i.reschedule_count
  )
  select coalesce(
    jsonb_agg(to_jsonb(shifted) order by shifted.scheduled_date),
    '[]'::jsonb
  ) into v_shifted
  from shifted;

  return jsonb_build_object(
    'resolved', true,
    'action', 'shift',
    'delta_days', v_delta,
    'items', v_shifted
  );
end;
$$;

revoke all on function public.resolve_missed_exam_day(uuid, text)
  from public, anon, authenticated;
grant execute on function public.resolve_missed_exam_day(uuid, text)
  to authenticated;

create or replace function public.archive_exam_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.exam_plans%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_plan
  from public.exam_plans
  where id = p_plan_id and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'EXAM_PLAN_NOT_FOUND';
  end if;
  if v_plan.status = 'archived' then
    return jsonb_build_object('archived', true, 'already_archived', true, 'plan', to_jsonb(v_plan));
  end if;

  update public.exam_plans
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = p_plan_id and user_id = v_user_id and status <> 'archived'
  returning * into v_plan;

  return jsonb_build_object('archived', true, 'already_archived', false, 'plan', to_jsonb(v_plan));
end;
$$;

revoke all on function public.archive_exam_plan(uuid)
  from public, anon, authenticated;
grant execute on function public.archive_exam_plan(uuid)
  to authenticated;

create or replace function public.complete_exam_plan_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Bangkok', now()) - interval '5 hours')::date;
  v_profile record;
  v_item record;
  v_awards_today integer;
  v_xp_earned integer := 0;
  v_new_streak integer;
  v_new_longest integer;
  v_new_total integer;
  v_premium boolean;
  v_froze boolean := false;
  v_limit_reached boolean := false;
  v_plan_finished boolean := false;
  v_existing_xp integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  -- ใช้ lock เดียวกับ complete_quest เพื่อไม่ให้ XP/streak หรือเพดานสองระบบแข่งกัน
  select
    total_xp, current_streak, longest_streak, last_quest_date,
    is_premium, premium_until, last_streak_freeze_date
  into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PROFILE_NOT_FOUND';
  end if;

  select
    i.id, i.exam_plan_id, i.scheduled_date, i.status as item_status,
    i.planned_minutes, i.completed_learning_date,
    p.title as plan_title, p.exam_date, p.status as plan_status
  into v_item
  from public.exam_plan_items i
  join public.exam_plans p on p.id = i.exam_plan_id
  where i.id = p_item_id and p.user_id = v_user_id
  for update of p, i;

  if not found then
    raise exception using errcode = 'P0002', message = 'EXAM_PLAN_ITEM_NOT_FOUND';
  end if;

  if v_item.item_status = 'completed' then
    select xp into v_existing_xp
    from public.xp_awards
    where user_id = v_user_id
      and exam_plan_item_id = p_item_id
      and award_kind = 'exam_plan_item';

    return jsonb_build_object(
      'already_completed', true,
      'xp_earned', coalesce(v_existing_xp, 0),
      'study_xp_limit_reached', v_existing_xp is null,
      'total_xp', v_profile.total_xp,
      'current_streak', v_profile.current_streak,
      'longest_streak', v_profile.longest_streak,
      'last_quest_date', v_profile.last_quest_date,
      'streak_frozen', false,
      'plan_finished', v_item.plan_status = 'finished'
    );
  end if;

  if v_item.item_status <> 'scheduled'
      or v_item.plan_status <> 'active'
      or v_item.scheduled_date <> v_today
      or v_item.exam_date <= v_today then
    raise exception using errcode = '22023', message = 'EXAM_PLAN_ITEM_NOT_COMPLETABLE';
  end if;

  select count(*) into v_awards_today
  from public.xp_awards
  where user_id = v_user_id
    and award_date = v_today
    and award_kind = 'exam_plan_item';

  if v_awards_today < 3 then
    insert into public.xp_awards (
      user_id, topic_key, award_date, xp, roadmap_id, quest_id,
      award_kind, exam_plan_id, exam_plan_item_id
    ) values (
      v_user_id, 'exam:' || v_item.exam_plan_id::text, v_today, 5, null, null,
      'exam_plan_item', v_item.exam_plan_id, p_item_id
    )
    on conflict do nothing
    returning xp into v_xp_earned;
    v_xp_earned := coalesce(v_xp_earned, 0);
  else
    v_limit_reached := true;
  end if;

  v_premium := coalesce(v_profile.is_premium, false)
    and v_profile.premium_until is not null
    and v_profile.premium_until > now();

  if v_profile.last_quest_date = v_today then
    v_new_streak := v_profile.current_streak;
  elsif v_profile.last_quest_date = v_today - 1 then
    v_new_streak := v_profile.current_streak + 1;
  elsif v_premium
      and v_profile.last_quest_date = v_today - 2
      and (
        v_profile.last_streak_freeze_date is null
        or v_profile.last_streak_freeze_date <= v_today - 7
      ) then
    v_new_streak := v_profile.current_streak + 1;
    v_froze := true;
  else
    v_new_streak := 1;
  end if;
  v_new_longest := greatest(v_profile.longest_streak, v_new_streak);

  update public.exam_plan_items i
  set status = 'completed',
      completed_at = now(),
      completed_learning_date = v_today,
      updated_at = now()
  from public.exam_plans p
  where i.id = p_item_id
    and p.id = i.exam_plan_id
    and p.user_id = v_user_id
    and p.status = 'active'
    and p.exam_date > v_today
    and i.status = 'scheduled'
    and i.scheduled_date = v_today;

  if not found then
    raise exception using errcode = '40001', message = 'EXAM_PLAN_ITEM_CHANGED';
  end if;

  update public.profiles
  set total_xp = total_xp + v_xp_earned,
      current_streak = v_new_streak,
      longest_streak = v_new_longest,
      last_quest_date = v_today,
      last_active_at = now(),
      last_streak_freeze_date = case
        when v_froze then v_today else last_streak_freeze_date
      end
  where id = v_user_id
  returning total_xp into v_new_total;

  insert into public.activity_log (user_id, event_type, metadata)
  values (
    v_user_id,
    'exam_plan_item_complete',
    jsonb_build_object(
      'exam_plan_id', v_item.exam_plan_id,
      'exam_plan_item_id', p_item_id,
      'planned_minutes', v_item.planned_minutes,
      'xp_earned', v_xp_earned,
      'study_xp_limit_reached', v_limit_reached,
      'plan_title', v_item.plan_title
    )
  );

  update public.exam_plans p
  set status = 'finished', finished_at = now(), updated_at = now()
  where p.id = v_item.exam_plan_id
    and p.user_id = v_user_id
    and p.status = 'active'
    and not exists (
      select 1 from public.exam_plan_items i
      where i.exam_plan_id = p.id and i.status = 'scheduled'
    );
  v_plan_finished := found;

  return jsonb_build_object(
    'already_completed', false,
    'xp_earned', v_xp_earned,
    'study_xp_limit_reached', v_limit_reached,
    'total_xp', v_new_total,
    'current_streak', v_new_streak,
    'longest_streak', v_new_longest,
    'last_quest_date', v_today,
    'streak_frozen', v_froze,
    'plan_finished', v_plan_finished
  );
end;
$$;

revoke all on function public.complete_exam_plan_item(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_exam_plan_item(uuid)
  to authenticated;

-- complete_quest เดิมนับ ledger ทุกชนิด จึงต้องเขียนทับให้โควตา quest แยกจาก exam
create or replace function public.complete_quest(
  p_user_id           uuid,
  p_quest_id          uuid,
  p_roadmap_id        uuid,
  p_xp                integer,
  p_checked_items     jsonb,
  p_today             date,
  p_grade_bands       jsonb,
  p_metadata          jsonb,
  p_topic_key         text,
  p_free_allowance    integer default 1,
  p_premium_allowance integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = ''
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
  select total_xp, current_streak, longest_streak, last_quest_date, is_premium, premium_until,
         last_streak_freeze_date
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

  insert into public.quest_completions (user_id, quest_id, roadmap_id, xp_earned, checked_items)
  values (p_user_id, p_quest_id, p_roadmap_id, 0, p_checked_items)
  on conflict (user_id, quest_id) do nothing;

  if not found then
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

  v_allowance := case when v_premium then p_premium_allowance else p_free_allowance end;

  select count(*) into v_awards_today
  from public.xp_awards
  where user_id = p_user_id
    and award_date = p_today
    and award_kind = 'quest';

  if v_awards_today >= v_allowance then
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

  insert into public.xp_awards (
    user_id, topic_key, award_date, xp, roadmap_id, quest_id, award_kind
  ) values (
    p_user_id, p_topic_key, p_today, p_xp, p_roadmap_id, p_quest_id, 'quest'
  )
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

  if v_profile.last_quest_date = p_today then
    v_new_streak := v_profile.current_streak;
  elsif v_profile.last_quest_date = p_today - 1 then
    v_new_streak := v_profile.current_streak + 1;
  elsif v_premium
        and v_profile.last_quest_date = p_today - 2
        and (
          v_profile.last_streak_freeze_date is null
          or v_profile.last_streak_freeze_date <= p_today - 7
        ) then
    v_new_streak := v_profile.current_streak + 1;
    v_froze := true;
  else
    v_new_streak := 1;
  end if;

  v_new_longest := greatest(v_profile.longest_streak, v_new_streak);

  select b->>'grade' into v_grade
  from jsonb_array_elements(p_grade_bands) b
  where (b->>'min')::integer <= (v_profile.total_xp + p_xp)
  order by (b->>'min')::integer desc
  limit 1;

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
      last_streak_freeze_date = case
        when v_froze then p_today else last_streak_freeze_date
      end
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

revoke all on function public.complete_quest(
  uuid, uuid, uuid, integer, jsonb, date, jsonb, jsonb, text, integer, integer
) from public, anon, authenticated;

-- ชื่อและลำดับคอลัมน์เป็น compatibility contract; แยกเฉพาะตัวนับ quest ตามชนิด award
create or replace view public.public_stats as
select
  (select count(*) from public.profiles) as registered_total,
  (select count(distinct user_id) from public.xp_awards) as activated_total,
  (select count(*) from public.xp_awards where award_kind = 'quest') as quests_completed_total,
  (select coalesce(max(longest_streak), 0) from public.profiles) as max_streak,
  (select coalesce(round(avg(current_streak), 1), 0) from public.profiles
     where current_streak > 0) as avg_active_streak,
  (select count(distinct user_id) from public.activity_log
     where created_at >= date_trunc('day', now())) as dau_today;

grant select on public.public_stats to anon, authenticated;

revoke all on function public.exam_plans_topics_immutable()
  from public, anon, authenticated;
revoke all on function public.validate_exam_plan_item()
  from public, anon, authenticated;

commit;
