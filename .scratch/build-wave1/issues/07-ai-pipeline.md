# AI pipeline: สร้าง roadmap + แชทโค้ช + fallback chain

Type: task
Status: closed (14 ก.ค. 2026, commit 2f67f74)
Blocked by: 01, 03

## งานที่ต้องทำ

เขียนส่วนที่เรียก Gemini ตามกลยุทธ์โควต้า (#03):

- generate roadmap เฉพาะตัว (`gemini-3-flash`) — cache ลง Supabase ตลอดชีพ
- แชท AI โค้ช (`flash-lite`) — จำกัด 10 ข้อความ/คน/วัน
- โหมดพิมพ์อิสระ: AI เขียนเควส แต่ลิงก์ผ่าน whitelist/ลิงก์ค้นหาเท่านั้น (guardrail จาก #05)
- fallback chain: 3-flash → lite → 2.5-flash → เควส static + exponential backoff

## เสร็จเมื่อ

generate roadmap ได้จริงและถูก cache, แชทตอบได้และตัดที่ข้อความที่ 11, ลองบีบให้ล้มแล้ว fallback ทำงาน, ไม่มีลิงก์นอก whitelist หลุดออกมา — ยืนยันด้วย `/verify`
