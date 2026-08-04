# LuiQuest production QA report — 2026-07-23

## Executive result

The production test run was **BLOCKED before the first production HTTP response**. The local runner could not establish outbound HTTPS connections, and the in-app browser was unavailable. Therefore this report contains no evidence-backed production FAIL; converting any case to FAIL would be guessing.

Evidence from the run:

- `node --env-file=.env .scratch/qa-2026-07-23/qa-run.mjs` failed during its initial Supabase preflight. Every preflight query (`profiles`, `roadmaps`, `daily_quests`, `quest_completions`, `referrals`, `chat_messages`) returned `TypeError: fetch failed`.
- Direct `GET https://luiquest.netlify.app/.netlify/functions/me` from PowerShell failed with `Unable to connect to remote server`, before an HTTP status was received.
- A Node `fetch()` to `https://luiquest.netlify.app/` also returned `TypeError: fetch failed`.
- The in-app browser setup returned `No browser is available`; its browser list was empty (`[]`).
- The runner stopped before user creation. It printed empty `PARTIAL CREATED USERS` and `PARTIAL CREATED ROADMAPS` sections.

The QA script passed `node --check` and is at `.scratch/qa-2026-07-23/qa-run.mjs`. It was designed to use at most one freeform creation and ten chat messages, but it reached neither Gemini nor any production mutation.

## Case matrix

| Case | Result | One-line evidence |
|---|---|---|
| 1. Curated onboarding: all levels and 15/30/60 minutes | **BLOCKED** | Initial Supabase preflight could not connect; no `start-roadmap` request received a response. |
| 2. Freeform Thai topic and case/spacing reuse | **BLOCKED** | No `generate-quest` request was sent; Gemini usage was 0. |
| 3. Moderation layer 1 and layer 2 | **BLOCKED** | Neither moderation payload reached production, so rejection code, Gemini spend, and roadmap absence were not observed. |
| 4. Daily loop, checklist gating, XP/streak/grade, double claim, parallel claim | **BLOCKED** | No test user or roadmap existed because preflight stopped before creation. |
| 5. Coach quota, messages 1–11 | **BLOCKED** | No `chat` request was sent; no quota response or 429 was observed. |
| 6. Topic switching, cap, and progress survival | **BLOCKED** | No `switch-roadmap` request was sent. |
| 7. Referral SPA → signup → redeem → XP/count and 7-day window | **BLOCKED** | The live SPA, `me`, `redeem-referral`, `referrals`, and profile-count queries were unreachable. |
| 8. 20+ students and pre-generation pressure | **BLOCKED** | No multi-user production requests or scheduled-function invocation could be executed. |
| 9. Cross-user and anonymous security probes | **BLOCKED** | No authenticated or anonymous Supabase request received a response. |
| 10. Anonymous `/stats` and `/leaderboard` views | **BLOCKED** | No anonymous view query could be made, so totals and personal-data exposure remain unverified. |

## FAIL details

There are no FAIL rows. The required definition here is an actual production break with an actual response; the environment prevented receiving any response. The only observed break is the QA execution environment's outbound connectivity, not a LuiQuest application response.

## Referral assessment (static evidence only)

I cannot honestly classify the production referral metric as “broken” or “merely unused” from this run. The code is wired end-to-end on inspection:

- `src/App.jsx:69-78` uppercases and stores `/invite/<code>` in `localStorage`, then routes to login or quest.
- `src/App.jsx:82-113` calls `redeemReferral` after a session exists, clears the code on 4xx, and retains it for a retry after network/5xx errors.
- `src/components/ProfileDrawer.jsx:193-207` counts the current user's `referrals` rows with an exact head count.
- `netlify/functions/redeem-referral.js:14-29` requires an authenticated POST and enforces `REDEEM_WINDOW_DAYS = 7`.

This is evidence that the flow is not obviously unused in the source. It is not evidence that the deployed build, RLS policy, RPC, signup timing, or UI behavior works. The reported production value of zero referrals remains unverified here.

## Static risks found while preparing the probes (not live FAILs)

1. `netlify/functions/pre-generate-quests.js:12-22` parses an optional body and proceeds with the service-role client without an evident caller authentication or shared-secret check. If the public Netlify function URL is callable, an outsider may be able to trigger Gemini work. Smallest fix: require a scheduler-only secret/internal trigger before any service-role work.

2. `netlify/functions/pre-generate-quests.js:9-10,24-31,102-105` scans at most 60 oldest ready roadmaps and processes only the first 3 eligible roadmaps per run. With more than 60 eligible students, newer students can be skipped repeatedly; even below 60, backlog latency is bounded by three generated quests per ten-minute cron round. Smallest fix: use a durable cursor/queue or increase throughput after measuring the function timeout and Gemini quota.

3. `netlify/functions/_shared/questGenerator.js:255-263` uses the raw freeform title as a PostgREST `ilike` pattern. `%` and `_` are pattern characters, so an unusual title can match another user's same-user roadmap unexpectedly. Smallest fix: escape `\\`, `%`, and `_`, or persist/query a normalized exact-match key with a uniqueness constraint.

4. `netlify/functions/redeem-referral.js:12,26-30` hard-codes the seven-day account-age gate. The boundary and a genuinely old account could not be tested. If seven days is intended, add an automated boundary test; if it is only a temporary rollout guard, move it to configuration rather than silently changing the business rule.

## Test data created

None. No user, roadmap, quest, referral, chat message, completion, or profile row was inserted by this QA run. Consequently there are no user IDs or roadmap IDs to hand to the owner for cleanup. The owner’s post-test database wipe is not needed for this run.

## Must fix before the class gets in

1. Provide a network-enabled runner or browser session and rerun this matrix against the deployed production functions. Referral signup/redeem is the highest-priority unverified business path.
2. Protect `pre-generate-quests` before exposing it to a public caller; it uses the service role and can consume Gemini budget.
3. Run the 20+ student pre-generation test and confirm the three-item batch/60-item scan does not starve students during the class window; add queueing or monitoring if it does.
4. Add a production-safe referral smoke test covering fresh account, lowercase code, duplicate redeem, self-redeem, profile-drawer count, and day-7 boundary.
5. Fix or test exact normalization for freeform roadmap reuse, especially titles containing `%`, `_`, or backslashes.

## Repository safety note

QA only created `.scratch/qa-2026-07-23/qa-run.mjs` and this report. Existing working-tree changes in `src/components/OnboardingFlow.jsx`, `src/components/ProfileDrawer.jsx`, and `src/pages/Onboarding.jsx` were left untouched; no source file was edited, committed, pushed, checked out, or reset.
