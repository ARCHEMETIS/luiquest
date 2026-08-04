-- รวม claim และการเขียน quest/checklist ไว้ที่ DB เพื่อกัน Gemini ซ้ำและเควสเขียนค้างครึ่งเดียว

begin;

create table if not exists public.quest_generation_claims (
  roadmap_id  uuid not null references public.roadmaps(id) on delete cascade,
  day_number  integer not null,
  claim_token uuid not null,
  status      text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  claimed_at  timestamptz not null default now(),
  quest_id    uuid references public.daily_quests(id) on delete set null,
  primary key (roadmap_id, day_number)
);

create index if not exists idx_quest_generation_claims_stale
  on public.quest_generation_claims(status, claimed_at);

alter table public.quest_generation_claims enable row level security;

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

commit;
