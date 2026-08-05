# LuiQuest — Audit รวม 6 มุม (5 ส.ค. 2026)

ผู้ตรวจ: Codex `gpt-5.6-sol` (reasoning=max) 4 ตัวขนาน ไม่เห็นผลกัน + Claude subagent 2 ตัว
ผู้ตัดสินขั้นสุดท้าย: Claude (เปิดโค้ดยืนยันเองทุกข้อที่จัด P0)

| มุม | ผู้ตรวจ | สถานะ |
|---|---|---|
| เงิน / premium entitlement | Codex #1 | เสร็จ |
| เศรษฐกิจเกม / ปั๊ม XP / leaderboard | Codex #2 | เสร็จ |
| RLS + auth boundary + PII | Codex #3 | เสร็จ |
| AI: โควตา / prompt injection / moderation | Codex #4 | เสร็จ (รันซ้ำ 1 รอบ เน็ตหลุด) |
| Frontend trust boundary | Claude subagent A | เสร็จ |
| Secrets / config / deploy | Claude subagent B | เสร็จ |

## ⚙️ สถานะการแก้ (อัปเดต 5 ส.ค. 2026 — โค้ดแก้แล้ว ยังไม่ deploy)

แก้ในโค้ดครบแล้ว: P0-1..5 ทั้งหมด, P1-1,2,3,4,5,6,7(บางส่วน),9, P2 friendships/leaderboard/useEffect
+ บั๊กเควสวันแรกพัง (เจอทีหลังจาก session ผู้ใช้จำลอง) + พรีเมียม 3 เควส/วันจริง + streak freeze

**ยังไม่ได้แก้ (จงใจ):** moderation bypass (ด่าน 2 คุมอยู่), Quest.jsx poll ไม่มีเพดาน,
starter link whitelist, README, NODE_VERSION, deno.lock, qa-run.mjs, RESUME.md UUID

**ความเสี่ยงคงเหลือที่ต้องยืนยันหลัง deploy:** `pre-generate-quests` ยังปลอม `next_run` ได้ในหน้าต่างเวลา
(ปิด GET + นอกหน้าต่าง + no-body ได้แล้ว) ผลกระทบจำกัดที่จำนวน invocation ไม่ใช่โควตา Gemini
เพราะ generation idempotent ต่อ roadmap/วัน — ต้องลองยิงจากภายนอกหลัง deploy เพื่อดูว่า URL ตอบไหม

**สรุปหนึ่งบรรทัด:** ฐานความปลอดภัยแน่นกว่าที่คาด (RLS ปิดครบ ไม่มี secret หลุด git เลย ไม่มี XSS) แต่มี **5 เรื่องที่ต้องแก้ก่อนประกาศเปิดตัว** — 3 เรื่องทำให้คนเดียวดูดโควตา Gemini จนแอพล่มทั้งระบบ, 1 เรื่องทำให้ปั๊ม XP บนกระดานที่ใช้วัดคะแนนวิชาได้, 1 เรื่องทำให้จ่าย 39 บาทครั้งเดียวได้พรีเมียมตลอดชีพ

---

## P0 — ต้องแก้ก่อนเปิดตัว (ยืนยันด้วยการเปิดโค้ดเองแล้วทุกข้อ)

### P0-1 · แชทดูดโควตา Gemini ของทั้งแอพได้ในคำสั่งเดียว
`netlify/functions/chat.js:82-102` → เรียก Gemini บรรทัด 125 → ค่อยบันทึกโควตาบรรทัด 157

ลำดับเป็น **นับ → เรียก → ค่อยจด** ไม่มี lock ไม่มี reservation ยิงขนาน 100 requests ทุกตัวอ่านเห็น `count = 0` เหมือนกันหมด แล้วเข้าเรียก Gemini ทั้ง 100 (ลิมิตจริงที่ตั้งใจไว้คือ 10/วัน) แต่ละครั้งอาจยิง upstream ได้ถึง 3-6 ครั้งเพราะมี model fallback chain

ซ้ำร้าย: ถ้า Gemini พังหรือโดน safety block โค้ดจะ **ไม่บันทึกโควตาเลย** (บรรทัด 138 ตั้งใจไม่จด) → ยิงซ้ำได้ไม่จำกัดแม้ไม่ต้องขนาน และ `degradedCooldownByUser` (บรรทัด 15) เป็น `Map` ในหน่วยความจำ ซึ่งบน Netlify แต่ละ invocation คนละ instance = ไม่ได้กันอะไรเลย

**ทำไมถึงเป็น P0:** คอมเมนต์ในโค้ดเอง (บรรทัด 78-79) เขียนไว้แล้วว่าโควตา Gemini ฟรี ~560 req/วัน เป็นของ**ทั้งแอพร่วมกัน** — คนเดียวทำให้ทุกคนใช้ AI ไม่ได้ทั้งวัน วันนำเสนอถ้ามีใครกดรัวก็จบ

**แก้:** ย้ายบรรทัด 82-102 เป็น RPC เดียวที่ `select ... for update` แถว profiles แล้ว insert แถวจอง (reservation) ก่อนเรียก Gemini — จดทุกครั้งที่ "เริ่มยิง" ไม่ใช่ทุกครั้งที่ "สำเร็จ"

---

### P0-2 · สร้างหัวข้อพิมพ์เองไม่มีเพดานต่อวัน + ลบแล้วสร้างใหม่ได้ไม่จำกัด
`_shared/questGenerator.js:75-88` (`assertSavedCapacity`), `delete-roadmap.js:37`

`assertSavedCapacity` = อ่าน count แล้วค่อย insert ทีหลัง ไม่มี lock ไม่มี constraint ใน DB → ยิงขนานทะลุเพดาน 3 หัวข้อของแผนฟรีได้ (หัวข้อ curated รอดเพราะมี `uniq_roadmap_user_topic` แต่หัวข้อพิมพ์เองไม่มี unique เลย) และไม่มีตัวนับ "สร้างกี่ครั้งต่อวัน" เลย — สร้าง → ลบ → สร้างใหม่ วนได้ไม่จำกัด แต่ละรอบ = เรียก Gemini 1 ครั้ง

**ผลกระทบซ้อน:** เป็นทั้งช่องดูดโควตา (แบบเดียวกับ P0-1) และช่องทะลุจุดขายพรีเมียม (เพดาน 3 หัวข้อคือสิ่งที่ขาย)

**แก้:** จองสิทธิ์ลง DB ต่อ (user, วันไทย) ก่อนเรียก Gemini และแยกจากตาราง roadmaps เพื่อให้ลบ roadmap แล้วโควตาไม่คืน

---

### P0-3 · ปั๊ม XP ได้ไม่จำกัดด้วยการเปลี่ยนชื่อหัวข้อ
`_shared/topicKey.js:15-20`, `schema.sql:368-372` (`complete_quest`)

เพดาน XP รายวันคิดจาก `(user_id, topic_key, award_date)` — **ต่อหัวข้อ** ไม่ใช่ต่อคนต่อวัน และ `normalizeTopicTitle` normalize แค่ `trim + ยุบช่องว่าง + lowercase` เท่านั้น

แปลว่า `"python basics"`, `"python basics."`, `"python basics!"`, `"python​basics"` = คนละ topic_key = ได้โควตา XP ใหม่ทุกอัน วน สร้าง→ทำเควส→ลบ ได้ XP ไม่จำกัดในวันเดียว

**ทำไมถึงเป็น P0:** leaderboard คือสิ่งที่ใช้วัดคะแนนวิชาธุรกิจ อันดับปลอมได้ = ตัวเลขที่เอาไปนำเสนอเชื่อไม่ได้

**แก้:** เพิ่มเพดานรวมต่อ `(user_id, award_date)` ใน `complete_quest` ใต้ล็อก profile เดิม (เช่นฟรี 1 / พรีเมียม 3 ต่อวันรวมทุกหัวข้อ) — แก้ที่เดียวปิดทั้งช่อง ไม่ต้องไปไล่ normalize Unicode ให้ครบทุกกรณี

---

### P0-4 · `pre-generate-quests` ยิงได้จากภายนอกโดยไม่ต้องล็อกอิน วันละ 3 ชั่วโมง
`netlify/functions/pre-generate-quests.js:47-54`

ด่านเดียวคือ `isInsideCronWindow()` — ถ้าเป็นชั่วโมง 19/20/21 UTC ก็ **ผ่านเลย ไม่เช็คอะไรอีก** ไม่มี auth ไม่มี secret ไม่เช็คแม้แต่ HTTP method (GET ก็ได้) ฟังก์ชันนี้รันด้วย service role และเรียก Gemini ได้

`PREGEN_BYPASS_SECRET` ที่โค้ดอ่านอยู่บรรทัด 33 **ไม่ได้ตั้งไว้ทั้งใน `.env` และ `.env.example`** → กิ่ง bypass เป็นโค้ดตายอยู่ตอนนี้ และแปลว่าถ้า cron พังคืนไหน เจ้าของก็ไม่มีทางสั่งรันเองด้วย

**แก้:** บังคับ secret กับ**ทุก** request ไม่ใช่แค่นอกหน้าต่างเวลา แล้วตั้งค่าใน Netlify env จริง (เวลาไม่ใช่การพิสูจน์ตัวตน)

---

### P0-5 · จ่าย 39 บาทครั้งเดียว = พรีเมียมตลอดชีพ (และต่ออายุไม่ได้ด้วย)
`chat.js:97`, `_shared/questGenerator.js:77`, `src/pages/Premium.jsx:199`, `src/components/ProfileDrawer.jsx:211`

`verify_payment` (`schema.sql:677`) เซ็ต `is_premium = true` + `premium_until = +1 เดือน` แต่**ไม่มีที่ไหนเลยในระบบที่เซ็ต `is_premium` กลับเป็น false** ไม่มี cron ไม่มี job

และมีแค่ `create-payment.js:21-25` (`isPremiumActive`) ที่เดียวที่เช็ควันหมดอายุจริง — `chat.js:97` (โควตา 100 ข้อความ) กับ `questGenerator.js:77` (ไม่จำกัดหัวข้อ) เช็คแค่ `is_premium` ดิบ

ฝั่ง frontend ยิ่งกลับด้าน: `ProfileDrawer.jsx:521` ซ่อนปุ่ม "อัปเกรดพรีเมียม" เมื่อ `is_premium` เป็น true และ `Premium.jsx:239` แสดง "คุณเป็นพรีเมียมอยู่แล้ว" → **ผู้ใช้ที่หมดอายุแล้วจ่ายซ้ำไม่ได้เลย** ทั้งที่ backend เปิดให้จ่ายได้

**แก้:** ใช้ `isPremiumActive()` ที่มีอยู่แล้วทั้ง 4 จุด (chat, questGenerator, Premium.jsx, ProfileDrawer.jsx) หรือให้ `/me` คืนฟิลด์ `is_premium_active` ที่คำนวณแล้วมาให้ frontend ใช้ที่เดียว

---

## P1 — ควรแก้ก่อนรับผู้ใช้จริงเยอะ ๆ

| # | เรื่อง | ที่ | ผลกระทบ |
|---|---|---|---|
| P1-1 | referral ไม่มี cap + ชวนไขว้กันได้ | `redeem-referral.js:45-62` | A ใช้โค้ด B (+20 ทั้งคู่) แล้ว B ใช้โค้ด A ได้อีก (+20 ทั้งคู่) และหนึ่งโค้ดมีคนกดได้ไม่จำกัด ผู้ชวนได้ +20 ทุกคน — **ถ้า email/password provider ของ Supabase ยังเปิดอยู่ สคริปต์สมัคร 100 บัญชี = +2,000 XP** |
| P1-2 | bucket สลิปไม่มีเพดานขนาด/ชนิดไฟล์ | `schema.sql:940-942` | ลิมิต 5MB + `image/*` อยู่แค่ในเบราว์เซอร์ (`Premium.jsx:147`) ยิงตรงถม 1GB free tier ได้ → **ทุกคนอัปสลิปไม่ได้ = ปิดทางขายพรีเมียม** |
| P1-3 | วันรีเซ็ตไม่ตรงกัน 05:00 vs เที่ยงคืน | `quest-today.js` ใช้ `learningDayStr()` แต่ `complete-quest.js:82` ส่ง `bangkokDateStr()` | ทำเควสตอนตี 1-5 กินโควตา XP ของวันใหม่ พอถึงตี 5 ได้เควสจริงมาทำแล้ว **ได้ 0 XP** |
| P1-4 | replay แจ้ง XP ปลอม | `schema.sql:344-346` insert `xp_earned = p_xp` **ก่อน**เช็คเพดานบรรทัด 374 | เควสที่ชนเพดาน (ได้ 0 XP) ถูกบันทึกว่าได้ 20 XP พอ retry/กดซ้ำ `complete-quest.js:48-54` คืน `xp_earned: 20` → UI ฉลอง "+20 XP" ที่ไม่เคยได้จริง |
| P1-5 | ไม่มี security header เลย | `netlify.toml` | ไม่มี CSP / `frame-ancestors` → เอาหน้าจ่ายเงินไป iframe แล้ว clickjack ได้ และถ้ามี XSS สักจุดก็ขโมย session ได้เต็ม ๆ |
| P1-6 | หน้าขายพรีเมียมโฆษณาฟีเจอร์ที่ยังไม่มี | `Premium.jsx:32-43` | โฆษณา streak freeze / mascot skin / badge แต่ `schema.sql:405-409` รีเซ็ต streak เป็น 1 ตามปกติ ไม่มีสาขาพรีเมียมเลย, leaderboard ทิ้ง `is_premium` ทิ้ง, ไม่มี skin selector — **เก็บเงินแล้วไม่ได้ของ** |
| P1-7 | moderation บล็อกหัวข้อที่ควรเรียนได้ | `topicModeration.js:22` จับแบบ substring | ทดสอบจริงแล้ว: `"การขายตัวเลือกหุ้น"` โดนบล็อกเพราะ substring `"ขายตัว"`, `"วิธีฆ่าเชื้อโรค"` โดน `"วิธีฆ่า"` — ผู้ใช้จริงเจอข้อความ "หัวข้อนี้ไม่เข้าข่ายฯ" ทั้งที่พิมพ์หัวข้อสุจริต |
| P1-8 | เรียก Gemini ไม่มี timeout | `_shared/gemini.js:56-101` | `fetch` ไม่มี `AbortSignal` และ chain 3 โมเดล + backoff รวมกันเกิน 10 วิของ Netlify ได้ → ตัดกลางคัน ทิ้ง claim ค้างสถานะ `generating` ผู้ใช้ติด 2 นาที |
| P1-9 | ใช้ path สลิปเดิมยื่นซ้ำได้ | `submit-slip.js:6-8`, `schema.sql:613` | เช็คแค่ว่า path ขึ้นต้นด้วย uid ตัวเอง ไม่เช็คว่าไฟล์นี้เคยถูกใช้อนุมัติไปแล้ว `slip_url` ไม่ unique — ถ้าแอดมินดูไม่ละเอียดจะต่ออายุให้ฟรี |

---

## P2 — เก็บกวาด (ไม่บล็อกการเปิดตัว)

- `friendships` เป็นตารางเดียวที่เปิดให้ client เขียนได้ (`schema.sql:930-934`) — insert ได้โดยไม่บังคับ `status='pending'` และ update ได้ทุกคอลัมน์ ฟีเจอร์นี้ยังไม่ได้ใช้งานเลย ควร revoke เหมือนที่ทำกับ `push_subscriptions` ไปแล้ว
- `leaderboard` view ไม่ได้เป็น `security_invoker` (โดยตั้งใจ) แต่ปล่อย `user_id` (UUID จริง) + `avatar_url` + `is_premium` ออกไปโดยไม่มีใครใช้ และคอลัมน์ `leaderboard_opt_out` **ไม่มี UI ให้กดปิดเลย** → เปลี่ยน `select('*')` เป็น `select('rank, user_id, display_name, total_xp')` ที่ `Leaderboard.jsx:14,18` + เพิ่มสวิตช์ opt-out
- moderation ชั้นที่ 1 เลี่ยงได้ง่าย (ทดสอบจริง: `"ค่วย"` ใส่วรรณยุกต์, `"ค⁠วย"` ใส่ U+2060, `"p o r n"`, `"ｐｏｒｎ"` ตัวเต็มความกว้าง ผ่านหมด) — **แต่ไม่ยกเป็น P1 เพราะไฟล์ระบุชัดว่าเป็นด่าน 1 จาก 2** ด่าน 2 คือ Gemini `topic_ok` ยังตรวจต่ออีกชั้น เพิ่ม NFKC normalization ก็พอ
- `quest-today` เป็น GET แต่เขียน DB + เรียก Gemini (`quest-today.js:113`) — prefetch/retry ของ browser ยิงงานจริงได้
- `Coach.jsx:83` และ `Leaderboard.jsx:24` ใส่ `user` (object) ใน dependency ของ `useEffect` แทน `user?.id` → token refresh ทุกชั่วโมงยิง `quest-today` ใหม่ (= เปลือง Gemini) หน้าอื่นทำถูกหมดแล้ว
- `Quest.jsx:107` poll ทุก 3 วิไม่มีเพดานจำนวนครั้ง — แท็บค้างข้ามคืน = ~28,000 invocations
- `link_url` จากตาราง starter/curated ไม่ผ่าน whitelist (`questGenerator.js:43,637`) ต่างจาก link ที่ AI สร้างซึ่งกรองครบ — วันนี้ยังปลอดภัยเพราะ seed เขียนมือ
- `.scratch/qa-2026-07-23/qa-run.mjs` ชี้ production + มีรหัสผ่าน hardcode + เขียน `created_at` ทับผู้ใช้จริง — ควรถอดออกจาก git
- `.scratch/wave2/RESUME.md:185` มี UUID แอดมิน + ชื่อจริงเจ้าของ (repo private อยู่ แต่จะเอาไปโชว์อาจารย์)
- `README.md:5` ยังเขียนว่า "Spec-driven planning phase" ทั้งที่ขึ้น production แล้ว
- ไม่ได้ pin `NODE_VERSION` ใน `netlify.toml` ทั้งที่ `@supabase/supabase-js` 2.110.3 ต้องการ Node ≥ 22
- `deno.lock` ค้างอยู่ทั้งที่ไม่มี edge function

---

## ตรวจแล้วผ่าน (สิ่งที่ทำถูกอยู่แล้ว — อย่าไปรื้อ)

- **ไม่มี secret หลุด git เลย** สแกนทุก object ทุก branch (321 blobs) หา `eyJ`/`AIza`/`GOCS`/เลข PromptPay — ศูนย์ ที่เจอจาก `git log -S` เป็นแค่ชื่อตัวแปร ไม่ต้อง rotate key
- `.env` ถูก ignore จริง (`git check-ignore -v .env` → `.gitignore:5`), bundle ที่ deploy มี JWT ตัวเดียวที่ decode ได้ `role: anon` ถูกต้อง, ไม่มี service-role key / Gemini key / เบอร์ PromptPay ใน `dist/`
- **RLS ปิดครบทุกตาราง** และ `profiles_update_own` (`schema.sql:826-843`) ล็อกคอลัมน์ระบบไว้ครบ — `is_premium`, `is_admin`, `total_xp`, `current_streak`, `referral_code` ผู้ใช้แก้เองไม่ได้เลย นี่คือด่านที่สำคัญที่สุดและทำไว้ถูก
- `complete_quest` / `redeem_referral` / `verify_payment` เป็น SECURITY DEFINER ที่ pin `search_path` ครบ และ **revoke EXECUTE จาก anon/authenticated แล้ว** — ยิง PostgREST ตรงไม่ได้
- ทำเควสเดิมซ้ำไม่ได้ XP ซ้ำจริง — `for update` บนแถว profiles + `unique(user_id, quest_id)` + `on conflict do nothing` ทำงานถูกต้องแม้ยิงพร้อมกัน
- 13 จาก 14 functions เรียก `requireUser()` และ verify token กับ Supabase จริง (ไม่ได้เชื่อ user_id จาก body) — มีแค่ `pre-generate-quests` ที่เป็นข้อยกเว้น (P0-4)
- **ไม่มี XSS**: ไม่มี `dangerouslySetInnerHTML` / `eval` / `innerHTML` ใน `src/` เลย ข้อความจาก AI ลงเป็น text node ของ React ทั้งหมด
- ราคา 39 บาทและ ref code สร้างฝั่ง server ทั้งคู่ client ส่งค่ามาเองไม่ได้ และ `admin-payments` เช็ค `is_admin` จาก DB จริง ไม่ได้เชื่อ claim จาก client
- link ที่ AI สร้างถูกกรองด้วย whitelist HTTPS (google/youtube search เท่านั้น) ก่อนเก็บลง DB ทุกเส้นทาง
- ไม่มี email ของผู้ใช้หลุดไป client ที่ไหนเลย
- ปุ่มที่เกี่ยวกับเงิน/XP มี guard กันกดซ้ำครบ (`switchingRef`, `deletingRef`, `creating`, `claiming`)

---

## ลำดับที่แนะนำให้ลงมือ

1. **P0-3** (เพดาน XP รวมต่อวัน) — แก้ SQL ที่เดียว ปิดช่องปั๊มคะแนนที่ใช้วัดผลวิชา
2. **P0-5** (พรีเมียมไม่หมดอายุ) — แก้ 4 บรรทัด ใช้ `isPremiumActive()` ที่มีอยู่แล้ว
3. **P0-4** (บังคับ secret ใน pre-generate) — แก้ 2 บรรทัด + ตั้ง env
4. **P0-1 + P0-2** (จองโควตา Gemini ก่อนยิง) — งานใหญ่สุด ต้องเขียน RPC ใหม่
5. **P1-2** (เพดาน bucket) — SQL คำสั่งเดียว
6. **P1-6** (ถอดโฆษณาฟีเจอร์ที่ยังไม่มี) — เรื่องความซื่อสัตย์ต่อผู้ใช้ที่จ่ายเงิน แก้ถูกที่สุด

## ต้องไปเช็คในแดชบอร์ดเอง (agent ไม่มีเน็ต ตรวจแทนไม่ได้)

- Supabase → Auth → Providers: **email/password ยังเปิดอยู่ไหม** (ผูกกับ P1-1 โดยตรง)
- Supabase → Storage → bucket `payment-slips`: มี size/MIME limit ตั้งไว้ในแดชบอร์ดหรือยัง
- Netlify → env: มี `PREGEN_BYPASS_SECRET` หรือยัง
- `profiles.total_xp` ของผู้ใช้ที่มีอยู่ตอนนี้ตรงกับ ledger `xp_awards` ไหม (ถ้าเคยมีคนปั๊มก่อน migration 4 ส.ค. ตัวเลขจะค้างสูงเกินจริง — แต่ถ้าล้างข้อมูลทดสอบไปแล้วก็จบ)
