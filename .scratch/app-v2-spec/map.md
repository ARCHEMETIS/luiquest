# Map: สเปกแอพเรียนรู้ตัวใหม่ (วิชาธุรกิจ)

Label: wayfinder:map

## Destination

สเปกครบถ้วนพร้อมลงมือสร้าง (`spec.md`) สำหรับแอพเรียนรู้แบบ quest ตัวใหม่ที่เป็น multi-user + multi-topic — ทุกการตัดสินใจถูกล็อก: ชื่อ/positioning, กลุ่มเป้าหมาย, ฟีเจอร์ MVP, สถาปัตยกรรม, วิธีรับมือ free tier, โมเดลธุรกิจระดับ BMC, **แผน freemium เก็บเงินจริงในเดือนแรก** (เจ้าของขยาย scope 12 ก.ค.: มีทั้งชั้นฟรีและชั้นจ่ายเงิน ไม่ใช่แค่เรื่องเล่าใน BMC), แผนหาผู้ใช้เดือนแรก เหลือแค่ลงมือเขียนโค้ดตามสเปก (การ implement เป็น effort ถัดไป)

## Notes

- **บริบท**: วิชาธุรกิจให้สร้างแอพจริง คะแนนวัดจากจำนวนผู้ใช้จริง ("ยิ่งเยอะยิ่งดี" ไม่มีเป้าตัวเลข) เดดไลน์จริงคือ **1 เทอม** (แก้จาก ~1 เดือน — เผยระหว่าง grilling ฟีเจอร์ MVP 12 ก.ค.) แต่ต้องอัพเดตอาจารย์ต่อเนื่องและเจ้าของอยากปิดงานเร็ว → ยึดเป้าเปิดตัว Wave 1 ใน ~2 สัปดาห์ + ปลายเทอมต้อง pitch และมีเอกสารโมเดลธุรกิจ (BMC)
- **หมุดเวลาถัดไป**: มีนำเสนออาจารย์อีกครั้งใน **~4 สัปดาห์** (~9 ส.ค. 2026, เจ้าของแจ้ง 12 ก.ค.) → ถ้า Wave 1 เปิดตัวตามเป้า ~2 สัปดาห์ จะเหลืออีก ~2 สัปดาห์เก็บยอดผู้ใช้จริง + เริ่ม Wave 2 ไว้โชว์ตอนนำเสนอ
- **ข้อจำกัดตายตัว**: ฝั่งต้นทุนต้อง free tier เท่านั้น ห้ามเสียเงิน (Gemini free tier — โควต้านับต่อโปรเจกต์ ไม่ใช่ต่อผู้ใช้; Supabase free; Netlify free) — ฝั่ง*รายรับ*เก็บเงินจากผู้ใช้ได้ (freemium) แต่ช่องทางรับเงินก็ต้องงบศูนย์เช่นกัน (ดู ticket "เก็บเงินจริงใน MVP")
- **ของเดิม**: `ml-quest/` (single-user, ML hardcode, index.html + netlify functions + Supabase + gemini-2.5-flash) เก็บเป็น portfolio ไม่แตะ — ใช้เป็นโค้ดอ้างอิง/ก๊อปชิ้นส่วนได้
- **ทีม**: เจ้าของคนเดียว + Claude Code, ภาษาหลักของแอพน่าจะเป็นไทย
- **Tracker**: local markdown (`luiquest/.scratch/app-v2-spec/`) — โฟลเดอร์ `luiquest/` (เดิม `new app/`) คือบ้านของแอพใหม่ ลุยเควส
- **Skills**: `/grilling` และ `/domain-modeling` ยังไม่ได้ติดตั้ง — session ที่ทำ ticket ประเภท grilling ให้ทำบทสนทนาถาม-ตอบทีละคำถามเองแทน
- **Design direction**: เจ้าของมี mockup UI ที่ชอบอยู่แล้ว — `ML Quest Master.html` (โฟลเดอร์แม่) — หน้าใหม่ของแอพให้ต่อยอดจากดีไซน์นี้ ดูรายละเอียดใน ticket "ต้นแบบหน้าจอหลัก"

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [ชื่อแอพและแบรนด์](issues/05-app-name-brand.md) — **ลุยเควส (LuiQuest)**, tagline "อยากเก่งอะไร ลุยเลย — วันละเควส", โทนสนุกเป็นกันเองแบบไทย ๆ (กลไก quest/XP/streak คงเดิม); repo → `ARCHEMETIS/luiquest`, โฟลเดอร์ → `luiquest/`
- [ฟีเจอร์ MVP: อะไรอยู่ อะไรตัด อะไรเพิ่ม](issues/06-mvp-features.md) — ยกของเดิมมาครบ (XP/streak/phase/grade/แชทโค้ช/checklist gating/PWA); ของใหม่แบ่ง 2 waves: Wave 1 (~2 สัปดาห์) = ลิงก์ชวนเพื่อน + leaderboard + การ์ดแชร์ streak, Wave 2 = web push + เพื่อน/duo + ชั้นจ่ายเงิน; multi-topic เป็นเส้นแบ่งฟรี/จ่าย (ฟรี 1 หัวข้อ, premium หลายหัวข้อ)
- [วิธีล็อกอินและ onboarding flow](issues/04-login-onboarding.md) — Google Sign-in อย่างเดียว (Supabase Auth, ไม่มี guest); onboarding 3 ขั้น (หัวข้อ → ระดับ → เวลา/วัน) จบใน <1 นาที; เควสแรกเป็น starter quest สำเร็จรูป 18 ชุด (6 หัวข้อ × 3 ระดับ) ขึ้นทันทีไม่กินโควต้า
- [โควต้า Gemini free tier ปัจจุบัน และกลยุทธ์ประหยัด AI](issues/03-gemini-quota-research.md) — ตัวเลขจริงดูได้แต่ใน AI Studio dashboard; planning number: 3-flash ~1,500 RPD, flash-lite ~1,000, 2.5-flash เหลือ ~250 (เลิกใช้เป็นตัวหลัก); จุดตายคือ RPM → แก้ด้วย pre-generate เควสตอนกลางคืน + cache + จำกัดแชท 10/คน/วัน + fallback chain; รับได้ ~250–600 active users/วัน
- [ขอบเขตหัวข้อเรียน: เปิดอิสระแค่ไหน](issues/02-topic-scope.md) — Curated 6 หัวข้อ (Python, Data/ML, เว็บ, ใช้ AI, Excel, การเงิน) เป็นแกน + พิมพ์อิสระได้; แหล่งเรียนไทยก่อนอังกฤษเสริม; โหมดอิสระลิงก์ได้เฉพาะ whitelist/ลิงก์ค้นหา ห้ามแต่ง deep URL
- [ผู้ใช้กลุ่มแรกคือใคร และจะไปหาพวกเขาที่ไหน](issues/01-target-audience.md) — นักศึกษาไทยสายไอที/วิศวะ/วิทย์รอบตัวเจ้าของ; หัวข้อเทคโชว์เด่นก่อน; โตด้วยปากต่อปาก (ขอเพื่อนแชร์ + โพสต์กลุ่มมหาลัย) → แอพต้องมี mechanic ชวนเพื่อนในตัว

## Not yet specified

- ออกแบบ schema Supabase ใหม่ (users, roadmaps ต่อหัวข้อ, progress, RLS) — ฟีเจอร์ MVP ล็อกแล้ว เหลือรอ stack (เงื่อนไขสะสม: ตาราง starter quests 18 ชุด, referral/ลิงก์ชวนเพื่อน, leaderboard query, flag premium + จำนวน active roadmap ต่อ user, รองรับ duo/push ใน Wave 2)
- แผน deploy + ตั้ง repo GitHub ใหม่ (ชื่อ repo ตามชื่อแอพ) — รอ stack และชื่อแอพ

## Out of scope

- **ลงมือเขียนโค้ดจริง** — จุดหมายของแผนที่นี้คือสเปก การ implement เป็น effort ถัดไป
- **ทำสไลด์ pitch ปลายเทอม** — ใช้ผลจาก ticket โมเดลธุรกิจได้ แต่ตัวสไลด์เป็นงานแยกหลังแอพมียอดผู้ใช้
- **แก้ไข/อัพเกรด ml-quest เดิม** — เก็บไว้เป็น portfolio ตามเดิม แอพใหม่สร้างในโฟลเดอร์ใหม่
