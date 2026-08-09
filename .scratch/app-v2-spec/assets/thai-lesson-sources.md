# แหล่งบทเรียนไทยสำหรับ 6 หัวข้อเปิดตัว (LuiQuest)

ผลจาก ticket [คัดแหล่งบทเรียนไทยสำหรับ 6 หัวข้อเปิดตัว](../issues/12-thai-lesson-sources.md) — ทุก URL ผ่านการเช็ค HTTP 200 จริงเมื่อ 12 ก.ค. 2026 (curl + browser UA)

หลักการ (จาก ticket [ขอบเขตหัวข้อเรียน](../issues/02-topic-scope.md)): แหล่งไทยก่อน อังกฤษเสริม, เควสลิงก์ได้เฉพาะหน้าหลักโดเมนใน whitelist หรือลิงก์ค้นหา — ห้ามแต่ง deep URL

---

## 1. Python เริ่มจากศูนย์

| แหล่ง | URL | ภาษา | หมายเหตุ |
|---|---|---|---|
| borntoDev School — Zero to One: Python | https://school.borntodev.com/course/zero-to-one-python | ไทย | คอร์สวิดีโอฟรี สมัครฟรี — แกนหลัก |
| KongRuksiam Official (YouTube) | https://www.youtube.com/@KongRuksiamOfficial | ไทย | คลิป Python ผู้เริ่มต้นยาวจบในตัว + เอกสารที่ https://github.com/kongruksiamza/programmer-class-room |
| Skooldio — เขียน Python พื้นฐานในคลิปเดียว | https://www.skooldio.com/courses/free-basic-python | ไทย | คอร์สฟรี สั้น เหมาะเควสแรก ๆ |
| CHULA MOOC — Learn Python | https://mooc.chula.ac.th/course-detail/17 | ไทย | ฟรี มีใบประกาศจุฬาฯ **แต่เปิดรับเป็นรอบ** — ใช้เป็นตัวเสริม อย่าผูกเควสบังคับ |
| W3Schools Python (เสริมอังกฤษ) | https://www.w3schools.com/python/ | อังกฤษ | อ่าน+รันโค้ดในเบราว์เซอร์ ใช้เป็น reference |

**โครงบทเรียนคร่าว ๆ:** ติดตั้ง Python / ใช้ Google Colab → ตัวแปร+ชนิดข้อมูล+input/print → if-else → loop → ฟังก์ชัน → list/dict → อ่านไฟล์+error พื้นฐาน → มินิโปรเจกต์ (เช่น โปรแกรมบันทึกรายจ่าย)

## 2. Data/ML

ยก roadmap Kaggle จาก ml-quest เดิมมาเป็นแกน (ตัดสินใจแล้วใน ticket #02) — เพิ่มแหล่งไทยเป็นตัวประกบ

| แหล่ง | URL | ภาษา | หมายเหตุ |
|---|---|---|---|
| Kaggle Learn | https://www.kaggle.com/learn | อังกฤษ | แกนหลัก — คอร์ส+exercise ฟรี ลิงก์เสถียร ผ่านการใช้จริงใน ml-quest |
| DataRockie | https://datarockie.com/ | ไทย | บล็อก+คอร์สฟรี Data Analytics ครบสาย |
| DataTH | https://blog.datath.com/ | ไทย | บทความ Data Science ไทย + หนังสือฟรี Python for Data Science |
| PrasertCBS (YouTube) | https://www.youtube.com/@prasertcbs | ไทย | อาจารย์จุฬาฯ สอน Python/Pandas/SQL/R ละเอียด |
| Google ML Crash Course (เสริม) | https://developers.google.com/machine-learning/crash-course | อังกฤษ | ทฤษฎี ML ภาพสวย ฟรี |

**โครงบทเรียนคร่าว ๆ (ยกจาก ml-quest):** Python & Data Wrangling (Pandas) → Core ML (Intro to ML, Intermediate ML) → Deep Learning → Specialize & Portfolio (โปรเจกต์ dataset จริง)

## 3. สร้างเว็บ (HTML/CSS/JS)

| แหล่ง | URL | ภาษา | หมายเหตุ |
|---|---|---|---|
| Code-TH.com | https://code-th.com/ | ไทย | บทเรียน HTML/CSS/JS/PHP/SQL อ่านฟรี ลองโค้ดบนหน้าเว็บได้ — แกนหลักสายอ่าน |
| borntoDev — Fundamental Web Dev with HTML5 & CSS3 | https://www.borntodev.com/fundamental-web-dev-with-html5-css3/ | ไทย | คอร์สฟรี — แกนหลักสายวิดีโอ |
| KongRuksiam Official (YouTube) | https://www.youtube.com/@KongRuksiamOfficial | ไทย | เพลย์ลิสต์ HTML/CSS/JavaScript ฟรี |
| MDN Learn Web Development (เสริม) | https://developer.mozilla.org/en-US/docs/Learn_web_development | อังกฤษ | reference มาตรฐาน |
| freeCodeCamp (เสริม) | https://www.freecodecamp.org/learn | อังกฤษ | แบบฝึกหัด interactive + certification ฟรี |

**โครงบทเรียนคร่าว ๆ:** HTML โครงสร้างหน้า → CSS จัดหน้า/สี/ฟอนต์ → Flexbox/Grid + responsive → JS พื้นฐาน + DOM → ฟอร์ม+event → โปรเจกต์เว็บโปรไฟล์ตัวเอง + deploy ฟรี (GitHub Pages/Netlify)

## 4. ใช้ AI ให้เป็น

| แหล่ง | URL | ภาษา | หมายเหตุ |
|---|---|---|---|
| Skooldio — Unlock AI with Prompt Engineering | https://www.skooldio.com/courses/bdi-unlock-ai-with-prompt-engineering | ไทย | คอร์สฟรี (ร่วมกับ BDI) — แกนหลัก |
| depa Digital Skill | https://www.digitalskill.org/ | ไทย | แพลตฟอร์มรัฐ คอร์สดิจิทัล/AI ฟรี มีใบประกาศ |
| YouTube ไทย (ลิงก์ค้นหา) | https://www.youtube.com/results?search_query=สอนใช้+ChatGPT | ไทย | ใช้ pattern ลิงก์ค้นหาตาม guardrail — คลิปสอนใช้ AI ไทยเยอะแต่กระจาย ไม่มีช่องเดียวครอบทั้งหัวข้อ |
| Google AI Essentials (Coursera, เสริม) | https://www.coursera.org/learn/google-ai-essentials | อังกฤษ | audit ฟรี (ดูวิดีโอได้ ทำ quiz ไม่ได้) |

**โครงบทเรียนคร่าว ๆ:** AI ทำอะไรได้/ไม่ได้ + ข้อจำกัด → สมัครใช้ ChatGPT/Gemini ฟรี → หลักเขียน prompt (บริบท-คำสั่ง-ตัวอย่าง-รูปแบบผลลัพธ์) → use case เรียน/งานเอกสาร/สรุป/แปล → เครื่องมือ AI สร้างรูป/สไลด์ → จริยธรรม + ตรวจสอบข้อเท็จจริง

## 5. Excel/Google Sheets

| แหล่ง | URL | ภาษา | หมายเหตุ |
|---|---|---|---|
| เทพเอ็กเซล | https://www.thepexcel.com/ | ไทย | คลังบทเรียน Excel ไทยฟรีที่ละเอียดสุด — แกนหลักสายอ่าน |
| borntoDev School — Excel for Everyone | https://school.borntodev.com/course/excel-for-everyone | ไทย | คอร์สวิดีโอฟรี — แกนหลักสายวิดีโอ |
| 9Expert Training (บทความ) | https://www.9experttraining.com/articles | ไทย | บทความ Excel/Power BI ฟรี |
| Microsoft Support ภาษาไทย | https://support.microsoft.com/th-th/excel | ไทย | คู่มือทางการ แปลไทย |
| YouTube ไทย (ลิงก์ค้นหา Google Sheets) | https://www.youtube.com/results?search_query=Google+Sheets+พื้นฐาน | ไทย | ฝั่ง Sheets ใช้ลิงก์ค้นหา |

**โครงบทเรียนคร่าว ๆ:** รู้จักหน้าจอ+กรอกข้อมูล → สูตรพื้นฐาน SUM/AVERAGE/COUNT → IF + เงื่อนไข → จัด format + conditional formatting → VLOOKUP/XLOOKUP → PivotTable → มินิโปรเจกต์ dashboard รายจ่าย

## 6. การเงินส่วนบุคคล

| แหล่ง | URL | ภาษา | หมายเหตุ |
|---|---|---|---|
| SET e-Learning | https://elearning.set.or.th/ | ไทย | คอร์สฟรีมีใบประกาศ (เช่น "หลักการลงทุน") **ต้องสมัครสมาชิก SET ฟรี** — แกนหลัก |
| SET Invest Now | https://www.setinvestnow.com/ | ไทย | บทความ/ห้องเรียนนักลงทุน อ่านฟรีไม่ต้องล็อกอิน |
| แบงก์ชาติ — สตางค์ Story | https://www.bot.or.th/th/satang-story.html | ไทย | ความรู้การเงินพื้นฐานจาก ธปท. |
| aomMONEY | https://aommoney.com/ | ไทย | บทความการเงินภาษาบ้าน ๆ (**โดเมนไม่มี www** — https://www.aommoney.com/ เข้าไม่ได้) |
| Money Buffalo | https://www.moneybuffalo.in.th/ | ไทย | ข่าว/พื้นฐานการเงิน อ่านง่าย |

**โครงบทเรียนคร่าว ๆ:** ทำงบส่วนตัว รายรับ-รายจ่าย → เงินออมฉุกเฉิน 3-6 เดือน → หนี้+ดอกเบี้ย (บัตรเครดิต/กยศ.) → ภาษีเงินได้เบื้องต้น → เริ่มลงทุน (เงินฝาก/กองทุนรวม/หุ้น) → วางแผนเป้าหมายระยะยาว

---

## Whitelist โดเมน (guardrail โหมดพิมพ์อิสระ)

AI แนบลิงก์ได้เฉพาะ (ก) **หน้าหลัก**ของโดเมนเหล่านี้ (ข) **ลิงก์ค้นหา** ตาม pattern ท้ายรายการ — ห้ามแต่ง deep URL

```
school.borntodev.com
www.borntodev.com
www.youtube.com
github.com
mooc.chula.ac.th
www.skooldio.com
www.w3schools.com
www.kaggle.com
datarockie.com
blog.datath.com
developers.google.com
code-th.com
developer.mozilla.org
www.freecodecamp.org
www.digitalskill.org
www.coursera.org
www.thepexcel.com
www.9experttraining.com
support.microsoft.com
elearning.set.or.th
www.setinvestnow.com
www.bot.or.th
aommoney.com
www.moneybuffalo.in.th
```

**Pattern ลิงก์ค้นหาที่อนุญาต:**
- YouTube: `https://www.youtube.com/results?search_query=<คำค้น>`
- Google: `https://www.google.com/search?q=<คำค้น>`

## ลิงก์บทเรียนเฉพาะหน้า (เพิ่มได้หลังคนตรวจแล้วเท่านั้น)

อนุญาตให้ใช้ URL ของบทเรียน บทความ หรือวิดีโอเฉพาะชิ้นได้ เมื่อมีคนเปิดลิงก์และยืนยันแล้วว่าเข้าถึงเนื้อหาที่ระบุได้จริง จากนั้นเพิ่ม URL แบบเต็มไว้ในไฟล์นี้เพื่อให้ validator ยอมรับ ห้ามเดาหรือแต่ง deep URL เอง

รูปแบบที่เพิ่ม: `- ชื่อแหล่ง — ชื่อบทเรียน/บทความ/วิดีโอ — <URL ที่เปิดตรวจแล้ว> — ตรวจโดย ชื่อผู้ตรวจ เมื่อ YYYY-MM-DD`

## แหล่งที่พิจารณาแล้วตัดออก (12 ก.ค. 2026)

- **ThaiMOOC** — แพลตฟอร์มกำลังย้ายระบบ (thaimooc.ac.th ขึ้น "under construction", ตัวเรียนจริงย้ายไป academy.thaimooc.ac.th) + สมัครต้องยืนยันบัตรประชาชน — รอเสถียรค่อยเพิ่มรอบหน้า
- **ศคง. 1213.or.th (ธปท.)** — เว็บเข้าไม่ได้ (connection ล้มเหลวทุกครั้งที่ลอง) ใช้ bot.or.th แทน
- **cbtumu.net** — เข้าได้แต่ที่มา/ความต่อเนื่องของหน่วยงานไม่ชัด ตัดเพื่อลดความเสี่ยงลิงก์ตาย
- **SkillLane / FutureSkill / Udemy** — โมเดลหลักเป็นคอร์สจ่ายเงิน ขัดหลัก "ฟรีจริง"
