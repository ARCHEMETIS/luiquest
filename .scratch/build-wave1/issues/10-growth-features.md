# ฟีเจอร์โต Wave 1: ลิงก์ชวน + leaderboard + การ์ดแชร์ + /stats

Type: task
Status: closed (21 ก.ค. 2026 — UI ที่เหลือ wire ครบใน ticket 09, commit `3e32733`/`0811722`)
Blocked by: 06, 09

## ผลลัพธ์บางส่วน (14 ก.ค. 2026)

- ✅ **`netlify/functions/redeem-referral.js`** — endpoint เดียวที่ยังไม่ติด UI (ไม่ต้องรอ 09): POST `{ referral_code }` พร้อม auth → เช็ค self-invite/double-redeem/code ไม่มีจริง, แจก XP 20 ให้ทั้งคู่ (ตัวเลขยังไม่ล็อกในสเปก #09 flag 11 — ตั้งเท่า xp_reward เควสระดับกลาง), เขียน `referrals` + `activity_log` (`referral_signup`) ผ่าน service role กันผู้ใช้โกงเอง — กัน race ด้วย unique constraint `referrals.referred_id` (ทดสอบ concurrent request คู่ขนานแล้ว ได้ XP แค่ครั้งเดียว)
- ✅ **เจอ+แก้บั๊กร้ายแรงระหว่างทดสอบ:** `handle_new_user()` trigger fail 100% (ไม่มีใครสมัครแอพได้เลยสักคน) — รายละเอียดเต็มอยู่ที่ [issues/03-deploy-schema.md](03-deploy-schema.md) หัวข้อ "บั๊กร้ายแรงที่เจอ+แก้แล้ว"
- ✅ ทดสอบผ่าน `netlify dev` จริงกับ production Supabase (สร้าง/ลบ test user ผ่าน `auth.admin.createUser`, 13/13 เช็คผ่าน: happy path, self-invite, double-redeem, invalid code, unauthenticated, race condition) — ลบ test data ออกหมดแล้ว
- ⬜ **Leaderboard / /stats / streak share card:** ตามสเปก ทั้งสามอันอ่านจาก view (`leaderboard`/`public_stats`/`stats_daily_growth`) ที่ deploy ไว้แล้วตั้งแต่ ticket #03 โดยตรงผ่าน `src/lib/supabaseClient.js` (RLS/grants เปิดให้อ่านตรงได้ ไม่ต้องผ่าน Netlify Function) — งานที่เหลือคือ **UI wiring ล้วน ๆ** ซึ่งเป็นขอบเขตของ ticket #09 (ต้องรอ component ที่เหลือจากเพื่อน)

## งานที่ต้องทำ

ทำกลไกโต Wave 1 (จาก #06, #09, #14) — ตัวขับยอดผู้ใช้ที่วิชานี้เอาไปวัดคะแนน:

- **ลิงก์ชวนเพื่อน** — สมัครผ่านลิงก์แล้วนับยอด + ให้ XP ทั้งผู้ชวนและผู้ถูกชวน
- **Leaderboard** — อันดับ XP รวมทั้งแอพ
- **การ์ดแชร์ streak** — สร้างภาพสำหรับโพสต์ IG story/LINE
- **หน้า /stats สาธารณะ** — ดึงจาก VIEW (activated = ทำเควส ≥1) ไว้โชว์อาจารย์/แชร์

## เสร็จเมื่อ

สมัครผ่านลิงก์ชวนแล้ว XP เข้าทั้งคู่ + ยอดนับถูก, leaderboard เรียงถูก, การ์ด render ออกภาพได้, /stats แสดงตัวเลขจริง — ยืนยันด้วย `/verify`

## ปิด ticket (21 ก.ค. 2026)

UI ทั้ง 3 ส่วนที่ค้างถูก wire ครบในรอบเดียวกับ ticket 09 (รายละเอียดเต็ม + รีวิว 2 รอบอยู่ที่ [09-integrate-ui.md](09-integrate-ui.md)):

- ✅ **ลิงก์ชวน** — flow ครบ `/invite/<code>` → เก็บโค้ดไว้ → หลังล็อกอิน redeem อัตโนมัติ (`api.redeemReferral` + InviteRedeemer ที่เก็บ pending code ไว้ retry ถ้า 5xx/network) + ลิงก์/ยอดเพื่อนโชว์ใน ProfileDrawer (นับจากตาราง `referrals`)
- ✅ **Leaderboard** — อ่าน view ตรงผ่าน `supabaseClient`, ใช้ rank จริงจาก view (ไม่ recompute จาก index), badge "คุณ", กันคน opt-out แอบอ้าง #1, few-state
- ✅ **การ์ดแชร์ streak** — overlay ในหน้าเควส, ปุ่มแชร์ copy ได้จริงบนเดสก์ท็อป (เซฟภาพใช้กดค้าง ไม่พึ่ง lib — follow-up เล็ก)
- ✅ **/stats** — หน้าเดียวสาธารณะ (ไม่มี `:handle`, ไม่มี PII), ตัดตัวเลขสุ่ม `useLiveTick` ออกให้เป็นเลขจริงล้วน (หน้านี้ใช้ pitch อาจารย์), มี error state กัน crash ตอน fetch view ล้ม
- ✅ e2e ด้วยเบราว์เซอร์จริง + บัญชีเจ้าของ: /stats, /leaderboard, ProfileDrawer, StreakCard render ครบด้วย real data, zero console errors

⬜ **ยังไม่ได้ทดสอบจริง:** redeem ลิงก์ชวนแบบ end-to-end ด้วยบัญชีที่สองบน production (OAuth ทำ headless ไม่ได้) + window 7 วันหลังสมัคร (`REDEEM_WINDOW_DAYS`) → อยู่ในเช็คลิสต์ ticket 11
