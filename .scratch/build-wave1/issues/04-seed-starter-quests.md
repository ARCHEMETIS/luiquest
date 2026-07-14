# เขียน + ยัด starter quests 18 ชุดลง DB

Type: task
Status: done (14 ก.ค. 2026)
Assignee: owner + claude
Blocked by: 03

## ผลลัพธ์ (14 ก.ค. 2026 — seed สำเร็จ)

1. ✅ **เขียนเนื้อหาเควสแรก 18 ชุด** (6 หัวข้อ × 3 ระดับ) เป็นไทยล้วน — แต่ละชุดมี `content` (intro + objectives) และ `checklist` (3-4 ข้อ, บาง label มีลิงก์บาง label เป็น action ล้วน) อิงแหล่งเรียนจาก `../app-v2-spec/assets/thai-lesson-sources.md` เท่านั้น (28 URL ที่ใช้จริง ล้วนมาจากรายการนั้น ไม่มี deep URL ที่แต่งเอง)
2. ✅ **Seed ผ่าน `scripts/seed-starter-quests.mjs`** (`npm run seed:starter-quests`) — upsert ผ่าน supabase-js ด้วย `SERVICE_ROLE_KEY` (onConflict `topic_id,level`) ไม่ต้องใช้ raw SQL/CLI, idempotent รันซ้ำได้ปลอดภัย
3. ✅ **Verify ครบ 18 แถวใน production DB**, ครบทุกหัวข้อ×ระดับ (group by topic slug × level เช็คแล้ว), อ่านได้ทั้งด้วย service role และ anon key (RLS `starter_quests_select_all` ใช้งานได้ตามสเปก — ไม่ต้องล็อกอินก่อนก็ดึงได้)
4. ✅ **เช็ค URL ทั้ง 28 อันที่ใช้จริงด้วย curl (User-Agent เบราว์เซอร์) — ได้ 200 ครบทุกอัน** รวมลิงก์ค้นหา YouTube (ทั้งแบบ raw Thai query และ percent-encoded)

## บทเรียนสะสม
- `starter_quests` เป็นแค่ "เควสแรก" (day_number=1) ไม่ใช่ roadmap เต็ม — แต่ละชุดจึงสั้น ทำจบใน 1 ครั้งได้ ไม่ใช่คอร์สยาว
- `content`/`checklist` ไม่มี shape ล็อกไว้ในสเปกเดิม เลยกำหนดเอง: `content = {intro, objectives[]}`, `checklist = [{order_index, label, link_url}]` — จงใจให้ตรงกับคอลัมน์ของ `quest_checklist_items` เพื่อ "แตกเป็นแถว" ตอนก๊อปไป `daily_quests` ได้ตรง ๆ (ตาม comment ใน schema.sql) — ticket 09 (integrate UI) ต้องอิง shape นี้
- supabase-js `.upsert()` ผ่าน PostgREST พอสำหรับงาน insert/update ข้อมูลปกติ ไม่ต้องพึ่ง raw SQL/CLI/DB password เลย (ต่างจาก ticket 03 ที่ต้องใช้ SQL Editor เพราะเป็น DDL)

## งานที่ต้องทำ (สเปกเดิม)

สร้างคลัง starter quest สำเร็จรูป 18 ชุด (6 หัวข้อ × 3 ระดับ มือใหม่/พอมีพื้น/แน่น) ตาม ticket onboarding (#04) แล้ว seed ลงตารางใน Supabase:

- เนื้อหาเควสเป็นไทย, checklist ติ๊กครบถึงได้ XP
- ลิงก์แหล่งเรียนใช้จาก `../app-v2-spec/assets/thai-lesson-sources.md` เท่านั้น (whitelist 24 โดเมน) — ห้ามแต่ง deep URL เอง
- ต้องขึ้นทันที 0 วินาทีตอนคนแห่สมัคร ไม่กินโควต้า Gemini

## เสร็จเมื่อ

18 ชุดอยู่ใน DB, ดึงมาแสดงได้ครบทุกหัวข้อ×ระดับ, ทุก URL เปิดได้จริง (200)
