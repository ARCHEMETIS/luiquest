# แผนอ่านสอบ (T2) — สเปกสำหรับลงมือ

ออกแบบโดย Codex gpt-5.6-sol (reasoning=max) 9 ส.ค. 2026 จากการอ่านโค้ดจริง
ข้อตัดสินใจที่ล็อกแล้ว: ฟีเจอร์แยก ไม่ใช่ roadmap · ผู้ใช้พิมพ์บทเอง AI ไม่เดาเนื้อหา · เห็นทั้งตาราง+เลื่อนได้ · ให้ XP+streak แต่ไม่กินโควตาเควส · ฟรี 1 วิชา พรีเมียมไม่จำกัด · ขาดวันแล้วถามผู้ใช้

# Exam study planner v1 — implementation spec

Outcome: build `/plan` as a separate feature backed by `exam_plans` and `exam_plan_items`. Reads are owner-scoped; every write goes through a narrowly scoped Postgres RPC called directly from Supabase. This adds zero Netlify invocations and no Gemini dependency.

The production database is `schema.sql` plus every ordered migration, and the repository explicitly warns that the 5 August audit migration overrides several definitions in the base schema. Implement this in a new migration, not only in `schema.sql`. [schema.sql:26](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/schema.sql:26>)

## 1. Data model

The design follows the existing parent/child pattern used by `roadmaps` and `daily_quests`, including UUID keys, profile ownership, cascaded operational data, timestamps, checks, and per-parent uniqueness. [schema.sql:91](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/schema.sql:91>) [schema.sql:154](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/schema.sql:154>)

### `exam_plans`

```sql
create table public.exam_plans (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null
                             references public.profiles(id) on delete cascade,

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
    check (
      minutes_per_day between 15 and 180
      and mod(minutes_per_day, 15) = 0
    ),

  constraint exam_plans_topics_check
    check (cardinality(topics) between 1 and 100),

  constraint exam_plans_review_days_check
    check (
      review_day_count >= 0
      and review_day_count < exam_date - start_date
    ),

  constraint exam_plans_required_minutes_check
    check (required_minutes_per_day > 0),

  constraint exam_plans_schedule_version_check
    check (schedule_version = 1),

  constraint exam_plans_fit_status_check
    check (fit_status in ('fits', 'overloaded')),

  constraint exam_plans_fit_ack_check
    check (
      (fit_status = 'fits' and overload_acknowledged_at is null)
      or
      (fit_status = 'overloaded' and overload_acknowledged_at is not null)
    ),

  constraint exam_plans_status_check
    check (status in ('active', 'finished', 'archived')),

  constraint exam_plans_status_shape_check
    check (
      (status = 'active'
        and finished_at is null
        and archived_at is null)
      or
      (status = 'finished'
        and finished_at is not null
        and archived_at is null)
      or
      (status = 'archived'
        and archived_at is not null)
    )
);

create index idx_exam_plans_user_status_exam
  on public.exam_plans(user_id, status, exam_date);
```

Rules enforced inside `create_exam_plan`, in addition to the SQL checks:

- Trim each input line and remove blank lines.
- Preserve input order and duplicate lines; duplicate course-outline entries might be intentional.
- Reject a line longer than 200 characters.
- Set `start_date` from the database learning day, never from the browser clock.
- Never permit `topics` to be updated after creation. Stable one-based indexes are used by item rows.
- `finished` is set when all remaining items are terminal or when the exam date arrives. `list_exam_plans` performs this finalization lazily so no cron or Netlify function is required.
- `archived` is irreversible in v1 and frees the user’s plan slot without deleting study history.

### `exam_plan_items`

One row is one study day. It can contain several allocations, but there is at most one row per plan/date. This aligns completion and XP with a daily study task rather than every chapter fragment.

```sql
create table public.exam_plan_items (
  id                      uuid primary key default gen_random_uuid(),
  exam_plan_id            uuid not null
                            references public.exam_plans(id) on delete cascade,

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
      (status = 'scheduled'
        and completed_at is null
        and completed_learning_date is null
        and skipped_at is null
        and skip_reason is null)
      or
      (status = 'completed'
        and completed_at is not null
        and completed_learning_date is not null
        and skipped_at is null
        and skip_reason is null)
      or
      (status = 'skipped'
        and completed_at is null
        and completed_learning_date is null
        and skipped_at is not null
        and skip_reason is not null)
    ),

  constraint exam_plan_items_one_day
    unique (exam_plan_id, scheduled_date)
    deferrable initially immediate
);

create index idx_exam_plan_items_plan_status_date
  on public.exam_plan_items(exam_plan_id, status, scheduled_date);
```

Add a constraint trigger covering cross-table/array invariants:

- `scheduled_date >= exam_plans.start_date`.
- `scheduled_date < exam_plans.exam_date`.
- Every `topic_indexes` value is between `1` and `cardinality(exam_plans.topics)`.
- Every `topic_minutes` value is positive.
- `planned_minutes = sum(topic_minutes)`.
- The parent plan is not archived when inserting or changing an item.

The deferred unique constraint is required so an occupied-date move can atomically swap two dates.

### Extend `xp_awards`

`xp_awards` currently deliberately keeps `roadmap_id` and `quest_id` as raw UUIDs without foreign keys so deleting a roadmap cannot delete earned-XP evidence. [schema.sql:211](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/schema.sql:211>) Its rows are also now the durable source for public completion metrics. [2026-08-05-audit-fixes.sql:426](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/migrations/2026-08-05-audit-fixes.sql:426>)

Extend it rather than creating a disconnected XP ledger:

```sql
alter table public.xp_awards
  add column award_kind text not null default 'quest',
  add column exam_plan_id uuid,
  add column exam_plan_item_id uuid,

  add constraint xp_awards_kind_check
    check (award_kind in ('quest', 'exam_plan_item')),

  add constraint xp_awards_exam_source_shape_check
    check (
      (
        award_kind = 'quest'
        and exam_plan_id is null
        and exam_plan_item_id is null
      )
      or
      (
        award_kind = 'exam_plan_item'
        and exam_plan_id is not null
        and exam_plan_item_id is not null
        and roadmap_id is null
        and quest_id is null
      )
    );

create unique index uniq_xp_award_per_exam_plan_item
  on public.xp_awards(user_id, exam_plan_item_id)
  where award_kind = 'exam_plan_item';

create index idx_xp_awards_kind_user_date
  on public.xp_awards(award_kind, user_id, award_date);
```

Do **not** add foreign keys from these two new ledger columns to `exam_plans` or `exam_plan_items`. Operational items may cascade when a plan is eventually deleted, but award evidence must survive deletion to stop delete/recreate/re-award attacks. This is the same lesson already documented for both `xp_awards` and write-once learning evidence. [schema.sql:225](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/schema.sql:225>) [2026-08-05-learning-signals.sql:14](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/migrations/2026-08-05-learning-signals.sql:14>)

For exam awards, set:

```text
topic_key = "exam:" + exam_plan_id
award_kind = "exam_plan_item"
roadmap_id = null
quest_id = null
```

## 2. RLS and write authority

The learner must **not write either table directly**. Reads may be direct, but creates, moves, deletes, missed-day resolutions, archive operations, and completions all go through Postgres functions.

That follows the existing rule that reward-bearing rows and reward prerequisites are read-only to the client: `daily_quests` cannot be client-written because a user could choose their own reward, while `xp_awards` intentionally has no client write policy. [schema.sql:882](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/schema.sql:882>) [schema.sql:897](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/schema.sql:897>) The retained direct-upload exception is storage for payment slips, where ownership and file constraints are deliberately different. [2026-08-04-rls-close-client-writes.sql:42](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/migrations/2026-08-04-rls-close-client-writes.sql:42>)

Use these policies:

```sql
alter table public.exam_plans enable row level security;
alter table public.exam_plan_items enable row level security;

create policy "exam_plans_select_own"
  on public.exam_plans
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "exam_plan_items_select_own"
  on public.exam_plan_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.exam_plans p
      where p.id = exam_plan_items.exam_plan_id
        and p.user_id = (select auth.uid())
    )
  );

revoke insert, update, delete
  on public.exam_plans, public.exam_plan_items
  from anon, authenticated;

grant select
  on public.exam_plans, public.exam_plan_items
  to authenticated;
```

There are intentionally no insert/update/delete policies.

All mutating RPCs must:

- Be `SECURITY DEFINER` only because they must update protected rows.
- Use fully qualified names and `SET search_path = ''`.
- Reject a null `auth.uid()`.
- Derive `user_id` from `auth.uid()`; never accept `p_user_id`.
- Never accept XP, award date, completion time, status, or premium status from the caller.
- Re-check ownership in the actual mutation query.
- Be revoked from `PUBLIC` and `anon`, then granted only to `authenticated`.

Example privilege pattern:

```sql
revoke all on function public.complete_exam_plan_item(uuid)
  from public, anon, authenticated;

grant execute on function public.complete_exam_plan_item(uuid)
  to authenticated;
```

This is safer than exposing the current `complete_quest` RPC directly: that RPC accepts sensitive arguments and is explicitly revoked from clients, with Netlify performing ownership/checklist validation first. [complete-quest.js:35](<C:/Users/Pc/Desktop/app machine learning/new app/netlify/functions/complete-quest.js:35>) [2026-08-05-audit-fixes.sql:231](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/migrations/2026-08-05-audit-fixes.sql:231>)

## 3. XP and streak without consuming quest allowance

### Exact reward contract

- One completed exam-plan day: **5 XP**.
- Separate anti-farm limit: at most **3 XP-paying exam-plan days per user per learning day**.
- This limit is independent of free/premium quest allowances.
- The fourth exam-plan completion that day is still recorded as completed but returns `xp_earned = 0` and `study_xp_limit_reached = true`.
- Free users have one plan and one item per plan/date, so their normal completion always earns XP. The three-item cap mainly bounds premium users with multiple plans.

The cap is necessary: “premium unlimited plans” plus an unlimited XP route would let a user create many plans and farm the leaderboard. Fixed XP, due-date validation, write-once evidence, and a separate global cap bound that second route to 15 XP/day.

### Required `complete_quest` change

The current quest cap counts every `xp_awards` row for the user/date. [2026-08-05-audit-fixes.sql:130](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/migrations/2026-08-05-audit-fixes.sql:130>) Change it to:

```sql
select count(*) into v_awards_today
from public.xp_awards
where user_id = p_user_id
  and award_date = p_today
  and award_kind = 'quest';
```

Quest rows keep the default `award_kind='quest'`. Exam completion instead counts only:

```sql
where user_id = v_user_id
  and award_date = v_today
  and award_kind = 'exam_plan_item'
```

Therefore an exam completion neither increments nor consumes `p_free_allowance=1` or `p_premium_allowance=3`, which remain quest-only parameters. [2026-08-05-audit-fixes.sql:55](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/migrations/2026-08-05-audit-fixes.sql:55>)

### Atomic completion transaction

`complete_exam_plan_item(p_item_id uuid)` must perform this order:

1. Derive `v_user_id := auth.uid()` and the learning date:
   ```sql
   (timezone('Asia/Bangkok', now()) - interval '5 hours')::date
   ```
   This mirrors the existing 05:00 Bangkok learning-day boundary. [datetime.js:37](<C:/Users/Pc/Desktop/app machine learning/new app/netlify/functions/_shared/datetime.js:37>)

2. Lock the caller’s `profiles` row `FOR UPDATE` **before anything else**. The audited quest implementation uses this lock to serialize allowance checks and XP increments. [2026-08-05-audit-fixes.sql:85](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/migrations/2026-08-05-audit-fixes.sql:85>)

3. Lock the item and join its plan, requiring:

   - `plan.user_id = v_user_id`.
   - Plan status is `active`.
   - Item status is `scheduled`.
   - `scheduled_date = v_today`; future items cannot be completed early, and missed items must first be resolved.
   - `exam_date > v_today`.

4. If already completed, return the existing result without another award.

5. Count today’s `award_kind='exam_plan_item'` rows.

6. If below three, insert one ledger row with fixed `xp=5` using `ON CONFLICT DO NOTHING`. The partial unique index makes replay write-once.

7. Change the item from `scheduled` to `completed`, setting `completed_at` and `completed_learning_date`. This transition is one-way.

8. Update `profiles.total_xp`, `current_streak`, `longest_streak`, `last_quest_date`, `last_active_at`, and streak-freeze state in the same transaction.

9. Insert `activity_log.event_type='exam_plan_item_complete'`, including plan/item IDs, planned minutes, award result, and plan-title snapshot.

10. Mark the plan `finished` if no scheduled items remain.

Use the exact audited streak rules:

- Same learning date: streak unchanged.
- Previous date: `+1`.
- Two-day gap for active premium, with no freeze in the previous seven days: `+1` and consume freeze.
- Otherwise: restart at `1`.

Those rules and profile updates currently live together in the audited RPC. [2026-08-05-audit-fixes.sql:172](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/migrations/2026-08-05-audit-fixes.sql:172>) Reuse the existing misnamed `last_quest_date` for v1; it becomes “last streak-qualifying learning date.”

Do not accept grade bands from the browser. Return the new `total_xp`; the frontend already derives rank from total XP because stored `profiles.grade` can be stale. [gradeBands.js:85](<C:/Users/Pc/Desktop/app machine learning/new app/src/lib/gradeBands.js:85>) [ProfileDrawer.jsx:219](<C:/Users/Pc/Desktop/app machine learning/new app/src/components/ProfileDrawer.jsx:219>)

Finally, keep `public_stats.quests_completed_total` quest-only by filtering `award_kind='quest'`; otherwise the existing metric silently changes meaning. Its name and column order are currently treated as a compatibility contract. [2026-08-05-audit-fixes.sql:432](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/migrations/2026-08-05-audit-fixes.sql:432>)

## 4. Deterministic scheduling algorithm

Gemini is not used in v1. The canonical algorithm belongs in one owner-only SQL helper called by `create_exam_plan`; the browser never supplies generated item rows.

### Normalization and estimates

- Preserve supplied topic order.
- Each input line is one equal-weight syllabus unit.
- First-pass estimate: **30 minutes per topic**.
- Tail review estimate: **10 minutes per topic**.
- Explain this estimate before creation. A learner can split a large chapter into multiple lines to give it more weight.
- The exam date itself is never a study date.

Let:

```text
N = number of normalized topics
D = exam_date - start_date
M = minutes_per_day
```

Require `D >= 1`.

Review tail:

```text
if D = 1:
  R = 0
else:
  R = min(D - 1, max(1, ceil(D * 0.20)))

F = D - R
```

Thus the last 20% of available days, rounded up, is reserved for review; a one-day emergency plan has no review and shows that warning explicitly.

Required effort:

```text
first_required  = N * 30
review_required = R > 0 ? N * 10 : 0

fits_first  = first_required  <= F * M
fits_review = review_required <= R * M   // true when R = 0

fit_status = fits_first && fits_review ? "fits" : "overloaded"

required_minutes_per_day =
  max(
    ceil_to_5(first_required / F),
    R > 0 ? ceil_to_5(review_required / R) : 0
  )
```

### Distribution

For each phase—first pass, then review:

1. Create a work stream in the learner’s supplied topic order.
2. Determine the session budget:

   - If that phase fits: `M`.
   - If overloaded: `ceil_to_5(required_minutes / available_phase_days)`.

3. Determine sessions:

   ```text
   sessions = min(available_phase_days, ceil(required_minutes / session_budget))
   ```

4. Spread those sessions evenly across the phase:

   - One first-pass session uses the first phase date.
   - One review session uses the final day before the exam.
   - Otherwise use offsets `round(k × (phase_days - 1) / (sessions - 1))`.

5. Sequentially pack topic minutes into those sessions. A topic may span two dates; both item rows reference the same topic index and contain only the allocated minutes.

The creation result is deterministic for `(start_date, exam_date, minutes_per_day, normalized topics, schedule_version)`.

### Cannot-fit behavior

Never omit a topic and never silently reduce review.

The first call with `p_accept_overload=false` returns without inserting:

```json
{
  "created": false,
  "code": "PLAN_OVER_CAPACITY",
  "selected_minutes_per_day": 30,
  "required_minutes_per_day": 50,
  "first_pass_required": 150,
  "review_required": 50
}
```

The UI says:

> แผนนี้ต้องใช้ประมาณ 50 นาที/วัน แต่คุณเลือก 30 นาที/วัน

Choices:

- `ปรับเป็น 60 นาที`
- `แก้รายการหัวข้อ`
- `สร้างแผนแน่นนี้ต่อ`

The final choice retries with `p_accept_overload=true`; overloaded items retain their actual `planned_minutes` and receive a visible warning.

Correctness without Gemini follows from two invariants:

- For every input topic index, first-pass allocations sum to exactly 30 minutes.
- If review exists, review allocations sum to exactly 10 minutes.

No allocation may contain an index outside `1..N`. Therefore every displayed title comes from `exam_plans.topics[index-1]`, and Gemini availability cannot affect correctness.

## 5. Missed-day flow

On page load, find the oldest item where:

```text
status = scheduled
scheduled_date < current learning day
```

Show the missed date and assigned topics, then ask exactly:

> เลื่อนหรือข้าม?

Buttons:

- `เลื่อนแผนที่เหลือ`
- `ข้ามวันนี้`
- A non-decision close control may dismiss the dialog, but it performs no mutation and the question returns later.

### เลื่อนแผนที่เหลือ

`resolve_missed_exam_day(item_id, 'shift')`:

1. Re-check that the item belongs to the caller and is still overdue/scheduled.
2. Calculate:
   ```text
   delta = current_learning_day - missed_item.scheduled_date
   ```
3. Shift the missed item and every later `scheduled` item forward by `delta`.
4. Do not change topic allocations, kinds, minutes, completion state, or item IDs.
5. Apply all dates atomically using the deferrable unique constraint.
6. If any destination is on/after the exam date, or collides with a completed/skipped item, reject the entire operation with `RESCHEDULE_DOES_NOT_FIT`.

On rejection, say:

> เลื่อนไม่ได้ เพราะวันสุดท้ายจะชนวันสอบ กรุณาข้ามวันนี้ หรือลบ/ย้ายวันอื่นด้วยตัวเอง

Nothing is silently compressed or repacked.

### ข้ามวันนี้

`resolve_missed_exam_day(item_id, 'skip')` changes only that row to:

```text
status = skipped
skipped_at = now()
skip_reason = missed
```

It gives no XP, does not affect streak, and leaves every later date untouched. If another overdue row exists, ask again.

Manual day deletion physically deletes only a `scheduled` item after confirmation and never redistributes its topics. Completed or skipped days cannot be moved or deleted in v1.

## 6. API surface and invocation cost

Put direct Supabase wrappers in `src/lib/examPlanApi.js`, beside the existing `api.js`. Do not add them to `api.js`, because that module is explicitly a Netlify-function client. [api.js:1](<C:/Users/Pc/Desktop/app machine learning/new app/src/lib/api.js:1>)

| Client call | Database operation | Read/write |
|---|---|---|
| `listExamPlans()` | `rpc('list_exam_plans')`; lazily marks expired plans finished and returns plans/items | Read + idempotent lifecycle write |
| `createExamPlan(input)` | `rpc('create_exam_plan', input)` | Write |
| `moveDay(itemId, date, conflictAction)` | `rpc('move_exam_plan_day', …)`; `conflictAction='reject'|'swap'` | Write |
| `deleteDay(itemId)` | `rpc('delete_exam_plan_day', …)` | Write |
| `resolveMissedDay(itemId, action)` | `rpc('resolve_missed_exam_day', …)` | Write |
| `completeDay(itemId)` | `rpc('complete_exam_plan_item', …)` | XP/streak write |
| `archivePlan(planId)` | `rpc('archive_exam_plan', …)` | Write |

All are direct Supabase requests authenticated by the current session. The frontend already performs owner-scoped direct Supabase reads where RLS is sufficient. [Quest.jsx:153](<C:/Users/Pc/Desktop/app machine learning/new app/src/pages/Quest.jsx:153>)

Feature-specific Netlify cost: **0 invocations per exam**.

Typical 14-study-day plan:

```text
1 create
14 page reads
14 completions
1 archive
= 30 Supabase API calls
= 0 Netlify function invocations
= 0 Gemini calls
```

An overloaded plan adds one rejected preview/create RPC. Moves, skips, and deletes add one Supabase RPC each.

The existing `/me` call still occurs once when the shared profile provider loads, but adding `/plan` under that provider does not add another `/me` per action. [useProfile.jsx:26](<C:/Users/Pc/Desktop/app machine learning/new app/src/hooks/useProfile.jsx:26>) On completion, patch profile state from the RPC response instead of refetching, matching the quest completion optimization. [Quest.jsx:263](<C:/Users/Pc/Desktop/app machine learning/new app/src/pages/Quest.jsx:263>)

## 7. `/plan` UI and file placement

### Route and discovery

- Add `src/pages/Plan.jsx` beside `Quest.jsx`.
- Add `src/components/ExamPlanPage.jsx` beside `DailyQuestPage.jsx`.
- Add the authenticated `/plan` route under `AppShellLayout` beside `/quest`, `/coach`, and `/leaderboard`. The current nested route seam is in `App.jsx`. [App.jsx:37](<C:/Users/Pc/Desktop/app machine learning/new app/src/App.jsx:37>)
- Add a fourth bottom-nav item, `แผนสอบ`, in `AppShellLayout.jsx`.
- The shell already derives grid width and active position from `NAV_ITEMS.length`, so adding a fourth entry needs no layout rewrite. [AppShellLayout.jsx:57](<C:/Users/Pc/Desktop/app machine learning/new app/src/components/AppShellLayout.jsx:57>) [AppShellLayout.jsx:179](<C:/Users/Pc/Desktop/app machine learning/new app/src/components/AppShellLayout.jsx:179>)

### Empty/create state

Fields:

- `ชื่อวิชา/การสอบ`
- `วันสอบ`
- `เวลาอ่านต่อวัน`: 15–180 minutes in 15-minute steps
- `บท/หัวข้อ — หนึ่งบรรทัดต่อหนึ่งหัวข้อ`
- Live count: `12 หัวข้อ`
- Visible estimate: `v1 ประมาณ 30 นาทีต่อหัวข้อ + ทบทวน 10 นาที`
- Primary button: `สร้างแผนอ่านสอบ`

Do not add notes, descriptions, editors, uploads, or generated lesson content.

### Existing-plan state

Top summary:

- Exam title and date.
- Days remaining.
- Selected minutes/day.
- Fit or overload state.
- Plan selector for premium users with multiple plans.
- `สร้างแผนเพิ่ม`; free users with an existing non-archived plan receive the premium gate.

Below it, render the entire chronological schedule:

- Date and Thai weekday.
- `อ่านครั้งแรก` or `ทบทวน`.
- Every allocated learner-supplied topic and minutes.
- Total planned minutes.
- Status badge: today, upcoming, missed, completed, skipped, overloaded.
- Actions: move, delete, and complete where valid.

Use a date picker and atomic swap for v1; drag-and-drop is unnecessary.

After completion, display `+5 XP` and the updated streak, patching `useProfile` with the RPC response. Reuse the current card colors, rounded shapes, typography, loading/error states, and existing `/premium` upgrade destination. The profile drawer already uses the live premium-expiry check and routes its upgrade CTA to `/premium`. [ProfileDrawer.jsx:202](<C:/Users/Pc/Desktop/app machine learning/new app/src/components/ProfileDrawer.jsx:202>) [ProfileDrawer.jsx:543](<C:/Users/Pc/Desktop/app machine learning/new app/src/components/ProfileDrawer.jsx:543>)

## 8. Free/premium gate

Definition:

- Free: at most **one non-archived exam plan**.
- Premium active: unlimited non-archived plans.
- A finished plan still occupies the free slot until archived.
- Archiving frees the slot but is irreversible in v1.
- If premium expires, existing plans are not deleted or automatically archived. The learner may keep using them, but cannot create another until the free count is below one.

Enforce this inside `create_exam_plan`, not in React or JavaScript:

1. `SELECT` the caller’s profile `FOR UPDATE`.
2. Determine active premium using both `is_premium` and unexpired `premium_until`, matching the audited helper. [2026-08-05-audit-fixes.sql:26](<C:/Users/Pc/Desktop/app machine learning/new app/supabase/migrations/2026-08-05-audit-fixes.sql:26>)
3. If not premium, count caller-owned plans where `status <> 'archived'`.
4. If count is at least one, raise `FREE_EXAM_PLAN_LIMIT`.
5. Insert the plan and all item rows in the same RPC transaction.

Two concurrent create calls serialize on the same profile row. The second observes the first insert and fails. There is no direct insert permission to bypass the function.

This deliberately fixes the pattern used by the saved-roadmap cap, which currently counts in JavaScript and inserts later, leaving a race window. [questGenerator.js:82](<C:/Users/Pc/Desktop/app machine learning/new app/netlify/functions/_shared/questGenerator.js:82>)

React may show the gate early for good UX, but the database result is authoritative.

## 9. Explicitly out of scope for v1

- Roadmap integration, active-roadmap switching, carry-over, roadmap caps, or roadmap terminal-state changes.
- Gemini or any AI-generated/researched syllabus content.
- AI prerequisite inference or difficulty weighting.
- Topic editing after plan creation.
- Notes, rich text, files, links, flashcards, quizzes, or lesson content.
- Automatic rescheduling or silent schedule compression.
- Calendar sync, notifications, push reminders, or recurring exams.
- Blackout days, weekends-off settings, exam time-of-day, or non-Bangkok timezone settings.
- Drag-and-drop; date picker plus swap is sufficient.
- Completing individual topic fragments inside a day; the day is the completion/XP unit.
- Moving/deleting completed or skipped history.
- Unarchiving an archived plan.
- Sharing or collaborative plans.
- New public stats fields for exam activity.
- Renaming `profiles.last_quest_date`; v1 reuses it as the streak date.

## 10. Solo-owner build order

1. **Add scheduler test vectors first.** Cover one-day plans, the 20% tail, topic splitting, even date spreading, duplicate Thai topics, overload detection, and the two allocation-sum invariants. Use the repository’s existing `node:test`/strict-assertion style where a pure helper is useful. [complete-quest.test.mjs:1](<C:/Users/Pc/Desktop/app machine learning/new app/netlify/functions/_shared/complete-quest.test.mjs:1>) [datetime.test.mjs:1](<C:/Users/Pc/Desktop/app machine learning/new app/netlify/functions/_shared/datetime.test.mjs:1>)

2. **Deploy the additive database migration.** Add the two tables, indexes, constraint trigger, RLS, `xp_awards` discriminator, and quest-only metric filters. The existing app remains functional because old/new quest inserts default to `award_kind='quest'`.

3. **Add and verify read/create RPCs.** Test normal creation, overload-without-write, accepted overload, invalid topics/dates, premium expiry, and terminal status after the exam. Keep the route hidden.

4. **Prove the free gate under concurrency.** Two simultaneous free create calls must produce exactly one plan and one `FREE_EXAM_PLAN_LIMIT` result.

5. **Add move/delete/missed/archive RPCs.** Verify swap atomicity, no partial shift when the exam boundary is hit, skip leaves later dates unchanged, and only scheduled items are mutable.

6. **Add completion last on the database side.** Verify:

   - Double-submit produces one ledger row and one XP increment.
   - Another user’s item is indistinguishable from missing.
   - A future or overdue item cannot be completed.
   - Exam completion followed by quest completion still earns quest XP.
   - Quest completion followed by exam completion still earns exam XP.
   - Concurrent quest/exam completion loses neither update.
   - A fourth exam award that day completes with zero additional XP.
   - Deleting operational plan data does not delete its award ledger.

7. **Add `src/lib/examPlanApi.js`.** Exercise every RPC contract without changing navigation.

8. **Build `Plan.jsx` and `ExamPlanPage.jsx`.** First ship create/read/full schedule, then move/delete, missed modal, completion celebration, archive, and error states.

9. **Add `/plan` as a hidden authenticated route.** Test direct URL, refresh, expired session, mobile overflow, and a user with no roadmap. Exam plans are independent of onboarding roadmap state.

10. **Expose the fourth bottom-nav tab and premium upsell last.** At that point every visible action has a working backend. Run the normal build plus scheduler, RLS, concurrency, completion, and 04:59/05:00 Bangkok boundary checks.

No files were modified, no Git commands were run, and no network access was attempted.
