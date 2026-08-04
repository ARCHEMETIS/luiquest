-- 2026-08-04 — ปิดช่องที่ client เขียนตารางเองได้โดยไม่ผ่าน Netlify Function
--
-- หลักการเดิมของโปรเจกต์ (spec §5): "การเขียนที่ผู้ใช้ห้ามทำเอง ทำผ่าน Function ที่ถือ service_role"
-- แต่มี policy ตกค้างที่เปิด insert/update ให้ client ตรง ๆ ทั้งที่ frontend ไม่เคยใช้เลย
-- ตรวจแล้วด้วย grep ทั้ง src/ ก่อนลบทุกอัน
--
-- รันซ้ำได้ (drop policy if exists)

-- ───────────────────────────────────────────────────────────────────────────
-- 1. payments — ช่องปลอมยอดรายรับ (สำคัญที่สุดในไฟล์นี้)
-- ───────────────────────────────────────────────────────────────────────────
-- `payments_insert_own` เช็คแค่ `auth.uid() = user_id` เฉย ๆ ไม่ได้บังคับคอลัมน์อื่นเลย
-- → ผู้ใช้ยิง PostgREST ด้วย anon key แล้ว insert แถว status='verified', amount=99999 ของตัวเองได้
-- ไม่ได้ทำให้ได้สิทธิ์ premium (is_premium อยู่บน profiles ซึ่งล็อกคอลัมน์ไว้แล้วตั้งแต่ 23 ก.ค.)
-- **แต่ทำให้ยอดรายรับ/จำนวนผู้จ่ายในแดชบอร์ด admin เพี้ยนได้ทันที** ซึ่งคือตัวเลขที่เอาไป pitch
--
-- payment ทุกแถวสร้างและอัปเดตผ่าน function service role เท่านั้น
-- (create-payment / submit-slip / verify-payment) — client ต้องการแค่ select ของตัวเอง
drop policy if exists "payments_insert_own" on public.payments;
drop policy if exists "payments_update_own_submit" on public.payments;

-- คงไว้: payments_select_own_or_admin (ผู้ใช้ดูสถานะของตัวเอง), payments_update_admin
-- (เผื่อแก้มือใน dashboard — is_admin() คุมอยู่แล้ว)

-- ───────────────────────────────────────────────────────────────────────────
-- 2. chat_messages — ช่องถมพื้นที่ free tier
-- ───────────────────────────────────────────────────────────────────────────
-- frontend อ่านอย่างเดียว (src/pages/Coach.jsx:51 เป็น .select() ล้วน) ไม่เคย insert
-- ข้อความจริงถูกเขียนโดย netlify/functions/chat.js ผ่าน service role หลัง Gemini ตอบสำเร็จ
-- ปล่อย insert policy ไว้ = ใครก็ยัดข้อความขนาดใหญ่เข้ามาเท่าไหร่ก็ได้ด้วย anon key
drop policy if exists "chat_insert_own" on public.chat_messages;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. push_subscriptions — ฟีเจอร์ยังไม่ได้สร้าง
-- ───────────────────────────────────────────────────────────────────────────
-- web push เป็นงาน Wave 2 ที่ยังไม่ได้ทำ frontend ไม่แตะตารางนี้เลยสักบรรทัด
-- แต่ policy เป็น `for all` = เปิด insert/update/delete ให้ authenticated ทุกคนตั้งแต่วันแรก
-- เอากลับมาใส่ตอนสร้างฟีเจอร์จริงได้ (ตอนนั้นค่อยจำกัด endpoint/keys ให้ถูก)
drop policy if exists "push_all_own" on public.push_subscriptions;

-- ───────────────────────────────────────────────────────────────────────────
-- ที่ "ไม่" ปิด และเหตุผล
-- ───────────────────────────────────────────────────────────────────────────
-- • storage `slips_insert_own` — **ต้องเปิดไว้** เพราะ flow อัปสลิปตามสเปก §6.3 ให้ client
--   อัปไฟล์เข้า bucket `payment-slips` ตรง ๆ ใต้โฟลเดอร์ของตัวเอง แล้วค่อยเรียก submit-slip
--   ความเสี่ยงคือถมพื้นที่ ไม่ใช่ปลอมข้อมูล — คุมด้วยเพดานขนาดไฟล์ของ bucket ใน Supabase
--   (ตั้งใน dashboard: Storage → payment-slips → file size limit + allowed MIME image/*)
-- • friendships policies — ฟีเจอร์เพื่อน/duo ยังไม่ทำ แต่ policy เขียนไว้รัดกุมกว่า
--   (insert บังคับ requester_id = ตัวเอง) และไม่ใช่ตารางที่โตเร็ว ปล่อยไว้ได้
