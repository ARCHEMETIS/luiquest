# Planning & Decision Log

This project is planned with a **wayfinding** approach: instead of a single upfront spec, the work is charted as a map of decision *tickets*, each resolving one open question before implementation starts. Tickets are worked one at a time; resolving one clears the "fog" and reveals the next.

The raw, living tracker (map + tickets) lives in [`../../.scratch/app-v2-spec/`](../../.scratch/app-v2-spec/). Ticket detail is written in Thai (the target market's language); this page is an English index of the process and the decisions locked so far.

## Destination

A complete, build-ready spec for a multi-user, multi-topic gamified learning app — every decision locked (name/positioning, audience, MVP features, architecture, free-tier strategy, business model, first-month growth plan) so implementation can begin.

## Decisions locked so far

| Decision | Outcome |
| --- | --- |
| **Topic scope** | Curated core of 6 tracks (Python, Data/ML, web dev, using AI, spreadsheets, personal finance) plus a free-form "type your own topic" mode. Thai-first resources, English as backup. Free-form mode may only attach whitelisted domains or search links — never fabricated deep URLs. |
| **Target audience** | First users are Thai engineering/CS/science students in the founder's own circle. Tech tracks featured first. Growth is word-of-mouth (peer sharing + university online groups) — so in-app invite/share mechanics are treated as core MVP, not extras. |

## Open questions (frontier)

- Login & onboarding flow
- App name & brand
- MVP feature set
- Business model (Business Model Canvas for the course pitch)
- Gemini free-tier quota strategy *(research)*
- Curated Thai learning sources for the 6 launch tracks *(research)*
- Tech stack, growth plan, core-screen prototype, final spec assembly *(downstream)*

## Constraints

- **Free tier only** — no paid services at any point.
- **~1 month timeline** to build and grow a real user base; graded on real usage.
- Solo developer.
