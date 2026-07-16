# ผล /scrutinize ทั้งโปรเจกต์ — 15 ก.ค. 2026 (ยังไม่ได้แก้)

Verdict: **fix-then-ship** — RLS write policies เปิดให้ client ปลอม XP/metric ได้ ขัดเป้า "คะแนนวัดจากผู้ใช้จริง"

## 🔴 Blocker 1 — user ตั้ง xp_reward เควสตัวเองได้ → ปั๊ม XP leaderboard
- `supabase/schema.sql:425-428` policy `daily_quests_all_own` เป็น FOR ALL
- ยิง PostgREST ด้วย anon key (อยู่ใน bundle): PATCH daily_quests ตั้ง `xp_reward=1000000` หรือ INSERT เควสปลอมเข้า roadmap ตัวเอง
- complete-quest.js:93 บวก `quest.xp_reward` เข้า total_xp ด้วย service role → profiles policy ที่กัน total_xp ไว้ไม่ช่วย
- **แก้:** เปลี่ยน `daily_quests_all_own`, `checklist_all_own`, `phases_all_own` เป็น FOR SELECT เท่านั้น (write จริงทั้งหมดผ่าน service role อยู่แล้ว; ตรวจ src/ แล้ว client แตะแค่ topics select + chat_messages select)

## 🔴 Blocker 2 — ลบ checklist เองผ่าน PostgREST → ผ่าน gating ได้ XP ฟรี
- `schema.sql:431-440` `checklist_all_own` ให้ DELETE ได้
- complete-quest.js:50-54: requiredIds ว่าง → ข้าม gating (comment ใน questGenerator.js:533 ก็รู้ว่าเงื่อนไขนี้อันตราย)
- **แก้:** รวมกับ Blocker 1

## 🟠 Major 3 — client insert quest_completions / activity_log ตรงได้ → metric ปลอม
- `schema.sql:445-446` `completions_insert_own`, `schema.sql:479-480` `activity_insert_own`
- เสก activated_total / quests_completed_total ใน public_stats ได้จากบัญชีเดียว + mark เควสเสร็จโดยไม่ผ่าน checklist
- **แก้:** drop สอง insert policy นี้ (ไม่มีโค้ด client ใช้)

## 🟠 Major 4 — race XP หายใน complete-quest (read-modify-write)
- complete-quest.js:76-106 อ่าน total_xp แล้วค่อย update — ทำ 2 เควสพร้อมกัน หรือชน redeem_referral (จ่าย XP ให้ referrer) → lost update
- schema.sql:218-220 comment ยอมรับ race นี้เองฝั่ง redeem_referral แต่ฝั่ง complete-quest ยังไม่ atomic
- **แก้:** เขียน RPC `complete_quest(...)` แบบเดียวกับ redeem_referral (atomic increment ใน Postgres)

## 🟠 Major 5 — แผนฟรี "1 หัวข้อ active" bypass ผ่าน quest-today?roadmap_id=
- quest-today.js:25-27 รับ roadmap_id ที่ user เป็นเจ้าของโดยไม่เช็ค is_active แล้วบรรทัด 76 generate on-demand ให้
- user ฟรี 3 roadmap → farm 3 เควส/วันโดยไม่ switch = 3× XP + เผาโควต้า Gemini 3 เท่า
- **แก้:** generate on-demand เฉพาะ roadmap.is_active — ตัวที่พักให้ดูอย่างเดียว

## 🟡 Medium 6 — chat fallback ตาย เงียบเพราะ maxOutputTokens ชน thinking
- gemini.js:117 `maxOutputTokens: 800` ไม่ปิด thinking — gemini-3-flash-preview / 2.5-flash คิดโดย default, thinking token นับรวม budget → text ว่าง → tryChain ข้ามโมเดลทั้งที่โควต้าเหลือ
- **แก้:** ใส่ `thinkingConfig: { thinkingBudget: 0 }` ใน generationConfig ของ chat chain

## ⚪ Nits
- gemini.js:48 API key ใน query string → ย้ายไป header `x-goog-api-key`
- chat.js:71-89 quota count-then-act race (รับได้ soft cap)
- เพดานฟรี 3 หัวข้อเช็คแค่ app code (questGenerator.js:85-98) — client insert roadmaps ตรงข้าม cap ได้ (`roadmaps_all_own` FOR ALL); ถ้าตัด ระวังคง select/delete ไว้
- redeem-referral ไม่เช็คว่า user ใหม่ — บัญชีเก่า redeem ได้ 1 ครั้ง; ถ้าเจตนา "สมัครผ่านลิงก์" ควรเช็ค created_at

## ที่ trace แล้วผ่าน (ไม่ต้องแตะ)
auth flow, ownership check ผ่าน roadmaps!inner, idempotency 23505 ทุกจุด race, revoke EXECUTE redeem_referral, link whitelist/sanitize, Bangkok timezone/streak, batch sizing ของ scheduled function

## หมายเหตุการ deploy fix
- แก้ policy บน DB จริงต้องรันเป็น migration (drop policy เดิม + create ใหม่) ใน Supabase SQL Editor — schema.sql เป็นไฟล์ initial ไม่ใช่ migration
- Blocker 1+2 + Major 3 = ลบ/แก้ policy ~5 จุดใน schema ไม่ต้องแตะโค้ด function
