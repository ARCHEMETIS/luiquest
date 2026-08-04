# Codex audit 4 ชุด — 4 ส.ค. 2026

รัน `codex exec --sandbox read-only` 4 ตัวขนานกัน (gpt-5.6-sol / -luna, reasoning high–xhigh) แต่ละตัวคนละมุม ไม่เห็นผลกัน
→ **ข้อที่สองตัวขึ้นไปชี้ตรงกัน = ความมั่นใจสูงมาก** ทำเครื่องหมาย ⭑ ไว้

Claude ยืนยันด้วยตาเองแล้วเฉพาะข้อที่ทำเครื่องหมาย **[ยืนยันแล้ว]** — ที่เหลือเป็นข้อกล่าวหาของ Codex ที่ยังต้องตรวจก่อนแก้ (บทเรียนเดิม: Codex เคยเสนอทางแก้ที่ deploy จริงแล้วไม่ได้ผล)

---

## 🔴 P0 — ต้องแก้ก่อนประกาศ

### 1. ⭑ ลบหัวข้อ = ปั๊ม XP ได้ไม่จำกัด **[ยืนยันแล้ว]**

`netlify/functions/delete-roadmap.js:37` + `supabase/schema.sql:177`

`quest_completions.roadmap_id` เป็น `on delete cascade` → ลบ roadmap แล้วแถว completion หายหมด **แต่ `profiles.total_xp` ไม่ถูกหักคืน** และ `complete_quest` มี guard แค่ `unique (user_id, quest_id)` ซึ่งหายไปพร้อม quest

**ยืนยันเพิ่ม:** `complete_quest` (schema.sql:260) **ไม่มี guard "1 ครั้ง/วัน" เลย** — เช็คแค่ unique quest_id ล้วน ๆ

วนลูป: เริ่มหัวข้อ → ทำเควส → +10 XP → ลบหัวข้อ → เริ่มใหม่ → ทำอีก → +10 XP … ไม่จำกัด ไม่ต้องแตะ Gemini ด้วยซ้ำ (starter quest มาจาก DB)
**ผลกระทบ:** leaderboard = metric ที่วิชาเอาไปวัด พังทั้งกระดาน

### 2. ลบหัวข้อ = รีเซ็ตโควตาแชท 10 ข้อความ/วัน **[ยืนยันแล้ว]**

`supabase/schema.sql:362` + `netlify/functions/chat.js:75`

`chat_messages.roadmap_id` cascade เหมือนกัน; `chat.js` นับโควตาจาก `chat_messages` ของวันนี้ → ลบ roadmap = นับใหม่เป็น 0
**ผลกระทบ:** โควตา Gemini เป็นของ **ทั้งแอพร่วมกัน** คนเดียววนลูปนี้ทำให้ทั้งแอพใช้ AI ไม่ได้ทั้งวัน

### 3. โควตา Gemini ไม่พอตั้งแต่การใช้งานปกติ (ยังไม่ต้องมีใครโกง)

คำนวณโดย Codex: 50 คนสมัคร freeform + 50×10 ข้อความโค้ช + cron กลางคืนสูงสุด 54 ≈ **604 requests** เทียบเพดานจริง ~**560/วัน**
ซ้ำร้าย 1 logical call ยิงได้ถึง 6 HTTP attempt เพราะ retry ข้ามโมเดลใน fallback chain

### 4. admission control เป็น check-then-call มี race + ไม่นับครั้งที่ล้ม

`netlify/functions/chat.js:75` → นับก่อนเรียก แต่ insert หลังสำเร็จ; ยิงขนาน 50 request เห็น `usedToday=0` พร้อมกันได้หมด และ **ครั้งที่ล้มไม่ถูกนับ** = retry ฟรีไม่จำกัด

### 5. client เขียน DB/Storage ตรงได้โดยไม่ผ่าน function

`supabase/schema.sql:565` `chat_insert_own` — authenticated insert `chat_messages` ตรงได้ **[ยืนยันแล้ว]**
`supabase/schema.sql:612` `slips_insert_own` — อัปไฟล์เข้า bucket `payment-slips` ได้ทั้งที่ฟีเจอร์ยังไม่เปิด **[ยืนยันแล้ว]**
→ ถมพื้นที่ free tier ได้ (ไม่กระทบ XP/โควตา แต่กิน storage)

---

## 🟠 P1

| # | เรื่อง | ที่ | ผล |
|---|---|---|---|
| 6 | ⭑ quest-today คืนเควสที่ cron สร้างไว้ก่อนรีเซ็ตตี 5 โดยไม่เช็คว่าวันนี้ทำไปแล้ว | `quest-today.js:49` | ได้ XP หลายรอบในคืนเดียว |
| 7 | delete-roadmap ไม่ atomic (เช็คสิทธิ์/ลบ/อ่านใหม่/เลื่อน active/log แยกกัน) | `delete-roadmap.js:37` | ลบแล้วพัง = ตอบ 500 ทั้งที่ลบไปแล้วจริง ย้อนไม่ได้ |
| 8 | frontend ทิ้ง `roadmaps` ที่ server ส่งกลับมาหลังลบ แล้วไปพึ่ง `/me` ที่กลืน error | `ProfileDrawer.jsx:343`, `useProfile.jsx:30` | state ค้างชี้ roadmap ที่ลบไปแล้ว → 404 |
| 9 | ⭑ static fallback ใช้ไม่ได้จริงตั้งแต่วันที่ 2 | `questGenerator.js:521-538` | Gemini ล่ม = ไม่มีเควสเลย ไม่ใช่ "มีของสำรอง" |
| 10 | metric สาธารณะลดลงย้อนหลังเมื่อมีคนลบหัวข้อ | `schema.sql:446` | กราฟโตในหน้า /stats หดได้ = พังต่อการ pitch |
| 11 | drawer โชว์ `profile.grade` ที่ค้าง ส่วนหน้าอื่นคำนวณจาก `total_xp` | `ProfileDrawer.jsx:212` | XP จาก referral ทำให้ 2 หน้าโชว์แรงค์ไม่ตรงกัน |
| 12 | cron รายคืนยิง DB ~150 ครั้งเรียงกันใต้ timeout 10 วิ + หน้าต่าง fixed oldest-60 | `pre-generate-quests.js:60,81` | เกิน 60 roadmap แล้วคนที่ 61+ ไม่มีวันได้คิว |
| 13 | quest-today ยิง Gemini ก่อนจับจอง `(roadmap_id, day_number)` | `quest-today.js:98` | คนกดพร้อมกัน = ยิงซ้ำหลายรอบเพื่อเควสเดียว |
| 14 | quest กับ checklist insert คนละ transaction; `complete-quest` ยอมรับ checklist ว่าง | `questGenerator.js:701`, `complete-quest.js:51` | เคลม XP ได้โดยไม่มีอะไรให้ติ๊ก |
| 15 | เพดาน 3 หัวข้อ + active limit นับแบบไม่ atomic | `questGenerator.js:86`, `schema.sql:117` | ยิงขนานทะลุเพดานได้ |

**ผ่านการตรวจ (Codex ยืนยันว่าปลอดภัย):** ไม่มีทางลบ/อ่านข้อมูลข้ามผู้ใช้, `profiles` column lock กันปลอม XP/premium/admin ได้จริง, `complete_quest`/`redeem_referral` revoke จาก client แล้ว, เพดาน Netlify/Supabase ที่ 50–150 คนยังไม่ถึง

---

## 📚 คุณภาพเนื้อหา (Codex ให้คะแนน)

**หัวข้อ curated 6 อัน: 5/10** — starter quest 18 ชุดใช้ได้จริง ลิงก์ส่วนใหญ่มาจากแหล่งที่คัดแล้ว แต่ **ครอบคลุมแค่วันที่ 1** ตั้งแต่วันที่ 2 เป็นต้นไป Gemini ได้แค่ outline บรรทัดเดียว + ชื่อเควส 5 อันล่าสุด ไม่มี phase จริง ไม่มี prerequisite ไม่มี outcome

**หัวข้อพิมพ์อิสระ: 2/10** — prompt **ไม่ห้ามแต่งชื่อคอร์ส/คลิป** ไม่มีรายชื่อแหล่งให้ยึด ไม่ตรวจว่าลิงก์มีจริง ไม่คุมหัวข้อกว้าง/แคบ

จุดที่เจ็บที่สุด:
- `curatedContent.js:45` ยอมรับเฉพาะ URL ค้นหา exact pattern → ลิงก์อื่นทั้งหมดถูกแปลงเป็น **หน้าค้นหา** (`questGenerator.js:197`) แต่ prompt กลับสั่งให้โมเดลใส่ homepage → **ลิงก์หลังวันที่ 1 เกือบทั้งหมดกลายเป็นหน้าค้นหา**
- เควสที่ generate มา `content: {}` ว่างเปล่า (starter quest มี `intro`/`objectives`) → ลิงก์ไม่ดี = ผู้ใช้ไม่เหลืออะไรเลย
- prompt ไม่คุมงบเวลา — checklist 4 ข้อชุดเดียวกันใช้ทั้ง 15/30/60 นาที
- `curatedContent.js:70` ให้ Gemini แค่ `school.borntodev.com/` ทั้งที่ asset ระบุคอร์สจริงถึง `/course/zero-to-one-python`

**ข้อเสนอที่ Codex บอกว่าคุ้มสุดและ `[0 extra Gemini requests]` ทุกข้อ:**
1. เขียน phase จริง (prerequisite + outcome) แทน outline บรรทัดเดียว — มีร่างครบ 6 หัวข้อแล้วในล็อก `p4-out.log`
2. เปลี่ยน `FREEFORM_SYSTEM_PROMPT` เป็นเวอร์ชันห้ามแต่งแหล่ง — มีข้อความเต็มให้แล้ว
3. เปลี่ยน `CONTINUATION_SYSTEM_PROMPT` + ส่ง phase context เข้าไปจริง
4. **เขียนเควสมือเพิ่มสัปดาห์แรก 6 หัวข้อ × 6 วัน = 36 ชุด** ← Codex ชี้ว่านี่คือ "การเปลี่ยนแปลงเดียวที่คุ้มที่สุดสัปดาห์นี้"
5. เลิกอ้างว่าเจอบทเรียน ถ้าจริง ๆ ส่งไปหน้าค้นหา
6. เทส static ตรวจ starter quest/ลิงก์/phase

**Codex เตือน:** อย่าเพิ่ม Gemini call ไปตรวจลิงก์ — จะกลายเป็น +1 request/roadmap ซึ่งงบ 560/วันรับไม่ไหว

---

## วิธีรัน Codex ที่ใช้ได้จริง (บันทึกไว้ใช้ซ้ำ)

```bash
CODEX="C:/Users/Pc/AppData/Local/OpenAI/Codex/bin/d7e8094cfb76a267/codex.exe"   # hash เปลี่ยนทุกครั้งที่อัปเดต — glob หาใหม่
"$CODEX" exec --cd "<repo>" --sandbox read-only -m gpt-5.6-luna \
  -c model_reasoning_effort=xhigh - < prompt.md > out.log 2>&1
# ดึงคำตอบสุดท้าย: awk '/^codex$/{n=NR} {a[NR]=$0} END{for(i=n+1;i<=NR;i++) print a[i]}' out.log
```

- โมเดล: `gpt-5.6-sol` (default), `gpt-5.6-luna`, `gpt-5.6-terra`; effort: low→max
- **รัน 4 ตัวขนานพร้อมกันได้สบาย** ถ้าเป็น read-only (ไม่แย่งไฟล์กัน) — ตัวละ ~200-260k tokens ฝั่ง OpenAI
- **Codex ไม่มีเน็ต** งานยิง production/Supabase/Gemini/เบราว์เซอร์ ห้าม delegate
- prompt ที่ได้ผล: บอก scope ชัด + บอกว่าห้ามทำอะไร + **สั่งห้ามอ่านแค่ diff ให้อ่านไฟล์เต็ม** + ขอ output format ที่มี severity/file:line/failure scenario/minimal fix
