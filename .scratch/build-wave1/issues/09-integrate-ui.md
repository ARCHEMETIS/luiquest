# เสียบ React components ของเพื่อน: auth + onboarding + ลูปเล่น

Type: task
Status: closed (21 ก.ค. 2026, commit `3e32733` → `0811722` → `a0f0b29` push แล้ว)
Blocked by: 02, 06

## งานที่ต้องทำ

เอา React components 10 หน้าจากเพื่อน (ตาม `design-brief-ui.md`) มาต่อชีวิตจริง:

- ต่อ routing (React Router) ทั้ง 10 หน้า + app shell
- Google Sign-in ผ่าน Supabase Auth (ดึงชื่อ/รูปจาก Google อัตโนมัติ)
- onboarding 3 ขั้น (หัวข้อ → ระดับ → เวลา/วัน) → เสิร์ฟ starter quest ทันที
- เสียบ state/API หน้าเล่น: เควสรายวัน, checklist, XP/streak/phase/grade, แชทโค้ช
- edge states ครบ (loading, ว่าง, error) ตาม brief

## เสร็จเมื่อ

เดินลูปเต็มในเครื่องได้: ล็อกอิน Google → onboarding → เห็นเควสแรก → ทำเสร็จได้ XP → แชทได้ — ยืนยันด้วย `/verify` + `/run`

## ความคืบหน้า (14 ก.ค. 2026)

เพื่อนส่ง component มาทาง GitHub PR (`frontend/add-ui-components`, merge แล้ว) — ได้ 4/10 หน้า: `LoginPage.jsx`, `OnboardingFlow.jsx` (ครบ 3 ขั้น), `DailyQuestPage.jsx`, `CoachChatPage.jsx` + component ใช้ร่วม `GhostMascot.jsx`/`LuiQuestLogo.jsx` อยู่ใน `src/components/` แล้ว (commit `750ee86`, push ขึ้น GitHub แล้ว) โค้ดตรง design brief (JSX+Tailwind, mock data บนหัวไฟล์, มี state toggle ครบ edge states), `npm run build` ผ่าน

**ยังขาด:** Leaderboard, ชวนเพื่อน, การ์ดแชร์ streak, /stats, app shell/navigation (6 หน้า) — รอเพื่อนส่งเพิ่ม

## Wiring 4 หน้าที่มี — เสร็จแล้ว (14 ก.ค. 2026 ค่ำ, commit `9f08d0f` push แล้ว)

ลูปเต็มเดินได้จริงในเครื่อง ยืนยันด้วยเบราว์เซอร์จริง + บัญชี Google จริง + production Supabase/Gemini:
ล็อกอิน Google → onboarding 3 ขั้น (curated ยิง `start-roadmap` ระหว่างหน้าคั่น) → เห็นเควสแรกทันที →
ติ๊ก checklist ครบ → เคลม XP → ฉากฉลอง (+XP/streak) → แชทโค้ช (Gemini ตอบจริง, โควต้านับถูก) ✅

สิ่งที่เพิ่ม: `AuthProvider` context (useAuth), `useProfile` hook (`activeRoadmapId`/`patchProfile`/`error`),
`src/lib/topics.js` (map การ์ดเพื่อน→slug จริง), `src/pages/Coach.jsx` + route `/coach`, auth guard ทุก route

บั๊กที่เจอ+แก้ระหว่าง verify + code review 8 มุม:
1. **auth loop**: แต่ละหน้าเรียก `useAuth()` แยกกัน → ช่วง session=null ก่อน getSession resolve ทำ redirect ปิงปอง + ยิง `/me` ไม่หยุด → แก้เป็น context เดียวที่ App
2. **ฉากฉลองโดนข้าม**: guard `profileLoading` เด้ง quest prop กลับ MOCK ชั่วคราวระหว่าง refetch → claimResult ถูกรีเซ็ต → แก้ guard + เปลี่ยน refetch เป็น `patchProfile` จาก response ของ complete-quest (ประหยัด invocation ด้วย)
3. **ประวัติแชทเรียงผิด**: `asc+limit(50)` ได้เก่าสุด 50 แถว → โควต้าเพี้ยนเมื่อแชทเกิน 50 แถว → แก้เป็น desc+reverse (แพทเทิร์นเดียวกับ chat.js)
4. **state "streak ขาด" ไม่มีทางโผล่**: backend รีเซ็ต streak แบบ lazy — เช็คจาก `last_quest_date` แทน `current_streak`
5. **/me ล้มเหลวชั่วคราว = เด้งกลับ onboarding ผิด ๆ**: เพิ่ม `error` ใน useProfile + gate redirect + หน้า retry

**Known follow-ups (ยอมรับได้ ยังไม่ทำ):** useProfile ยังเรียกแยกต่อหน้า (โหลดใหม่ทุก navigation — ถูกต้องแต่ไม่ประหยัดสุด ถ้าหน้าเยอะขึ้นค่อยยกเป็น context แบบ useAuth), GRADE_BANDS ใน Quest.jsx ต้อง sync มือกับ gameplay.js ถ้า threshold เปลี่ยน, preview toggle ของ component เพื่อนบางตัวเป็น dead path แล้ว (ไม่กระทบ production)

**เหลือปิด ticket:** wiring 6 หน้าที่เหลือเมื่อเพื่อนส่ง component มา (backend/API พร้อมหมดแล้ว)

## ความคืบหน้า (21 ก.ค. 2026)

เพื่อนส่ง component ที่เหลือครบแล้วผ่าน PR `frontend/add-leaderboard-streak-stats-appshell`: `LeaderboardPage.jsx`, `StatsPage.jsx`, `StreakCardPage.jsx`, `AppShell.jsx`, `ProfileDrawer.jsx` (+ `LuiQuestLogo.jsx` ได้ prop `size` เพิ่ม แบบ non-breaking) — **แต่ `AppShell`/`ProfileDrawer` ออกแบบมาบนโมเดล tab-switching ชั้นเดียว ไม่ตรงกับ routing จริงที่ใช้ React Router แยก route ต่อหน้า** ต้องปรับก่อนเสียบจริง รายละเอียดเต็ม + prop-mapping ของอีก 3 หน้า + open questions (`/stats/:handle` vs view รวมทั้งแอพ, ปุ่ม upgrade ยังไม่มี backend) → [09-integrate-ui-remaining-pages.md](09-integrate-ui-remaining-pages.md)

## ปิด ticket — wiring ครบทั้ง 10 หน้า (21 ก.ค. 2026)

**3 decisions ที่เจ้าของเคาะ (open questions จาก handoff note):**
- `/profile` → **redirect ไป `/quest`** ไม่มีหน้าโปรไฟล์แยก (ตาม `design-brief-ui.md` บรรทัด 160) — ใช้ ProfileDrawer overlay แทน
- `/stats` → **หน้าเดียวสาธารณะ** (drop `:handle`) aggregate รวมทั้งแอพ ไม่มี PII
- ลิงก์ชวน → ทำครบ flow `/invite/<code>` (เก็บโค้ดไว้ → หลังล็อกอิน redeem อัตโนมัติ)

**สิ่งที่ทำ (commit `3e32733`):** `AppShellLayout.jsx` (nav ถาวร NavLink + `<Outlet/>` + drawer overlay, port ดีไซน์จาก `AppShell.jsx` ของเพื่อนครบ), wire Leaderboard/Stats อ่าน view ตรงผ่าน `supabaseClient`, StreakCard เป็น overlay ในหน้าเควส, ProfileDrawer (สรุปบัญชี + สลับหัวข้อผ่าน `switch-roadmap` + ลิงก์ชวน + นับเพื่อนจาก `referrals` + logout; ปุ่ม premium ซ่อนไว้ = Wave 2), เพิ่ม `api.redeemReferral`, re-add `heightClass` ให้ DailyQuest/Coach fit ในเชลล์ — **`me.js` คืน `referral_code` + roadmaps ครบอยู่แล้ว ไม่ต้องแก้ backend**

**รีวิว 2 รอบ เจอ 15 แก้ 14:**
- รอบแรก (รีวิว diff — codex + เอง) 8/7: ใช้ rank จริงจาก view ไม่ recompute จาก index, fallback `display_name` null กัน `.charAt(0)` crash, คน opt-out ไม่แอบอ้าง #1, key ใช้ `user_id`, ปุ่มแชร์ copy ได้จริงบนเดสก์ท็อป, ปุ่มเซฟการ์ดข้อความตรงจริง, regex icon "HTML" ≠ "ml" (ข้าม 1: headline ใช้ `activated_total` ถูกตาม spec §7 แล้ว)
- รอบสอง (อ่านไฟล์เต็ม + เจาะ flow ที่ยังไม่ e2e, commit `0811722`) 7/7: `/stats` **crash จริง** ถ้า `public_stats` fetch error (data=null แต่ render อ่าน `data.growth`) → error state + guard `Math.max(...,1)`; ตัด `useLiveTick` ที่สุ่มเลขเพิ่ม (หน้า proof อาจารย์ต้องเป็นเลขจริง, activePct เคยทะลุ 100%); InviteRedeemer เก็บ pending code ไว้ retry ถ้า 5xx/network (ลบเฉพาะ success/4xx); Coach จอขาวถาวรถ้า `/me` fail → retry state; Quest sequence-guard ทิ้ง `quest-today` เก่าตอนสลับหัวข้อ; ProfileDrawer `useRef` guard กัน double-tap; count ผูกกับ `isOpen`
- **บทเรียน: รอบแรกรีวิว diff, รอบสองอ่านไฟล์เต็ม — รอบสองเจอของหนักกว่า**

**เจ้าของเทสเจอ "ขึ้นเควสไม่พร้อม" → แก้แล้ว (commit `a0f0b29`):** ทำเควสครบของวันแล้วแต่ `quest-today` คืน `not_ready` เหมือนกรณี generate ล้ม → frontend โชว์ error ผิด. แก้: backend คืน status **`done_today`** แยก → Quest.jsx map เป็น state **`restday`** ("เควสวันนี้จบแล้ว! พักได้ — ตี 5 พรุ่งนี้มีใหม่" ไม่มีปุ่ม retry)

**⚠️ บทเรียน codex:** ให้ codex เขียน wiring รอบแรก มัน**รื้อ component เพื่อนทิ้ง** (574→27 บรรทัด) จับได้ตอนเช็ค diffstat **ก่อน commit** → revert แล้ว wire เองทุกตัวแบบ surgical เก็บ markup; ส่วน routing/api/wrapper ที่ codex ทำดีเก็บไว้ — **อย่าปล่อย codex แก้ไฟล์ดีไซน์ใหญ่โดยไม่ verify diffstat**

**e2e (netlify dev + บัญชีเจ้าของ, 2 รอบ):** /stats (public, early-state, กราฟ growth จริง, หลังแก้โชว์ 50% = 1/2 จริง), /quest (shell เต็ม + เควสจริง + ลิงก์ YouTube), /leaderboard (rank + badge "คุณ" + few-state), ProfileDrawer (หัวข้อ 2/3 + badge active + ลิงก์ชวน `LQF18EB3` + logout), StreakCard — **render ครบ real data, zero console errors, build ผ่าน**

**Known follow-ups (ยกไป 11 / Wave 2):** icon หัวข้อ freeform ใช้ default เพราะ `me.js` ไม่ส่ง slug, การ์ด streak เซฟด้วยกดค้าง (ไม่ใช้ lib), coach quota premium >50 = Wave 2, GRADE_BANDS sync มือ (dedupe ไปแล้วบางส่วนใน `e60ad31`)
