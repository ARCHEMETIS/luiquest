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

## 🚨 24 ก.ค. 2026 — Netlify หยุด production deploy (เครดิตรอบบิลหมด)

หน้า Deploys ขึ้นว่า *"Production deploys are paused because your team has used all of its available credits for this billing cycle"* — เว็บที่ published ยังรันปกติ (ค้างที่ `146de1c`) แต่ commit ใหม่ขึ้นไม่ได้เลย เจ้าของเลือก **รอเครดิตรีเซ็ต ~2 ส.ค. 2026** (ไม่ย้ายไป Vercel ชั่วคราว, ไม่อัปเกรดเสียเงิน)

**push แล้วแต่ยังไม่ได้ deploy:** `58ce03b` (ระบบเลเวล XP→เลเวล→แรงค์ F–SSS + หน้า restday + มาสคอตลูป) และ `4fb0ad1` (ลบบทเรียน + ปุ่มพรีเมียม + particles/pop-in/wobble)

### ✅ deploy กลับมาแล้ว 24 ก.ค. 2026 (เครดิตรีเซ็ต)

- push empty commit `911131d` เตะ Netlify CD → deploy ผ่าน, bundle ใหม่ `index-DVXlpEUb.js`
- ยืนยัน: `เลเวลถัดไป` อยู่ใน bundle ✅ / `delete-roadmap` ตอบ 401 (deploy แล้ว) ✅
- **`pre-generate-quests` ยิงจากภายนอกได้ 403 แล้ว** (Netlify บล็อก scheduled function จาก public HTTP เอง — แน่นกว่า window guard ที่เขียนไว้; cron ภายในไม่กระทบ ยืนยันได้จาก daily_quests คืนถัดไป)
- ✅ **รัน `2026-07-23-grade-from-xp.sql` ซ้ำแล้ว (24 ก.ค.)** — เจ้าของรันใน SQL editor, ยืนยันด้วยการยิง `complete_quest` จริง 3 จุด: XP 95→C, 175→B, 15→F (ถ้ายังเป็น streak=1 จะได้ F หมด). DB กับ UI ตรงกันแล้ว
  หมายเหตุ: migration ตัวนี้ band-agnostic — เปลี่ยนแค่การเทียบ (streak→total_xp) ส่วนตัวเลขเกณฑ์มาจาก `src/lib/gradeBands.js` ตอน runtime (ปัจจุบันระบบเลเวล: F≥0 D≥25 C≥90 B≥175 A≥340 S≥550 SS≥900 SSS≥1330)

## ✅ ปิดงานรอบ 4 ส.ค. 2026 — เกือบครบ พร้อมประกาศ

- ✅ **deploy live ครบ** (`index-DlAwwCxl.js`) — ระบบเลเวล XP→เลเวล→แรงค์ F–SSS, ลบบทเรียน, ปุ่มพรีเมียม, particles/pop-in/wobble, หน้าจบเควสมีปุ่ม "ไปต่อ ดูความคืบหน้า", iPad swipe (touch-action + ขยายโซนขอบ), แก้ลิงก์บทเรียนหน้าแรก YouTube, เควสขึ้นทันทีหลัง onboarding
- ✅ **เกรดจาก XP** ยืนยัน 3 จุด (95→C, 175→B, 15→F)
- ✅ **ลิงก์ชวน flow เต็ม** — เทส production 9/9 (redeem, XP +20 ทั้งคู่, referrals row, activity, กัน double/self/code มั่ว) **+ มี redeem จริงเกิดขึ้นแล้ว** (Teerabhat→Mahathi 4 ส.ค. ผ่าน UI จริง) → ตอบชัด: flow ไม่พัง แค่ยังไม่มีคนใช้
- ✅ **ล้าง DB เริ่มศูนย์จริง** (4 ส.ค.) — ลบ auth 6 บัญชี (รวม admin) → cascade user data ทุกตาราง = 0, เก็บ topics(6)+starter_quests(18), roadmap คำหยาบเก่าหายไปด้วย
- ✅ **โควต้า Gemini** เช็คแล้ว (23 ก.ค.) — ใส่ 3.1-flash-lite (500 RPD) ในทั้ง 2 chain, ทั้งแอพ ~560 ครั้ง/วัน
- ✅ scheduled function รันจริงหลายคืน (23/22/17 ก.ค.); ต้องยืนยันคืนแรกบน build ใหม่อีกครั้ง (5 ส.ค. เช้า)

**เหลือจริง ๆ ก่อนกดประกาศ (ไม่ใช่งานโค้ดแล้ว):**
1. ⬜ เจ้าของ **ล็อกอิน Google ใหม่ + รัน bootstrap admin** (`update profiles set is_admin=true where id='<uuid>'`) เพราะ wipe ลบ admin เก่าไปด้วย
2. ⬜ **ลอง iPad ซ้ำ** ว่า swipe ใช้ได้แล้ว (แก้แล้วแต่เทสด้วยเมาส์ไม่ได้) + ลบไอคอน PWA เก่าติดตั้งใหม่ดูมาสคอต
3. ⬜ เช็ค cron คืนแรกบน build ใหม่ (5 ส.ค. เช้า — Claude เช็คให้ได้จาก DB)

**follow-up เล็ก ไม่บล็อก:** icon หัวข้อ freeform ใช้ default, การ์ด streak เซฟด้วยกดค้าง, ปิด Email/Password provider ใน Supabase, coach quota premium = Wave 2
