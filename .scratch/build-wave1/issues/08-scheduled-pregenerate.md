# Netlify Scheduled Function: pre-generate เควสรายวันกลางคืน

Type: task
Status: closed (14 ก.ค. 2026, commit 2f67f74)
Blocked by: 07

## งานที่ต้องทำ

ทำ scheduled function ที่รันตี 2–5 ไทย (cron ใน `netlify.toml` ตาม #16) เพื่อ pre-generate เควสวันถัดไปของผู้ใช้ที่ active ล่วงหน้า แล้ว cache ลง Supabase — กลางวันเป็นการอ่าน DB ล้วน ไม่ยิง Gemini ตอนคนออนไลน์พีค (แก้จุดตาย RPM ตาม #03)

## เสร็จเมื่อ

cron รันแล้วมีเควสวันถัดไปโผล่ใน DB ครบทุก active user, กลางวันเปิดแอพเจอเควสทันทีโดยไม่ trigger Gemini — ยืนยัน log การรัน
