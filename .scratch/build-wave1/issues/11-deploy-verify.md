# Deploy production + ทดสอบ end-to-end บน luiquest.netlify.app

Type: task
Status: open — **ticket เดียวที่เหลือของ map** (01–10 ปิดครบ 21 ก.ค. 2026)
Blocked by: — (08/09/10 ปิดหมดแล้ว)

## งานที่ต้องทำ

ปล่อยขึ้น production และพิสูจน์ว่าใช้ได้จริง (= ถึง Destination ของ map):

- ตั้ง env 5 ตัวบน Netlify (service_role/Gemini ห้าม `VITE_`)
- ตั้ง redirect URI ของ Google OAuth ให้ตรง domain production
- ตรวจ PWA ติดตั้งได้จริงบนมือถือ + iPad
- ไล่ลูปเต็มบน production ด้วยบัญชีจริง: สมัคร Google → onboarding → เควส → ได้ XP → แชท → ลิงก์ชวน → /stats
- เช็ค scheduled function รันคืนแรกจริง

## เสร็จเมื่อ

คนแปลกหน้าเปิด `luiquest.netlify.app` แล้วสมัคร-เล่นได้ครบลูปโดยไม่พัง, activity_log เก็บ event ครบ — **ประกาศ Wave 1 live ได้**

## สถานะจริง (อัพเดต 23 ก.ค. 2026)

**ทำไปแล้ว (ตกลงมาจาก ticket อื่น):**
- ✅ Netlify site + env 5 ตัว + redirect URI Google OAuth ตรง domain production (15 ก.ค., ticket 01)
- ✅ deploy จาก `main` อัตโนมัติ + signup ด้วย Google บน production สำเร็จจริงครั้งแรก (15 ก.ค.)
- ✅ smoke test บน production: `quest-today` ready, chat ตอบ, RPC `complete_quest` (XP 10 / streak 1 / grade F→D ตรวจ DB ตรงทุกค่า) — 16 ก.ค. commit `e1da926`

## 🚨 พบระหว่างตรวจ 23 ก.ค. — มีผู้ใช้จริงเข้ามาก่อนประกาศ

query production DB ตรง (service role) เจอว่า **22 ก.ค. 12:18–12:22 มีคนสมัครใหม่ 3 บัญชี** (Thanawat ธนวัฒน์, Thanyawit Sophon ×2 บัญชี) หนึ่งในนั้นเล่นจริงจนได้ 25 XP + แชทโค้ช 3 ครั้ง — ยังไม่มีใครประกาศแอพ แปลว่ามีคนเจอลิงก์แล้วเข้ามาเอง

**ผลที่ตามมา 2 อย่าง:**
1. "ล้างข้อมูลทดสอบ" ไม่ใช่งานปลอดภัยแบบเดิมอีกแล้ว — ข้อมูลทดสอบปนกับผู้ใช้จริง → เจ้าของเคาะ **ล้างทั้งหมด เริ่มนับศูนย์ตอนประกาศ** (23 ก.ค.)
2. **เจอช่องโหว่จริง: หัวข้อพิมพ์อิสระไม่มี moderation เลย** — มีคนพิมพ์คำหยาบเป็นหัวข้อ 2 อัน ("ควย", "ฝึกเย็ด") แล้ว Gemini สร้าง roadmap + เควสให้เรียบร้อย. ไม่หลุดหน้าสาธารณะ (view `leaderboard`/`public_stats`/`stats_daily_growth` ไม่มีคอลัมน์ `topic_title`) แต่โผล่เต็มจอเจ้าตัว → **แก้แล้ว ดูหัวข้อถัดไป**

## ✅ เพิ่มด่านกรองหัวข้อพิมพ์อิสระ (23 ก.ค.)

2 ชั้น ออกแบบให้ไม่กินโควตา Gemini เพิ่มเลย:
- **ชั้นที่ 1 — บล็อกลิสต์ฝั่ง server** (`_shared/topicModeration.js` ใหม่ + เรียกใน `generate-quest.js` **ก่อน**แตะ Gemini): normalize กันเลี่ยง (`ค ว ย`, `ค.ว.ย`, `คววยยย`, `p.o.r.n`) แล้วจับคำไทยแบบ substring + คำอังกฤษแบบ word-boundary. **ตั้งใจไม่ใส่**คำที่หัวข้อเรียนจริงใช้ได้ (ยาเสพติด/กัญชา/เจาะระบบ) ปล่อยให้ชั้น 2 ตัดสินตามบริบท
- **ชั้นที่ 2 — โมเดลตีกลับเอง** ผ่าน field `topic_ok` ที่เพิ่มใน `ROADMAP_JSON_SCHEMA` + กติกาในพรอมพ์ (`FREEFORM_SYSTEM_PROMPT`) — อยู่ในคอลเดิมที่ generate อยู่แล้ว ไม่เพิ่ม request; ถ้า `topic_ok=false` ทิ้งทั้งก้อน **ไม่ insert roadmap ลง DB** (ไม่กินเพดาน 3 หัวข้อ ไม่มีขยะค้าง)
- **frontend:** error code `TOPIC_NOT_ALLOWED` ส่งผู้ใช้กลับไป **ขั้น 1 (เลือกหัวข้อ)** ไม่ใช่ขั้น 3 (เวลา) พร้อมย้ายแบนเนอร์ error ให้โชว์ได้ทั้งขั้น 1 และ 3

**ทดสอบแล้ว:**
- ชั้น 1: 39/39 เคส — บล็อกครบทุกแบบที่ลอง **และไม่มี false positive** (จับได้ตอนเขียนว่าถ้าใช้ substring กับอังกฤษ "cooking" จะโดน `cock` และ "analysis/analytics" จะโดน `anal` → เปลี่ยนเป็น word-boundary; "หีบเพลง"/"ผิวเหี่ยวย่น" ก็ผ่านแล้ว)
- ชั้น 2 (ยิง Gemini จริง 6 ครั้ง): ตีกลับ "แฮกเฟซบุ๊กแฟนเก่า" / "โกงข้อสอบไม่ให้โดนจับ" / ข้อความมั่ว — และไม่ over-block "ถ่ายรูปด้วยมือถือให้สวย" / "โทษของยาเสพติด" / "พูดอังกฤษให้คล่อง" (5–6 วิ/ครั้ง)
- `npm run build` ผ่าน

**เช็คลิสต์ที่ยังค้างจริง:**

1. ✅ **`a0f0b29` อยู่บน production จริง** (เช็ค 23 ก.ค.) — bundle `/assets/index-Ds2Sh9KU.js` มีข้อความ state `restday` ที่เพิ่งเพิ่ม, functions ตอบ auth ถูก (401/405 ตามเมธอด), SPA fallback ของ `/stats` + `/invite/<code>` ทำงาน, `manifest.webmanifest` + `sw.js` เสิร์ฟ 200
2. ⬜ **e2e ด้วยบัญชี Google จริงบน production** เฉพาะส่วนที่ทำ headless ไม่ได้ (OAuth):
   - drawer → สลับหัวข้อ (`switch-roadmap`) + เพดานฟรี 3 หัวข้อเตือนถูก
   - แชทโค้ช ตอบจริงบน production (ไม่ใช่แค่ `netlify dev`) + โควต้า 10 ข้อความ/วันนับถูก
   - **redeem ลิงก์ชวนด้วยบัญชีที่สอง** — `/invite/<code>` → ล็อกอิน → XP เข้าทั้งคู่ + ยอดใน drawer ขึ้น (ยังไม่เคยทดสอบ flow นี้เต็ม รวม window 7 วัน `REDEEM_WINDOW_DAYS`)
   - state `restday` หลังทำเควสครบวัน (แก้ไปตอน `a0f0b29` ทดสอบใน dev แล้ว)
3. ⬜ **เช็คโควต้า Gemini จริงกับ AI Studio dashboard** (RPM/RPD ของ `gemini-2.5-flash` + `-lite` บน free tier) — ค้างมาตั้งแต่ ticket 05–08 (#11.A.4); เสี่ยงต่ำถ้าคนใช้ยังไม่เยอะ แต่ต้องรู้เพดานก่อนชวนเพื่อนเข้ามาพร้อมกัน
4. ⬜ **PWA ติดตั้งจริงบนมือถือ + iPad** (add to home screen, เปิดแบบ standalone, icon/splash ถูก)
5. ✅ **scheduled function รันคืนจริงแล้ว** (เช็ค 23 ก.ค. จาก DB ตรง ไม่ต้องรอ log): มี `daily_quests` ถูกสร้างตอน **23 ก.ค. 02:05**, 22 ก.ค. 02:11 และ 17 ก.ค. 02:11 — ตรงหน้าต่าง cron `*/10 19-21 * * *` UTC (= ตี 2–5 ไทย) หลายคืนติดกัน
6. ⬜ **ล้างข้อมูล DB ทั้งหมด เริ่มนับศูนย์** (เจ้าของเคาะ 23 ก.ค.) — ทำ **ท้ายสุด หลัง e2e ข้อ 2 เสร็จ** ไม่งั้นการเทสจะสร้างขยะใหม่อีก. ตอนนี้มี 5 บัญชี (2 ทดสอบ + 3 ผู้ใช้จริง 22 ก.ค.), 8 roadmaps (รวมคำหยาบ 2 อัน), 11 daily_quests, 4 quest_completions, 14 chat_messages, 31 activity_log, referrals 0
7. ⬜ **deploy ด่านกรองหัวข้อขึ้น production** — โค้ดเสร็จ+เทสผ่านแล้ว (ดูหัวข้อข้างบน) รอ commit + push
8. ⬜ **`referrals` = 0 แถว** — ยังไม่เคยมีใคร redeem ลิงก์ชวนสำเร็จเลยสักครั้ง ทั้งที่เป็น metric ที่วิชาเอาไปวัด; ยังแยกไม่ออกว่า "ไม่มีคนกด" หรือ "flow พัง" → ข้อ 2 ต้องพิสูจน์ให้ได้

**follow-up เล็ก ไม่บล็อกการเปิดตัว:** icon หัวข้อ freeform ใช้ default (`me.js` ไม่ส่ง slug), การ์ด streak เซฟด้วยกดค้าง (ไม่ใช้ lib), ปิด Email/Password provider ใน Supabase, coach quota premium >50 = Wave 2
