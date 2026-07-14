# Map: สร้าง LuiQuest Wave 1 ขึ้น production

Label: wayfinder:map

## Destination

**ลุยเควส (LuiQuest) Wave 1 รันจริงบน `luiquest.netlify.app`** — ผู้ใช้จริงสมัครด้วย Google → onboarding 3 ขั้น → ได้ starter quest ทันที + roadmap เฉพาะตัว → ทำเควสรายวันได้ครบลูป (XP / streak / phase progress / letter grade / checklist gating / แชท AI โค้ช 10 ข้อความ/วัน) + กลไกโต Wave 1 (ลิงก์ชวนเพื่อน, leaderboard, การ์ดแชร์ streak, หน้า /stats สาธารณะ) ติดตั้งเป็น PWA ได้ทั้งมือถือและ iPad

ถึงจุดหมายเมื่อ: คนแปลกหน้าเปิดลิงก์แล้วสมัคร-ทำเควส-ได้ XP ได้จริงบน production โดยไม่พัง และเก็บ timestamp ทุก event ตั้งแต่วันแรก (สำหรับกราฟโตไว้ pitch)

## Notes

- **⚙️ map นี้เป็น execution map — carries execution:** override ค่า default ของ wayfinder ("วางแผนเฉย ๆ") ticket ส่วนใหญ่คือ **ลงมือทำจริง** (ตั้ง Supabase, เขียน functions, เสียบ UI, deploy) ไม่ใช่แค่ตัดสินใจ — Claude Code + เจ้าของ ทำด้วยกันในแต่ละ session
- **แหล่งความจริงเดียว = สเปกที่ปิดแล้ว:** ทุกการตัดสินใจ (positioning, ฟีเจอร์, schema, deploy, โมเดล AI, แหล่งเรียน) ล็อกไว้ใน [`../app-v2-spec/spec.md`](../app-v2-spec/spec.md) + assets: `supabase-schema.md`, `deploy-plan.md`, `thai-lesson-sources.md`, `design-brief-ui.md` — **อ่านก่อนทำเสมอ ห้าม re-decide**; ถ้าเจอช่องที่สเปกไม่ได้ตอบ ค่อยแตกเป็น ticket ตัดสินใจ (กรณีหายาก)
- **ทีม:** เจ้าของ + Claude Code เขียนโค้ด; **เพื่อนส่ง UI เป็น React components ครบ 10 หน้า** (ตาม `design-brief-ui.md`) — งานเราคือ wiring (auth/state/API/logic) ไม่ต้องออกแบบ UI ใหม่
- **ข้อจำกัดตายตัว:** ฝั่งต้นทุน free tier เท่านั้น (Supabase free / Netlify free / Gemini free) — โมเดล `gemini-3-flash` (งานหนัก) + `flash-lite` (แชท) + fallback chain; ภาษาแอพเป็นไทย
- **โค้ดอ้างอิง:** `ml-quest/` (เดิม) — ก๊อปแพตเทิร์น Netlify Function + การต่อ Supabase/Gemini ได้
- **Skills ที่ควรใช้:** `/verify` ยืนยันแต่ละ ticket ทำงาน end-to-end จริง, `/run` เปิดแอพดู; `/grilling` และ `/domain-modeling` ยังไม่ติดตั้ง → ทำ Q&A เองทีละคำถาม
- **เวลา:** เป้าเปิด Wave 1 ~2 สัปดาห์; นำเสนออาจารย์ ~9 ส.ค. 2026
- **Tracker:** local markdown (`.scratch/build-wave1/`) — map นี้แยกจาก map วางแผน (`app-v2-spec/`) ที่ปิดแล้ว

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- **03 schema ขึ้น production แล้ว (14 ก.ค.):** 14 ตาราง + 3 views + RLS 28 policies + bucket + seed ครบ, ทดสอบ anon key ผ่าน, ปิดจุดรั่ว leaderboard (revoke anon) — ค้างแค่ bootstrap admin หลังล็อกอินครั้งแรก → [issues/03-deploy-schema.md](issues/03-deploy-schema.md)
- **04 starter quests 18 ชุด seed เข้า production แล้ว (14 ก.ค.):** เขียนเนื้อหาไทยครบ 6 หัวข้อ × 3 ระดับ, ลิงก์ทั้งหมดมาจาก thai-lesson-sources.md, เช็ค 200 ครบ, seed ผ่าน `npm run seed:starter-quests` (supabase-js upsert, ไม่ต้องใช้ SQL Editor) — กำหนด shape `content`/`checklist` เองเพราะสเปกเดิมไม่ได้ล็อก (ดูรายละเอียดใน ticket) → [issues/04-seed-starter-quests.md](issues/04-seed-starter-quests.md)
- **05-08 backend เต็มระบบเสร็จแล้ว (14 ก.ค., commit `2f67f74`):** whitelist/roadmap-outline config (`_shared/curatedContent.js`), core game-loop functions (`me`/`start-roadmap`/`quest-today`/`complete-quest` — auth check, checklist gating, XP/streak/grade, activity_log), Gemini fallback chain จริง (`_shared/gemini.js`: `gemini-3-flash-preview` → `gemini-2.5-flash-lite` → `gemini-2.5-flash` → static, RPM retry/RPD skip, JSON schema output — ชื่อโมเดลจริงต่างจาก placeholder ในสเปก ยังไม่ได้เช็คโควต้าจริงกับ AI Studio dashboard ตาม #11.A.4), freeform roadmap generation + coach chat (`generate-quest.js`/`chat.js`), nightly scheduled pre-generate (`pre-generate-quests.js`, ไม่มี queue table ใหม่ คำนวณ eligibility สดจาก roadmaps/daily_quests/quest_completions ทุกรอบ) — ยิง `/verify` ผ่าน `netlify dev` จริงกับ production Supabase (auth gating ถูก, `pre-generate-quests` ต่อ DB จริงสำเร็จ) + code review 8 มุม เจอ 10 findings แก้แล้ว 4 ตัวที่คุ้ม (Gemini ยิงก่อนเช็ค limit ฟรี, checklist insert error ที่ทำให้ gating ผ่านฟรี, race บน complete-quest, error `.code` ไม่หลุดถึง frontend) เหลือ 6 ตัวเป็น known follow-up (SCAN_LIMIT 60 ไม่หมุนเวียนถ้า active roadmap เกิน 60, chat degraded ทิ้ง history ไม่ครบคู่ ฯลฯ) → [issues/05-seed-roadmaps-sources.md](issues/05-seed-roadmaps-sources.md) [issues/06-core-functions.md](issues/06-core-functions.md) [issues/07-ai-pipeline.md](issues/07-ai-pipeline.md) [issues/08-scheduled-pregenerate.md](issues/08-scheduled-pregenerate.md)

## Not yet specified

<!-- หมอกที่ยังชี้ไม่ชัด รอ frontier ขยับ -->

- **แผน QA/verify ก่อนปล่อย** — เช็คลิสต์ทดสอบ manual + edge states ก่อน announce (จะชัดเมื่อ integration ใกล้เสร็จ)
- **แนวทาง error handling/logging กลางของ Netlify Functions** — จะชัดตอนเขียน function ชุดแรก
- **การจูนรางวัล XP ของลิงก์ชวนเพื่อน** (กันโกง/ปั๊มบัญชี) — รอเห็นพฤติกรรมจริง

## Out of scope

<!-- เกินจุดหมาย Wave 1 — เป็น effort ใหม่ถ้าจะทำ -->

- **ฟีเจอร์ Wave 2** — web push, ระบบเพื่อน/duo, ชั้นจ่ายเงิน freemium PromptPay 39฿ (ticket #13 เดิม) — effort ถัดไปหลัง Wave 1 มียอดผู้ใช้
- **ห่อ Play Store (TWA/Capacitor) / App Store** — หลัง PWA-first พิสูจน์ยอดแล้ว
- **สไลด์ pitch ปลายเทอม** — งานแยกหลังแอพมีตัวเลขผู้ใช้
