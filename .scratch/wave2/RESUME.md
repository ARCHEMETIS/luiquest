# สถานะ Wave 2 — 4 ส.ค. 2026

## ✅ งานพัฒนาทั้งหมดเสร็จ + commit แล้ว

**branch `wave2-security-payments-content` commit `17be6ef`** — 47 ไฟล์, +6979/−341
เทส 17/17 ผ่าน · `npm run build` ผ่าน · **ยังไม่ push ยังไม่ deploy**

**เหลือแค่ขั้นตอน deploy** (ดูหัวข้อ "ทำต่อจากตรงนี้" ด้านล่าง) — ห้ามข้ามลำดับ

## ⚠️ อ่านก่อนทำต่อ

- **ห้าม push เข้า `main`** จนกว่าจะรัน migration บน production DB เสร็จ — Netlify CD deploy ทันทีที่ push แล้วโค้ดใหม่จะเรียก RPC ที่ยังไม่มีในฐานข้อมูล = แอพพังทั้งระบบ
- **`.claude/` และ `.scratch/wave2/qr-test/` ถูก gitignore แล้ว** (worktree = สำเนา repo ทั้งก้อน / ไฟล์ QR ฝังเบอร์พร้อมเพย์เจ้าของ) — ตรวจก่อน commit ทุกครั้งว่าไม่มีเบอร์หลุด: `git grep --cached -l "967934098"`
- **ยังไม่รัน migration ใด ๆ บน production DB** — production ยังเป็นของเดิมทุกอย่าง ไม่มีผลกระทบผู้ใช้
- **ยังไม่ deploy** ตามที่เจ้าของสั่ง (รวมแก้ให้จบก่อน ยิงรอบเดียว)
- มี **agent อีกตัว** ทำ e2e OAuth + PWA test อยู่ — เช็ค `git status` ก่อนแตะอะไรเสมอ

## ✅ เสร็จแล้ว (ตรวจแล้วทั้งหมด)

### เลน 1 — P0 กันโกง (Claude ทำเอง)
| ไฟล์ | สถานะ |
|---|---|
| `supabase/migrations/2026-08-04-xp-awards-ledger.sql` | ใหม่ — ตาราง ledger + backfill + เขียน `complete_quest` ใหม่ (ล็อก profile ก่อน แล้วนับเพดานใต้ล็อก, ฟรี 1/premium 3 ต่อหัวข้อต่อวัน) + drop ลายเซ็นเก่า |
| `supabase/migrations/2026-08-04-rls-close-client-writes.sql` | ใหม่ — ปิด `payments_insert_own` (ปลอมยอดรายรับได้!), `payments_update_own_submit`, `chat_insert_own`, `push_all_own` |
| `netlify/functions/_shared/topicKey.js` | ใหม่ — กุญแจที่อยู่รอดแม้ลบหัวข้อ |
| `netlify/functions/complete-quest.js` | แก้ — ส่ง `topic_key`, คืน `dailyLimitReached` |
| `netlify/functions/chat.js` | แก้ — นับโควตาจาก `activity_log` แทน `chat_messages` ที่โดน cascade |

### เลน 2 — ระบบเก็บเงิน (Codex)
`create-payment.js` / `submit-slip.js` / `verify-payment.js` / `admin-payments.js` / `migrations/2026-08-04-verify-payment.sql` / `_shared/payments.test.mjs`
ตรวจแล้ว: `revoke execute` ✓ · `PROMPTPAY_ID` จาก env + 503 fallback ✓ · เช็คสิทธิ์ path สลิปฝั่ง server ✓ · ต่ออายุใช้ `greatest(now, premium_until)` ✓

### เลน 3 — คลังเควส + prompt (Codex + Claude แก้ตาม)
`migrations/2026-08-04-quest-bank-days.sql` / `scripts/seed-quest-bank.mjs` + test / `questGenerator.js` (+83/−37)
**Claude แก้ที่ Codex พลาด 2 จุด:** ใส่เกณฑ์ `topic_ok` ภาษาไทยกลับ (ที่ถูกย่อทิ้ง — เคยเทสกับ Gemini จริงว่าไม่ over-block), ถอดพารามิเตอร์ prerequisite/outcome ปลอมที่ส่ง `description` ซ้ำสองช่อง

### คลังเนื้อหา
`scripts/quest-bank-{beginner,intermediate,advanced}.mjs` — 108 เควส (วันที่ 2–7 × 6 หัวข้อ × 3 ระดับ)

## ✅ เลน 4 — จบแล้ว (ยังไม่ merge, ยังไม่รีวิว)

**worktree:** `.claude/worktrees/agent-ae9efe83abcf72888` (branch `worktree-agent-ae9efe83abcf72888`) — uncommitted

**diffstat: +119/−27 ใน 7 ไฟล์ ไม่มีอะไรนอก `src/`** ไฟล์ดีไซน์ของเพื่อนโดนมากสุด 31 บรรทัด (`DailyQuestPage.jsx` — แก้ 3 JSX conditional + `charAt(0)` ไม่แตะ markup/class/animation) → สัดส่วนผ่าน แต่ **ยังต้องรีวิวทีละบรรทัดก่อน merge**

ไฟล์ใหม่ 5: `NavMascot.jsx` · `lib/mascotChatter.js` · `lib/promptpay.js` (EMVCo TLV + CRC-16) · `lib/qrEncode.js` (เขียน QR encoder เองเพราะไม่มี lib ใน package.json) · `pages/Premium.jsx`
แก้ 7: `App.jsx` (route `/premium`) · `AppShellLayout.jsx` · `DailyQuestPage.jsx` · `ProfileDrawer.jsx` · `lib/api.js` · `lib/gradeBands.js` (เพิ่ม `gradeFromXp`/`gradeForLevel`) · `Quest.jsx`

มาสคอต: โผล่เฉพาะหน้า `/quest` (เลี่ยงชนการ์ด pin ของ leaderboard + แถบ input ของ coach), CSS keyframe ตัวเดียวไม่มี JS ต่อเฟรม, แตะ→`/coach`, แตะรัว 3 ครั้ง→งอน, พูดตามสถานะจริง 7 ระดับความสำคัญ ไม่มีก็เงียบ, เพดาน 4 นาที/ครั้ง + ไม่ซ้ำข้อความใน session + หยุดเมื่อ `document.hidden` + เคารพ `prefers-reduced-motion`

### 🚨 3 เรื่องที่เลน 4 ชนกับสเปก — ต้องเจ้าของตัดสิน
1. **คำโฆษณาใน drawer ยังขาย "หลายหัวข้อไม่จำกัด"** ซึ่งหลุดจากชุดจุดขายใหม่ที่เจ้าของเลือก (ฟรีซ streak/สกิน/badge/แชท/เควสมากกว่า 1) — agent ไม่ได้แก้ข้อความของเพื่อน แค่ชี้ปุ่มใหม่ **ต้องเลือกว่าจะเอาเรื่องเล่าไหน**
2. เพดานหัวข้อฟรี: สเปก §2.2 = 1 active / โค้ดจริง `TOPIC_CAP_FREE = 3` — ยังไม่ re-decide (ตรงกับ decision 4 ส.ค. ที่ไม่ลดสิทธิ์ผู้ใช้เดิม)
3. `quest-today` ตอนคืน `done_today` ไม่ส่ง `completedCount`/`day_number` มาเลย → frontend ต้องนับ `quest_completions` เอง **ถ้าเลน 5 (Codex) เพิ่มฟิลด์นี้ให้ ก็ถอด query ฝั่ง frontend ออกได้**

### ⚠️ สิ่งที่ verify ไม่ได้ (ต้องทำมือ)
- ✅ **QR สแกนผ่านแอพธนาคารจริงแล้ว (4 ส.ค.)** — เจ้าของสแกนเอง ขึ้นชื่อบัญชีถูก + **ยอด 39.00 มาเอง** ยืนยันว่า payload EMVCo (`src/lib/promptpay.js`) และ QR encoder ที่เขียนขึ้นใหม่ทั้งตัว (`src/lib/qrEncode.js`, ไม่มี dependency) ใช้ได้จริง
  ไฟล์ทดสอบซ้ำได้: `.scratch/wave2/qr-test/scan-me.html` (เจนด้วย node จาก 2 lib นั้นตรง ๆ ไม่ต้อง deploy/ล็อกอิน)
- flow จ่ายเงินยังไม่เคยรันจริงสักครั้ง (ไม่มี backend รัน ไม่มีเน็ต)
- ไม่เคยเปิดในเบราว์เซอร์เลย verify แค่ `npm run build` + เทสระดับ node

## ✅ เลน 5 — P1 ที่เหลือ จบแล้ว (Codex, ยังไม่รีวิว)

migration ใหม่ `2026-08-04-quest-generation-atomic.sql` + แก้ `quest-today.js` (+49) · `pre-generate-quests.js` (105 บรรทัดเปลี่ยน ส่วนใหญ่เป็นการลบ N+1) · `complete-quest.js` (+28, เพิ่ม `validateChecklist` ปฏิเสธ checklist ว่าง) · `_shared/datetime.js` (+17, เพิ่ม `learningDayStr` = วันเรียนเริ่มตี 5) · `questGenerator.js`
เทสใหม่ 3 ไฟล์: `datetime.test.mjs` · `complete-quest.test.mjs` · `pre-generate-quests.test.mjs`

**🚨 ต้องรีวิวละเอียดเป็นพิเศษ: `questGenerator.js` เปลี่ยน 413 บรรทัด** (746 → 817 บรรทัด — โตขึ้น ไม่ได้ถูกยุบทิ้ง จึงไม่ใช่เคส 574→27 แต่ยังใหญ่กว่าที่คาดมาก เพราะรวมงาน "ย้าย insert quest+checklist ไปเป็น transaction เดียว" ซึ่งแตะหลายจุด) → **ไล่ทีละบรรทัดว่าไม่มีอะไรหลุด โดยเฉพาะ contract ของ `generateNextQuest` ที่ `pre-generate-quests.js` พึ่งอยู่**

**ผลตรวจ ณ จุดพัก:** เทสรวม **13/13 ผ่าน** · `npm run build` ผ่าน · ไม่มีไฟล์นอกเลนถูกแตะ

## ✅ รอบที่ 2 (ต่อจากพัก) — merge + ปิดช่องว่าง

- **รีวิว `questGenerator.js` 413 บรรทัดจบแล้ว → ผ่าน** diff ใหญ่เพราะแปลง call site 4 จุดให้ใช้ `createQuestWithChecklist` (RPC เดียว) + เพิ่มระบบจับจอง `quest_generation_claims` (reclaim ได้หลัง 2 นาทีถ้าค้าง). ยืนยัน: contract `{quest, checklist, phase, failed}` ของ `generateNextQuest` คงเดิม ✓ · `scheduled_date` มีในตารางจริง ✓ · RPC ใหม่ 2 ตัวมี `revoke execute` ✓
- **รีวิว diff ฝั่ง frontend จบแล้ว → ผ่าน** surgical ทุกจุด มีคอมเมนต์ไทยอธิบายเหตุผล ไม่แตะ markup/class/animation ของเพื่อนเลย
- **merge worktree เข้า main tree แล้ว** — diffstat ตรงกับที่ agent รายงานเป๊ะ (+119/−27, 7 ไฟล์แก้ + 5 ไฟล์ใหม่); คืนค่า 8 ไฟล์ที่เปลี่ยนแค่ line ending ตอน copy
- **🔧 ปิดช่องว่างที่ 2 เลนไม่เห็นกัน:** `quest-today` เพิ่ม status `generation_in_progress` แต่ `Quest.jsx` ไม่รู้จัก → ตกไปเป็น `not_ready` โชว์ "ปั่นไม่ทัน ลองใหม่" ทั้งที่**ของกำลังมา** → แก้ให้คงหน้า loading แล้ววนถามซ้ำทุก 3 วิ (`GENERATING_POLL_MS`) + เคลียร์ timer ตอน unmount/สลับหัวข้อ
- **เทส 17/17 ผ่าน · `npm run build` ผ่าน** (bundle 562 → 600 KiB จาก QR encoder + มาสคอต)
- **decision เจ้าของ (4 ส.ค.):** "เอาปัจจุบัน" = คงพฤติกรรมเดิม — ฟรีเก็บ 3 หัวข้อ / premium ไม่จำกัด; ข้อความขายใน drawer ที่พูดถึง "หลายหัวข้อไม่จำกัด" **ไม่ขัด**กับจุดขายใหม่ เพราะยังเป็นสิทธิ์ premium จริง แค่ไม่ใช่พระเอก (ฟรีซ streak เป็นพระเอก) → ไม่ต้องแก้ข้อความ
- 🔄 **กำลังรัน:** Codex ยุบ 5 migrations เข้า `supabase/schema.sql` (lane 6)

## ⏭️ ทำต่อจากตรงนี้ (เรียงลำดับ)

~~1. รีวิว + merge worktree เลน 4~~ ✅ เสร็จ
~~2. `quest-today` กันโชว์เควสวันถัดไปก่อนตี 5~~ ✅ เสร็จ (เลน 5 ทำ `learningDayStr`)

3. **รีวิว `supabase/schema.sql` ที่ Codex ยุบมา** (lane 6 กำลังรัน) — เช็ค: ไม่มี object ซ้ำ / ทุก `security definer` มี `revoke execute` ลายเซ็นถูก / ไม่มีร่องรอย `complete_quest` ลายเซ็นเก่า 8 อาร์กิวเมนต์ / **ไม่มี backfill `insert...select` หลุดเข้ามา**
4. **frontend รับ `dailyLimitReached`** จาก complete-quest มาแสดงข้อความให้ตรงเหตุ (ตอนนี้ backend ส่งมาแล้วแต่ยังไม่มีใครใช้)
5. **`Coach.jsx` นับโควตาฝั่ง client จาก `chat_messages`** (~บรรทัด 60) — server ย้ายไปนับ `activity_log` แล้ว สองฝั่งจะไม่ตรงกันหลังมีคนลบหัวข้อ ควรใช้ `remaining` ที่ server คืนมาแทน
6. รันเทสรวม + `npm run build` + **commit ลง branch ใหม่** (ห้าม push main)
7. **รัน migration บน production DB** (SQL Editor) — ⚠️ ต้องทำ **ก่อน** deploy โค้ด ไม่งั้นโค้ดใหม่เรียก RPC ที่ยังไม่มี → พังทันที
   ลำดับ: `xp-awards-ledger` → `quest-bank-days` → `quest-generation-atomic` → `verify-payment` → `rls-close-client-writes`
8. `node --env-file=.env scripts/seed-quest-bank.mjs` — ยัดเควส 108 ชุดเข้า production (ต้องรันหลังข้อ 7 เพราะต้องมีคอลัมน์ `day_number` ก่อน)
9. **เพิ่ม `PROMPTPAY_ID` ใน Netlify env vars** (ตอนนี้มีแค่ใน `.env` ของเครื่อง) ไม่งั้น create-payment ตอบ 503
10. **deploy รอบเดียว** → verify → ล้าง DB → ประกาศ

## 🧪 ผลเทสล่าสุด (ทั้งหมดผ่าน)
```
questGenerator parse OK
topicModeration      2/2 ✓
seed validator       4/4 ✓
payments             5/5 ✓
เควส 108 ชุด         ผ่าน validator ครบ ✓
guardrail: ไฟล์ที่ track ถูกแก้เฉพาะที่ตั้งใจ ไม่มี Codex เผลอแตะไฟล์อื่น ✓
```

## ⛔ ยังต้องรอเจ้าของ
- นิยาม "UI น่าใช้กว่านี้" เพิ่มเติม (นอกจากมาสคอตที่สั่งไปแล้ว)
- ผลเทสลิงก์ชวนด้วยบัญชีที่ 2 + PWA บนมือถือ/iPad (ทำกับ agent อีกตัว)
- โควตา Gemini จริงจาก AI Studio dashboard
- ธีม/สกินมาสคอตสำหรับ premium — กี่แบบ หน้าตาไหน
