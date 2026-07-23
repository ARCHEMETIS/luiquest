# วางโครงโปรเจกต์ Vite + React + PWA ใน repo luiquest

Type: task
Status: done (14 ก.ค. 2026, push แล้วที่ commit `750ee86`)
Blocked by: —

## งานที่ต้องทำ

สร้าง scaffold ตาม tech stack ที่ล็อก (#07) + โครงโปรเจกต์ (#16):

- Vite + React (JSX) + Tailwind CSS + React Router — SPA
- `vite-plugin-pwa` (installable, responsive มือถือ + iPad)
- โครง `netlify/functions/` + `netlify.toml` (รวม cron ของ scheduled function ตี 2–5 ไทย)
- ไฟล์ `.env.example` ตาม 5 env ใน deploy-plan
- จัดบ้านให้ repo `ARCHEMETIS/luiquest`; **เคลียร์เรื่องโฟลเดอร์ `new app/` → `luiquest/`** ที่ค้างจาก ticket #05 (rename ให้เรียบร้อยตอนนี้)

## เสร็จเมื่อ

`npm run dev` ขึ้นหน้าเปล่าได้ในเครื่อง, build ผ่าน, โครงโฟลเดอร์ตรงกับ deploy-plan — พร้อมรับ component ของเพื่อนและ function มาเสียบ

## ผลลัพธ์ (14 ก.ค. 2026)

- ✅ scaffold Vite + React + Tailwind + React Router + `vite-plugin-pwa` + `netlify/functions/` + `netlify.toml` (มี cron scheduled function) + `.env.example` — `npm run dev` / `npm run build` ผ่าน และรับ component เพื่อน + functions มาเสียบได้จริงตั้งแต่ ticket 05–09
- ✅ commit + push ขึ้น GitHub แล้ว (`750ee86`) — ก่อนหน้านี้ค้างในเครื่องอย่างเดียวจนเพื่อน branch PR จากจุดเก่า เกิด diverged history ต้อง merge reconcile (**บทเรียน: push บ่อยหลังงานสำคัญเสร็จ**)
- ⬜ **ไม่ได้ rename โฟลเดอร์ `new app/` → `luiquest/`** ตามที่ ticket เขียนไว้ — ตัดสินใจปล่อยไว้เพราะจะทำให้ path ทุกที่ (สเปก/ticket/สคริปต์/เพื่อน) พังพร้อมกันโดยไม่ได้อะไรกลับมา; โครงข้างในตรง deploy-plan แล้ว
