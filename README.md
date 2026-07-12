# Quest Learning App *(working title)*

> A gamified, AI-assisted micro-learning app that turns any topic into a daily quest — built to run entirely on free-tier infrastructure.

**Status:** 🧭 Spec-driven planning phase. This repository is currently being scoped ticket-by-ticket before implementation; see [`docs/planning`](docs/planning). Application code lands here as the spec is finalized.

---

## The idea

Most people who want to learn a skill quit because a full course feels overwhelming and progress is invisible. This app breaks a topic into **one bite-sized quest per day**, tracks streaks and XP like a game, and offers an AI coach when the learner gets stuck — so momentum, not willpower, carries them forward.

It grew out of an earlier single-user prototype, **[ML Quest](https://github.com/ARCHEMETIS/ml-quest-master)**, which generated a daily Machine-Learning study plan for one user. This project generalizes that concept into a **multi-user, multi-topic** product.

## Planned features (MVP)

- **Curated + open-ended topics** — a set of hand-picked learning tracks (Python, Data/ML, web dev, using AI, spreadsheets, personal finance) plus a free-form option where the learner types any topic and an LLM drafts a roadmap.
- **Daily quests** — each roadmap is broken into short, concrete daily tasks with linked, verified learning resources.
- **Gamification** — XP, streaks, and progress phases to sustain engagement.
- **AI coach** — an in-app assistant for hints and explanations.
- **Accounts & per-user progress** — authentication with row-level data isolation so every learner has their own journey.
- **Built-in sharing** — invite/streak-sharing mechanics for organic, word-of-mouth growth.

## Architecture

Designed around a **zero-cost, free-tier-only** constraint:

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Static web app (mobile-first) | No build server needed; hostable free |
| Backend | Netlify Functions (serverless) | Generous free tier; keeps API keys off the client |
| Database & Auth | Supabase | Free Postgres + auth + row-level security |
| AI | Google Gemini (free tier) | No cost; quota managed via aggressive caching |

> **Key design challenge:** LLM free-tier quota is counted *per project, not per user*. The architecture therefore caches generated roadmaps and daily quests in the database and rate-limits AI calls per user, so the app scales to many concurrent learners without exceeding free limits.

## How this project is planned

Rather than jumping straight to code, the project is charted as a set of decision tickets using a **wayfinding** method — each ticket resolves one open question (target audience, topic scope, tech stack, business model, …) before implementation begins. The living plan and the decisions made so far are documented in **[`docs/planning`](docs/planning)**.

## Roadmap

- [x] Chart the planning map (destination, tickets, dependencies)
- [x] Decide target audience & topic scope
- [ ] Lock MVP feature set, auth/onboarding flow, and tech stack
- [ ] Finalize the build spec
- [ ] Implement MVP
- [ ] Deploy and grow the first cohort of users

## Context

Built as a real, shippable product for a university business-model course, and maintained as an engineering portfolio piece.

## License

[MIT](LICENSE)
