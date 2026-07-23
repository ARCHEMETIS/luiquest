# จัดเตรียมบัญชี/โปรเจกต์คลาวด์ทั้งหมด

Type: task
Status: done (14 ก.ค. 2026)
Assignee: owner + claude (session 13–14 ก.ค. 2026)
Blocked by: —

## งานที่ต้องทำ

จัดตั้ง service ทั้งหมดที่ Wave 1 ต้องใช้ (ตาม `../app-v2-spec/assets/deploy-plan.md`) — งานนี้เจ้าของต้องทำเองบางส่วน (สมัคร/กดยืนยันในเว็บ) Claude ช่วยไล่เช็คลิสต์:

- **Supabase project ใหม่ชื่อ luiquest** (แยกจาก ml-quest) — เก็บ URL, anon key, service_role key
- **Google OAuth client** (Google Cloud Console) — สำหรับ Google Sign-in ผ่าน Supabase Auth; ตั้ง redirect URI ของ Supabase + `luiquest.netlify.app`
- **Netlify site** ต่อกับ repo `ARCHEMETIS/luiquest`, ตั้งชื่อ subdomain `luiquest`
- **Gemini API key** (AI Studio) + เช็คโควต้าจริงใน rate-limit dashboard (ตาม ticket โควต้า #03 เดิม)

## เสร็จเมื่อ

มี credential ครบทั้ง 5 ตัว (Supabase URL/anon/service_role, Google OAuth client id/secret, Gemini key) เก็บที่ปลอดภัย + จดว่าเก็บไว้ที่ไหน ให้ ticket deploy/functions หยิบไปใช้ได้ (service_role & Gemini key ห้ามขึ้น prefix `VITE_`)

## ความคืบหน้า (13 ก.ค. 2026)

- **Supabase** ✅ project `luiquest` (ref `lvmytvdruufgfvijmjhl`, region Singapore) — URL/anon/service_role อยู่ใน `new app/.env`
- **Gemini** ✅ ใช้ key เดิมจาก ml-quest (portfolio ไม่ใช้แล้ว) — อยู่ใน `.env`
- **Google OAuth** ✅ consent screen (External, published **production**) + client `luiquest-web` (Client ID `738044975865-...`, redirect `https://lvmytvdruufgfvijmjhl.supabase.co/auth/v1/callback`); เปิด Google provider ใน Supabase + ใส่ Client ID/Secret; Site URL = `luiquest.netlify.app`; redirect dev `localhost:8888`
- **Netlify site** ⏸️ ยังไม่ทำ — รอ repo จาก ticket 02 (import repo → ตั้งชื่อ site → ใส่ env 5 ตัว)
- **ค้างเล็กน้อย:** ปิด Email/Password provider ใน Supabase (ตาม #04 Google อย่างเดียว) — ไม่กระทบการทำงาน ทำตอนไหนก็ได้

## ปิด ticket (15 ก.ค. 2026)

- **Netlify site** ✅ สร้างจริงแล้วชื่อ `luiquest` (`luiquest.netlify.app`) เชื่อม GitHub `ARCHEMETIS/luiquest` branch `main` + import env 5 ตัวจาก `.env` ผ่าน UI → credential ครบทั้ง 5 ตามเงื่อนไข "เสร็จเมื่อ"
- **โควต้า Gemini จริงกับ AI Studio dashboard** ยังไม่ได้เช็ค → ยกไปเป็นข้อหนึ่งของ ticket 11 (ไม่บล็อกงานอื่น)
- ค้างเล็กน้อยที่ยังไม่ทำ: ปิด Email/Password provider ใน Supabase
