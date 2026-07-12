# ชื่อแอพและแบรนด์

Type: grilling
Status: closed (12 ก.ค. 2026)
Blocked by: 01, 02

## Question

ชื่อแอพใหม่ (ไม่ล็อกกับ ML แล้ว), tagline หนึ่งประโยคที่อธิบายแอพให้คนแปลกหน้าเข้าใจใน 3 วินาที, โทน/ธีมของแบรนด์ (ยังคงธีม quest/RPG ไหม?) — ต้องรู้ก่อนว่าขายใคร (01) และขายอะไร (02) ชื่อนี้จะกลายเป็นชื่อโฟลเดอร์, repo GitHub, และ URL บน Netlify

**หมายเหตุ:** repo ถูกสร้างแล้วด้วยชื่อชั่วคราว `quest-learning-app` (https://github.com/ARCHEMETIS/quest-learning-app, public) — เมื่อ ticket นี้ปิด ต้อง `gh repo rename <ชื่อใหม่>` + เปลี่ยน title ใน README ("working title") + เปลี่ยนชื่อโฟลเดอร์ `new app/`

---

## Resolution (12 ก.ค. 2026)

- **ชื่อแอพ: ลุยเควส (LuiQuest)** — เจ้าของตั้งเอง: "ลุย" (โทนห้าว ลงมือเลย) + "เควส"; ชื่อโรมัน `luiquest` ใช้เป็นชื่อ repo และ URL (luiquest.netlify.app)
- **Tagline:** "อยากเก่งอะไร ลุยเลย — วันละเควส" — ครบ 3 ส่วน: multi-topic (อยากเก่งอะไร), โทนลุย, จังหวะรายวัน
- **โทนแบรนด์:** สนุก เป็นกันเองแบบไทย ๆ — ภาษาหลักของแบรนด์เป็นไทย มุกได้/meme ได้ เหมาะกับการแชร์ในกลุ่มมหาลัย; กลไก quest/XP/streak ยังอยู่ครบ (ตามฟีเจอร์ MVP #06) แต่การสื่อสารไม่ต้องเล่นคำเกม RPG จ๋า
- **งานตามหมายเหตุ:** repo renamed → `ARCHEMETIS/luiquest` ✅ (git remote อัพเดตแล้ว, URL เดิม redirect อัตโนมัติ), README title + tagline อัพเดตและ push แล้ว ✅; **โฟลเดอร์ `new app/` → `luiquest/` ยังค้าง** — โฟลเดอร์ถูกโปรแกรมอื่นเปิดใช้อยู่ (Explorer/editor) rename ไม่ผ่าน ให้ปิดโปรแกรมที่เปิดโฟลเดอร์แล้วสั่ง `Rename-Item "new app" luiquest` เอง
