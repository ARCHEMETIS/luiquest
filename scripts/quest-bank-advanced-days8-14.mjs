export const QUEST_BANK_advanced_w2 = [
  {
    topicSlug: 'python',
    level: 'advanced',
    dayNumber: 8,
    title: 'วันที่ 8: วางกติกาข้อมูลก่อนคำนวณ',
    description: 'ยกระดับโปรแกรมรายจ่ายให้แยกข้อมูลเสียออกจากข้อมูลที่คำนวณได้อย่างชัดเจน',
    content: {
      intro: 'เมื่อวานเราประกอบโปรแกรมที่อ่านรายจ่าย สรุปยอด และบันทึก JSON ได้แล้ว แต่ไฟล์จริงมักมีบรรทัดที่ไม่ครบหรือจำนวนเงินผิดรูปแบบ วันนี้เราจะกำหนด schema ของหนึ่งรายการและทำชั้น validation ก่อนส่งข้อมูลเข้าส่วนคำนวณ',
      objectives: [
        'กำหนดฟิลด์และชนิดข้อมูลของรายการรายจ่ายได้',
        'แยกข้อมูลที่ผ่านกับไม่ผ่าน validation ได้',
        'รายงานเลขบรรทัดและสาเหตุของข้อมูลเสียได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิดคู่มือ Python ของ W3Schools แล้วใช้เป็น reference เรื่อง exception ระหว่างเพิ่มฟังก์ชัน validate_expense()', link_url: 'https://www.w3schools.com/python/' },
      { order_index: 2, label: 'ขยายข้อมูลเป็น วันที่,หมวด,จำนวนเงิน,หมายเหตุ แล้วกำหนดกติกาอย่างน้อย 4 ข้อ เช่น วันที่ถูกต้องและยอดต้องไม่ติดลบ', link_url: null },
      { order_index: 3, label: 'ใส่บรรทัดเสีย 3 แบบในไฟล์ทดสอบ แล้วให้โปรแกรมข้ามเฉพาะบรรทัดนั้นพร้อมพิมพ์เลขบรรทัดและเหตุผล', link_url: null },
    ],
  },
  {
    topicSlug: 'python',
    level: 'advanced',
    dayNumber: 9,
    title: 'วันที่ 9: ทำคำสั่งรันที่เลือกช่วงข้อมูลได้',
    description: 'เพิ่มพารามิเตอร์ให้โปรแกรมรายจ่ายตอบคำถามเฉพาะช่วงเวลาและหมวดที่ต้องการ',
    content: {
      intro: 'เมื่อวานโปรแกรมคัดข้อมูลเสียออกได้แล้ว วันนี้เราจะหยุดแก้ค่าค้นหาในโค้ดทุกครั้ง แล้วรับตัวเลือกจากคำสั่งรันแทน ผลลัพธ์เดิมจึงใช้ซ้ำกับหลายช่วงวันที่และหลายหมวดได้โดยไม่แตะ logic หลัก',
      objectives: [
        'รับ path ไฟล์และตัวกรองจาก command line ได้',
        'ตรวจค่าพารามิเตอร์ก่อนเริ่มประมวลผลได้',
        'แสดงข้อความช่วยใช้และข้อผิดพลาดที่สั้นชัดได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ใช้คู่มือ W3Schools เป็น reference ขณะเพิ่มการรับค่าผู้ใช้และแปลงชนิดข้อมูล โดยไม่คัดลอกโค้ดทั้งก้อน', link_url: 'https://www.w3schools.com/python/' },
      { order_index: 2, label: 'เพิ่มตัวเลือกไฟล์ต้นทาง หมวด และวันที่เริ่ม-สิ้นสุดให้ main.py แล้วส่งค่าต่อไปยังฟังก์ชันกรอง', link_url: null },
      { order_index: 3, label: 'รันอย่างน้อย 3 กรณี: ไม่ใส่ตัวกรอง กรองหมวดเดียว และใส่ช่วงวันที่กลับด้าน พร้อมทำข้อความแจ้งกรณีสุดท้าย', link_url: null },
    ],
  },
  {
    topicSlug: 'python',
    level: 'advanced',
    dayNumber: 10,
    title: 'วันที่ 10: ล็อกพฤติกรรมสำคัญด้วยชุดทดสอบ',
    description: 'เปลี่ยนการลองรันด้วยตาให้เป็น test ที่จับ regression ของโปรแกรมได้',
    content: {
      intro: 'เมื่อวานโปรแกรมรับตัวเลือกได้หลายแบบและมีเส้นทางการทำงานมากขึ้น วันนี้เราจะเขียน test ให้กติกาที่สำคัญ เพื่อรู้ทันทีว่าการแก้ครั้งถัดไปทำผลลัพธ์เดิมพังหรือไม่ เน้นเคสขอบที่คนมักพลาดมากกว่าเคสสวยงามอย่างเดียว',
      objectives: [
        'แยกฟังก์ชันบริสุทธิ์ออกมาให้ทดสอบง่ายได้',
        'เขียน test ครอบคลุมข้อมูลปกติและเคสขอบได้',
        'อ่านผล test ที่ล้มและย้อนแก้สาเหตุได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิดคลังตัวอย่าง Python ของ KongRuksiam แล้วสังเกตวิธีแยกฟังก์ชัน ก่อนจัดโค้ดตัวเองให้ test ได้โดยไม่รันทั้งโปรแกรม', link_url: 'https://github.com/kongruksiamza/programmer-class-room' },
      { order_index: 2, label: 'เขียน test อย่างน้อย 5 เคสสำหรับ validation การกรอง และการรวมยอด โดยมีไฟล์ว่าง ยอดศูนย์ และหมวดที่ไม่พบ', link_url: null },
      { order_index: 3, label: 'จงใจทำเงื่อนไขหนึ่งจุดให้ผิด รันจนเห็น test ล้ม แล้วคืนโค้ดให้ถูกและเก็บผลผ่านทั้งหมดไว้ใน README', link_url: null },
    ],
  },
  {
    topicSlug: 'python',
    level: 'advanced',
    dayNumber: 11,
    title: 'วันที่ 11: คำนวณเงินโดยไม่เสียเศษ',
    description: 'แก้ความคลาดเคลื่อนของเลขทศนิยมและกำหนดกติกาปัดเศษให้ตรวจสอบได้',
    content: {
      intro: 'เมื่อวานชุดทดสอบช่วยล็อกคำตอบที่เราคาดหวังไว้แล้ว วันนี้เราจะใช้ test เหล่านั้นเปิดให้เห็นปัญหาเลขทศนิยมแบบ float แล้วเปลี่ยนส่วนคำนวณเงินให้ใช้ Decimal พร้อมกติกาปัดเศษเดียวกันทุกจุด',
      objectives: [
        'อธิบายความเสี่ยงของ float ในงานจำนวนเงินได้',
        'แปลงข้อความจำนวนเงินเป็น Decimal อย่างปลอดภัยได้',
        'กำหนดและทดสอบกติกาปัดเศษระดับสองตำแหน่งได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ใช้ W3Schools Python เป็น reference เรื่องชนิดข้อมูล แล้วทดลอง 0.1 + 0.2 เพื่อบันทึกอาการที่ต้องแก้', link_url: 'https://www.w3schools.com/python/' },
      { order_index: 2, label: 'เปลี่ยนเส้นทางอ่านและรวมจำนวนเงินให้สร้าง Decimal จากข้อความ พร้อมปัดสองตำแหน่งที่จุดส่งออกเพียงจุดเดียว', link_url: null },
      { order_index: 3, label: 'เพิ่ม test สำหรับ 0.1 + 0.2 ยอดที่มีสามตำแหน่ง และยอดติดลบ แล้วตรวจว่าผลตรงกติกาทั้งหมด', link_url: null },
    ],
  },
  {
    topicSlug: 'python',
    level: 'advanced',
    dayNumber: 12,
    title: 'วันที่ 12: ทำรายงานเทียบงบกับยอดจริง',
    description: 'ต่อยอดผลรวมรายจ่ายให้บอกส่วนต่างงบและสถานะเกินงบได้ในไฟล์เดียว',
    content: {
      intro: 'เมื่อวานยอดเงินของเราคำนวณและปัดเศษได้แน่นอนขึ้นแล้ว วันนี้จะเพิ่มไฟล์งบประมาณแยกจากธุรกรรม แล้วจับคู่ตามหมวดเพื่อสร้างรายงาน variance โปรแกรมจึงตอบได้ทั้งใช้ไปเท่าไรและห่างจากงบเท่าไร',
      objectives: [
        'รวมข้อมูลจากไฟล์ธุรกรรมและไฟล์งบได้',
        'คำนวณส่วนต่างและร้อยละการใช้งบได้',
        'กำหนดผลลัพธ์สำหรับหมวดที่มีอยู่เพียงไฟล์เดียวได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิดคู่มือ W3Schools แล้วใช้เป็น reference เรื่อง dict ขณะจับคู่หมวดจากสองแหล่งข้อมูล', link_url: 'https://www.w3schools.com/python/' },
      { order_index: 2, label: 'สร้าง budgets.json อย่างน้อย 4 หมวด แล้วเพิ่มฟังก์ชันคืนยอดจริง งบ ส่วนต่าง และสถานะของแต่ละหมวด', link_url: null },
      { order_index: 3, label: 'ทดสอบหมวดที่ไม่มีงบ หมวดที่ยังไม่มียอดใช้ และงบเป็นศูนย์ พร้อมกำหนดข้อความแทนการหารผิดพลาด', link_url: null },
    ],
  },
  {
    topicSlug: 'python',
    level: 'advanced',
    dayNumber: 13,
    title: 'วันที่ 13: วัดก่อนปรับโปรแกรมไฟล์ใหญ่',
    description: 'ใช้ข้อมูลจำลองและเวลาในการรันตัดสินว่าจุดใดควรปรับประสิทธิภาพจริง',
    content: {
      intro: 'เมื่อวานโปรแกรมต้องรวมข้อมูลสองแหล่งและสร้างรายงานละเอียดขึ้น วันนี้เราจะสร้างไฟล์จำลองขนาดใหญ่ วัดเวลาแบบเดิม แล้วปรับให้อ่านและรวมทีละบรรทัดโดยไม่เก็บทุก record ไว้พร้อมกัน การปรับทุกครั้งต้องมีตัวเลขก่อนและหลังรองรับ',
      objectives: [
        'สร้างข้อมูลทดสอบที่ทำซ้ำได้สำหรับวัดประสิทธิภาพได้',
        'วัดเวลาเส้นทางสำคัญก่อนและหลังปรับได้',
        'ประมวลผลไฟล์แบบ streaming โดยรักษาคำตอบเดิมได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ใช้ W3Schools Python เป็น reference เรื่อง loop และ file handling ขณะเปลี่ยนจาก readlines เป็นการวนไฟล์โดยตรง', link_url: 'https://www.w3schools.com/python/' },
      { order_index: 2, label: 'สร้างไฟล์จำลองอย่างน้อย 10,000 บรรทัดด้วย seed คงที่ แล้วจับเวลาโปรแกรมเดิม 3 รอบและจดค่ากลาง', link_url: null },
      { order_index: 3, label: 'ปรับให้อ่านทีละบรรทัด จับเวลาอีก 3 รอบ และรัน test เดิมเพื่อยืนยันว่าผลรวมไม่เปลี่ยน', link_url: null },
    ],
  },
  {
    topicSlug: 'python',
    level: 'advanced',
    dayNumber: 14,
    title: 'วันที่ 14: ส่งมอบโปรแกรมรายจ่ายเวอร์ชันใช้งานจริง',
    description: 'รวม validation, CLI, test, ความแม่นยำ และรายงานงบเป็นชิ้นงานที่คนอื่นรันต่อได้',
    content: {
      intro: 'เมื่อวานเราพิสูจน์ด้วยตัวเลขแล้วว่าโปรแกรมรับไฟล์ใหญ่ขึ้นได้โดยคำตอบไม่เปลี่ยน วันนี้จะปิดสัปดาห์ด้วยเวอร์ชันส่งมอบที่มีตัวอย่างข้อมูล คำสั่งรัน ชุดทดสอบ และข้อจำกัดครบ คนที่ไม่เห็นขั้นตอนก่อนหน้าต้องเปิด README แล้วทดลองได้เอง',
      objectives: [
        'จัดโครงโปรเจกต์และคำสั่งรันให้ผู้อื่นทำตามได้',
        'แสดงหลักฐาน test และผลวัดประสิทธิภาพได้',
        'สาธิตการรับข้อมูลเสียและสร้างรายงานเทียบงบได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิดตัวอย่างโปรเจกต์ในคลัง programmer-class-room แล้วตรวจว่า README ของตัวเองยังขาดข้อมูลสำหรับคนรันครั้งแรกตรงไหน', link_url: 'https://github.com/kongruksiamza/programmer-class-room' },
      { order_index: 2, label: 'จัดโฟลเดอร์ให้มี source, tests, sample data และ README พร้อมคำสั่งรัน 3 ตัวอย่างกับรูปแบบไฟล์ที่รองรับ', link_url: null },
      { order_index: 3, label: 'รันชุดทดสอบทั้งหมดและสาธิตไฟล์ที่มีบรรทัดเสียหนึ่งครั้ง แล้วบันทึกผลรวม รายงานงบ และข้อจำกัดที่ยังเหลือ', link_url: null },
    ],
  },

  {
    topicSlug: 'data-ml',
    level: 'advanced',
    dayNumber: 8,
    title: 'วันที่ 8: ตั้ง baseline และเกณฑ์ที่มีความหมาย',
    description: 'เปลี่ยนรายงานโมเดลหนึ่งหน้าให้ตอบได้ว่าโมเดลดีกว่าวิธีง่าย ๆ จริงหรือไม่',
    content: {
      intro: 'เมื่อวานเราจบด้วยรายงาน pipeline คะแนน cross-validation และข้อจำกัด แต่คะแนนเดี่ยว ๆ ยังไม่บอกว่าโมเดลคุ้มกว่าวิธีง่ายหรือไม่ วันนี้เราจะสร้าง baseline และเลือก metric ที่เชื่อมกับความเสียหายของโจทย์',
      objectives: [
        'สร้าง baseline ที่เหมาะกับโจทย์ทำนายได้',
        'เลือก metric จากผลของความผิดพลาดแต่ละแบบได้',
        'รายงานส่วนต่างระหว่างโมเดลกับ baseline ได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด Google ML Crash Course แล้วใช้ส่วน Metrics เป็น reference ขณะเขียนว่าความผิดพลาดแบบใดแพงกว่าสำหรับโจทย์ของคุณ', link_url: 'https://developers.google.com/machine-learning/crash-course' },
      { order_index: 2, label: 'สร้าง baseline แบบทายค่ากลางหรือคลาสส่วนใหญ่ แล้ววัดด้วย split เดียวกับ pipeline วันที่ 7', link_url: null },
      { order_index: 3, label: 'ทำตาราง baseline เทียบโมเดลด้วย metric หลักหนึ่งค่าและ metric เฝ้าระวังหนึ่งค่า พร้อมสรุปว่าดีขึ้นเท่าไร', link_url: null },
    ],
  },
  {
    topicSlug: 'data-ml',
    level: 'advanced',
    dayNumber: 9,
    title: 'วันที่ 9: ตรวจ data leakage ก่อนเชื่อคะแนน',
    description: 'ไล่เส้นทางข้อมูลเพื่อกันข้อมูลอนาคตหรือคำตอบรั่วเข้าไปในขั้นตอนฝึก',
    content: {
      intro: 'เมื่อวานเราเห็นส่วนต่างจาก baseline แล้ว แต่คะแนนที่ดีอาจหลอกเราได้ถ้าข้อมูลรั่ว วันนี้จะตรวจทั้งคอลัมน์ เวลา และจุด fit preprocessing เพื่อให้ validation จำลองการใช้งานจริงมากขึ้น',
      objectives: [
        'ระบุคอลัมน์ที่อาจเกิด target leakage ได้',
        'ตรวจว่าการเตรียมข้อมูล fit เฉพาะชุดฝึกได้',
        'เลือก split ตามเวลา กลุ่ม หรือสุ่มให้ตรงวิธีใช้งานได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ทำส่วน Data Leakage ใน Kaggle Learn แล้วนำคำถามตรวจ leakage มาปรับกับ dataset ของตัวเองอย่างน้อย 3 ข้อ', link_url: 'https://www.kaggle.com/learn' },
      { order_index: 2, label: 'วาดเส้นทางตั้งแต่ข้อมูลดิบถึง metric และทำเครื่องหมายทุกจุดที่มีการ fit, fill หรือ encode ก่อนแบ่งข้อมูล', link_url: null },
      { order_index: 3, label: 'ตัดคอลัมน์เสี่ยงหรือเปลี่ยนวิธี split หนึ่งจุด รันวัดใหม่ แล้วบันทึกว่าคะแนนและความน่าเชื่อถือเปลี่ยนอย่างไร', link_url: null },
    ],
  },
  {
    topicSlug: 'data-ml',
    level: 'advanced',
    dayNumber: 10,
    title: 'วันที่ 10: เปรียบเทียบโมเดลบนสนามเดียวกัน',
    description: 'ทดลองโมเดลคู่แข่งโดยตรึงข้อมูล split และ metric ให้ข้อสรุปยุติธรรม',
    content: {
      intro: 'เมื่อวานเราแก้จุดรั่วและได้วิธีประเมินที่น่าเชื่อถือขึ้น วันนี้จะนำโมเดลอีกชนิดมาแข่งกับตัวเดิมบน folds และ metric ชุดเดียวกัน ไม่เลือกผู้ชนะจากรอบที่คะแนนดีที่สุดเพียงครั้งเดียว',
      objectives: [
        'ตั้งการทดลองเปรียบเทียบที่เปลี่ยนตัวแปรหลักเพียงจุดเดียวได้',
        'เก็บคะแนนราย fold ของสองโมเดลได้',
        'อธิบาย trade-off ด้านคะแนน เวลา และความซับซ้อนได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ทบทวน Intro to Machine Learning ใน Kaggle Learn แล้วเลือกโมเดลอีกชนิดที่รองรับโจทย์เดียวกับของเดิม', link_url: 'https://www.kaggle.com/learn' },
      { order_index: 2, label: 'รันสองโมเดลด้วย preprocessing, folds และ metric เดียวกัน พร้อมเก็บคะแนนครบทุก fold และเวลาฝึกโดยประมาณ', link_url: null },
      { order_index: 3, label: 'ทำตารางตัดสินใจ 3 แถว: คุณภาพ ความสม่ำเสมอ และความซับซ้อน แล้วเลือกหนึ่งโมเดลพร้อมเหตุผล', link_url: null },
    ],
  },
  {
    topicSlug: 'data-ml',
    level: 'advanced',
    dayNumber: 11,
    title: 'วันที่ 11: จูนโมเดลโดยไม่แตะชุดทดสอบ',
    description: 'ค้นค่าพารามิเตอร์ในขอบเขตเล็กและเก็บ holdout ไว้ตัดสินครั้งสุดท้าย',
    content: {
      intro: 'เมื่อวานเราเลือกโมเดลจากการเปรียบเทียบที่ยุติธรรมแล้ว วันนี้จะจูนเฉพาะพารามิเตอร์ที่มีเหตุผลสองตัวด้วย cross-validation และกัน holdout ไว้ ไม่วนดูชุดทดสอบจนกลายเป็นการจำข้อสอบ',
      objectives: [
        'กำหนดขอบเขตค้นพารามิเตอร์จากสมมติฐานได้',
        'จูนโมเดลภายใน cross-validation ได้',
        'แยกผล validation ออกจากผล holdout ได้ชัดเจน',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด Intermediate Machine Learning ใน Kaggle Learn แล้วเลือกแนวทางจูนที่ทำได้ภายในเวลาโดยไม่ค้นค่ากว้างเกินจำเป็น', link_url: 'https://www.kaggle.com/learn' },
      { order_index: 2, label: 'กำหนดค่าทดลอง 2 พารามิเตอร์รวมไม่เกิน 12 ชุด พร้อมเขียนเหตุผลว่าค่าเหล่านี้ควบคุมอะไร', link_url: null },
      { order_index: 3, label: 'เลือกค่าจากคะแนน CV แล้วประเมิน holdout เพียงครั้งเดียว พร้อมบันทึกช่องว่างระหว่างสองคะแนน', link_url: null },
    ],
  },
  {
    topicSlug: 'data-ml',
    level: 'advanced',
    dayNumber: 12,
    title: 'วันที่ 12: ผ่าความผิดพลาดเป็นกลุ่มย่อย',
    description: 'ค้นหาว่าโมเดลพลาดกับข้อมูลแบบใดแทนการดูเพียงคะแนนเฉลี่ย',
    content: {
      intro: 'เมื่อวานเราได้โมเดลที่จูนแล้วและมีคะแนน holdout หนึ่งครั้ง วันนี้จะเปิดผลทำนายระดับแถวและแบ่ง error ตามช่วงค่าหรือกลุ่มที่มีความหมาย คะแนนเฉลี่ยอาจดีแต่บางกลุ่มยังพลาดหนักจนใช้งานจริงไม่ได้',
      objectives: [
        'สร้างตารางผลจริง ผลทำนาย และขนาดความผิดพลาดได้',
        'เปรียบเทียบ metric ระหว่างกลุ่มย่อยได้',
        'เลือกข้อผิดพลาดที่ควรแก้ก่อนจากผลกระทบได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ใช้ Google ML Crash Course เป็น reference เรื่องการประเมินโมเดล แล้วกำหนดกลุ่มย่อยที่เกี่ยวกับบริบทงานอย่างน้อย 3 กลุ่ม', link_url: 'https://developers.google.com/machine-learning/crash-course' },
      { order_index: 2, label: 'คำนวณ metric เดียวกันแยกตามกลุ่ม พร้อมจำนวนตัวอย่างของแต่ละกลุ่มเพื่อกันข้อสรุปจากกลุ่มเล็กเกินไป', link_url: null },
      { order_index: 3, label: 'เปิดตัวอย่างที่ผิดมากสุด 5 แถว จัดหมวดสาเหตุที่เป็นไปได้ และเลือกหนึ่งสมมติฐานสำหรับทดลองต่อ', link_url: null },
    ],
  },
  {
    topicSlug: 'data-ml',
    level: 'advanced',
    dayNumber: 13,
    title: 'วันที่ 13: ทำ model card ฉบับสั้น',
    description: 'บันทึกขอบเขตข้อมูล ผลวัด และข้อห้ามใช้ให้คนรับช่วงเข้าใจโมเดลตรงกัน',
    content: {
      intro: 'เมื่อวานเราเห็นแล้วว่าโมเดลไม่ได้เก่งเท่ากันทุกกลุ่ม วันนี้จะเปลี่ยนหลักฐานเหล่านั้นเป็น model card สั้น ๆ ที่บอก intended use, ข้อมูล, metric, ผลรายกลุ่ม และข้อจำกัดอย่างตรงไปตรงมา',
      objectives: [
        'อธิบายวัตถุประสงค์และสิ่งที่ไม่ควรใช้โมเดลทำได้',
        'บันทึกข้อมูลและวิธีประเมินให้ทำซ้ำได้',
        'สื่อสารข้อจำกัดรายกลุ่มโดยไม่กลบด้วยคะแนนรวมได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'อ่านบทความ Data Science ไทยใน DataTH แล้วเลือกวิธีอธิบายคำเทคนิคหนึ่งจุดให้คนทำงานทั่วไปเข้าใจ', link_url: 'https://blog.datath.com/' },
      { order_index: 2, label: 'เขียน model card ไม่เกินหนึ่งหน้าที่มี intended use, data, metrics, subgroup results, limitations และ owner ครบ', link_url: null },
      { order_index: 3, label: 'ให้คนอื่นตอบคำถาม 3 ข้อจากเอกสาร: ใช้ทำอะไร ห้ามใช้ทำอะไร และกลุ่มใดต้องระวัง แล้วแก้ส่วนที่หาไม่เจอ', link_url: null },
    ],
  },
  {
    topicSlug: 'data-ml',
    level: 'advanced',
    dayNumber: 14,
    title: 'วันที่ 14: ส่งมอบการทดลอง ML ที่ทำซ้ำได้',
    description: 'รวม baseline, leakage check, tuning, error analysis และ model card เป็น portfolio ชิ้นเดียว',
    content: {
      intro: 'เมื่อวานเราเขียนขอบเขตและข้อจำกัดของโมเดลให้ผู้อื่นอ่านได้แล้ว วันนี้จะจัด notebook และเอกสารทั้งหมดให้รันจากข้อมูลดิบจนถึงผลสุดท้ายได้ตามลำดับ ชิ้นงานต้องแสดงทั้งสิ่งที่ดีขึ้นและจุดที่ยังไม่ควรนำไปใช้',
      objectives: [
        'จัด notebook ให้รันซ้ำจากต้นจนจบได้',
        'เชื่อมผลการทดลองทุกตัวเลขกลับไปยังโค้ดได้',
        'ส่งมอบข้อสรุปและข้อจำกัดสำหรับบริบทใช้งานจริงได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด Kaggle Learn เป็น checklist อ้างอิง แล้วจัดหัวข้อ notebook ตามลำดับ data → baseline → validation → tuning → error analysis', link_url: 'https://www.kaggle.com/learn' },
      { order_index: 2, label: 'รีสตาร์ต environment และรันทุก cell ตามลำดับ พร้อมแก้ state แฝง path และ random seed จนได้ผลซ้ำ', link_url: null },
      { order_index: 3, label: 'แนบ model card และสรุป 5 บรรทัดว่าดีกว่า baseline เท่าไร พลาดที่ใด และต้องทดลองอะไรต่อก่อนใช้งานจริง', link_url: null },
    ],
  },

  {
    topicSlug: 'web',
    level: 'advanced',
    dayNumber: 8,
    title: 'วันที่ 8: ทำรายการงานให้ใช้ด้วยคีย์บอร์ดได้',
    description: 'ยกระดับเว็บรายการงานให้ฟอร์ม สถานะ และปุ่มต่าง ๆ เข้าถึงได้โดยไม่พึ่งเมาส์',
    content: {
      intro: 'เมื่อวานเว็บรายการงานเพิ่ม ลบ และจำข้อมูลหลังรีเฟรชได้แล้ว วันนี้เราจะตรวจเส้นทางใช้งานด้วยคีย์บอร์ดและแก้ semantic HTML, label และ focus ให้ผู้ใช้รู้ว่ากำลังอยู่ตรงไหน',
      objectives: [
        'เชื่อม label กับช่องกรอกและข้อความผิดพลาดได้',
        'ใช้งานฟังก์ชันหลักทั้งหมดด้วยคีย์บอร์ดได้',
        'จัดลำดับ focus หลังเพิ่มหรือลบงานได้เหมาะสม',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด MDN Learn Web Development แล้วใช้หัวข้อ accessibility เป็น checklist ตรวจ HTML ของโปรเจกต์เดิม', link_url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development' },
      { order_index: 2, label: 'แก้ label, button type, heading และข้อความ error ให้มีโครงสร้างชัด แล้วเพิ่มสถานะที่ screen reader รับรู้เมื่อรายการเปลี่ยน', link_url: null },
      { order_index: 3, label: 'วางเมาส์ไว้ข้าง ๆ และทดสอบเพิ่ม ลบ ล้าง และกลับไปแก้ช่องกรอกด้วย Tab, Shift+Tab, Enter พร้อมจดจุดติดขัด', link_url: null },
    ],
  },
  {
    topicSlug: 'web',
    level: 'advanced',
    dayNumber: 9,
    title: 'วันที่ 9: ออกแบบข้อมูลให้แก้ไขต่อได้',
    description: 'เปลี่ยนรายการข้อความธรรมดาเป็น object ที่มี id, สถานะ และเวลาสร้างอย่างมั่นคง',
    content: {
      intro: 'เมื่อวานเราแก้เส้นทางโต้ตอบให้ผู้ใช้หลายแบบเข้าถึงได้แล้ว วันนี้จะปรับ data model ของงานจาก string เป็น object เพื่อรองรับการทำเสร็จและการแก้ไข โดยต้องโหลดข้อมูลเก่าจาก localStorage แล้วไม่ทำหน้าเว็บพัง',
      objectives: [
        'ออกแบบโครงสร้าง task object ที่มี id คงที่ได้',
        'ย้ายข้อมูลเก่าไป schema ใหม่ได้อย่างปลอดภัย',
        'สลับสถานะงานโดยอัปเดตข้อมูลและ DOM ตรงกันได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ทำแบบฝึกหัด object และ array บน freeCodeCamp แล้วนำรูปแบบที่จำเป็นมาใช้กับ task schema ของตัวเอง', link_url: 'https://www.freecodecamp.org/learn' },
      { order_index: 2, label: 'กำหนด task ให้มี id, text, completed และ createdAt แล้วเขียนฟังก์ชันแปลง array string รุ่นเก่าเมื่อโหลด', link_url: null },
      { order_index: 3, label: 'เพิ่มปุ่มทำเสร็จและทดสอบงานชื่อซ้ำ 2 งานว่าการเปลี่ยนสถานะผ่าน id กระทบเฉพาะรายการที่เลือก', link_url: null },
    ],
  },
  {
    topicSlug: 'web',
    level: 'advanced',
    dayNumber: 10,
    title: 'วันที่ 10: ปิดช่องข้อมูลพังและข้อความแฝงโค้ด',
    description: 'ทำให้เว็บรับ localStorage เสียและข้อความคล้าย HTML ได้โดยไม่พังหรือรันเป็นโค้ด',
    content: {
      intro: 'เมื่อวานเราเพิ่ม schema และ migration ให้ข้อมูลหลายรุ่นอยู่ร่วมกันได้ วันนี้จะโจมตีเว็บของตัวเองด้วย JSON เสีย ค่าไม่ครบ และข้อความที่มีแท็ก HTML แล้วแก้ให้การ render ใช้ข้อความล้วนพร้อม fallback ที่ควบคุมได้',
      objectives: [
        'รับมือ JSON ที่ parse ไม่ได้โดยไม่ทำแอปหยุดได้',
        'ตรวจ shape ของข้อมูลก่อนนำไป render ได้',
        'แสดงข้อความผู้ใช้โดยไม่ตีความเป็น HTML ได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด MDN Learn Web Development แล้วใช้เป็น reference เรื่อง DOM API ขณะเปลี่ยนจุด render ข้อมูลผู้ใช้ให้ใช้ textContent', link_url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development' },
      { order_index: 2, label: 'แก้ localStorage ด้วยมือให้เป็น JSON เสียและ object ที่ขาด text แล้วกำหนดว่าจะข้าม กู้คืน หรือแจ้งผู้ใช้อย่างไร', link_url: null },
      { order_index: 3, label: 'เพิ่มงานชื่อ <img src=x onerror=alert(1)> และยืนยันว่าหน้าแสดงเป็นข้อความ ไม่มี alert และฟังก์ชันอื่นยังทำงาน', link_url: null },
    ],
  },
  {
    topicSlug: 'web',
    level: 'advanced',
    dayNumber: 11,
    title: 'วันที่ 11: เพิ่มมุมมองกรองโดยไม่ทำ state หลุด',
    description: 'สร้างตัวกรองทั้งหมด-ค้างอยู่-เสร็จแล้วจาก state ชุดเดียวและรักษาการทำงานของปุ่มเดิม',
    content: {
      intro: 'เมื่อวานข้อมูลเสียและข้อความอันตรายไม่ทำให้เว็บพังแล้ว วันนี้จะเพิ่ม filter view โดยไม่สร้าง array หลายชุดที่หลุดจากกัน การเพิ่ม ลบ และสลับสถานะต้องเปลี่ยน state ต้นทางก่อนแล้วค่อย render มุมมองใหม่เสมอ',
      objectives: [
        'แยก source state ออกจาก filtered view ได้',
        'กรองงานตามสถานะโดยไม่แก้ array ต้นทางได้',
        'คงตัวกรองเดิมหลังเพิ่มหรือลบรายการได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ใช้ freeCodeCamp เป็น reference เรื่อง filter และ array methods แล้วเขียนฟังก์ชัน selectVisibleTasks(state, filter) แบบไม่แตะ DOM', link_url: 'https://www.freecodecamp.org/learn' },
      { order_index: 2, label: 'เพิ่มปุ่ม ทั้งหมด ค้างอยู่ และเสร็จแล้ว พร้อมสถานะ active ที่มองเห็นและอ่านได้จาก accessibility tree', link_url: null },
      { order_index: 3, label: 'ตั้งตัวกรองเป็นค้างอยู่ แล้วเพิ่ม ทำเสร็จ และลบงานตามลำดับ เพื่อตรวจว่า count, localStorage และรายการที่เห็นตรงกันทุกครั้ง', link_url: null },
    ],
  },
  {
    topicSlug: 'web',
    level: 'advanced',
    dayNumber: 12,
    title: 'วันที่ 12: แยก logic ออกจากการวาดหน้า',
    description: 'ลดความพันกันของ event, state และ DOM เพื่อให้แก้ฟีเจอร์โดยไม่กระทบทั้งไฟล์',
    content: {
      intro: 'เมื่อวานตัวกรองทำให้ทุก action ต้องประสาน state กับหน้าจอหลายจุด วันนี้เราจะแยกฟังก์ชัน load/save, state transition และ render ให้รับผิดชอบคนละเรื่อง แล้วตรวจว่าผลลัพธ์เดิมยังอยู่ครบ',
      objectives: [
        'แบ่งโค้ดตามหน้าที่ของข้อมูลและหน้าจอได้',
        'ทำ state transition เป็นฟังก์ชันที่ทดสอบแยกได้',
        'ลดการเขียน localStorage และ render ซ้ำโดยไม่จำเป็นได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิดบทเรียน JavaScript ของ Code-TH แล้วใช้เป็น reference ขณะจัดกลุ่มฟังก์ชัน โดยคงรูปแบบภาษาที่ตัวเองอ่านต่อได้', link_url: 'https://code-th.com/' },
      { order_index: 2, label: 'แยกอย่างน้อย 4 ฟังก์ชัน: loadTasks, saveTasks, updateState และ render โดยห้ามฟังก์ชันคำนวณเรียก DOM', link_url: null },
      { order_index: 3, label: 'ใส่ counter ชั่วคราวนับ save และ render จากหนึ่งการคลิก แก้ไม่ให้แต่ละอย่างเกิดเกินหนึ่งครั้ง แล้วเอา counter ออก', link_url: null },
    ],
  },
  {
    topicSlug: 'web',
    level: 'advanced',
    dayNumber: 13,
    title: 'วันที่ 13: ตรวจเว็บในจอและข้อมูลหลายแบบ',
    description: 'ใช้ test matrix หา layout แตก ข้อความล้น และ state ผิดก่อนเผยแพร่',
    content: {
      intro: 'เมื่อวานเราแยกโค้ดจนเส้นทางอัปเดตชัดและทำงานครั้งเดียวต่อ action แล้ว วันนี้จะทดสอบชิ้นงานแบบเป็นระบบด้วยขนาดจอ ชุดข้อมูล และเส้นทางคีย์บอร์ดหลายแบบ แล้วแก้เฉพาะข้อบกพร่องที่ทำซ้ำได้',
      objectives: [
        'สร้าง test matrix ครอบคลุม viewport และ state สำคัญได้',
        'ทำให้ข้อความยาวและรายการมากไม่ทำ layout แตกได้',
        'บันทึกขั้นตอนทำซ้ำและผลแก้ของ bug ได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด MDN Learn Web Development แล้วใช้หัวข้อ responsive design เป็น checklist กับจอ 320px, 768px และ desktop', link_url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development' },
      { order_index: 2, label: 'ทดสอบ 4 state: ไม่มีงาน งานเดียวข้อความยาว งาน 50 รายการ และข้อมูลเก่าที่ migrate แล้ว พร้อมบันทึก pass/fail', link_url: null },
      { order_index: 3, label: 'แก้ bug ที่กระทบการใช้งานสูงสุดหนึ่งจุด แล้วทดสอบ matrix แถวนั้นซ้ำทั้งด้วยเมาส์และคีย์บอร์ด', link_url: null },
    ],
  },
  {
    topicSlug: 'web',
    level: 'advanced',
    dayNumber: 14,
    title: 'วันที่ 14: ส่งเว็บรายการงานเวอร์ชันพร้อมเผยแพร่',
    description: 'ปิดงานด้วยเว็บที่เข้าถึงได้ ทนข้อมูลผิด และมีหลักฐานทดสอบพร้อมให้คนอื่นลอง',
    content: {
      intro: 'เมื่อวานเราใช้ test matrix จับปัญหาจากจอและข้อมูลหลายแบบแล้ว วันนี้จะทำ production pass ครั้งสุดท้าย ตัด log ชั่วคราว ตรวจไฟล์เริ่มต้น และเผยแพร่ชิ้นงานพร้อม README ที่บอกความสามารถและข้อจำกัดจริง',
      objectives: [
        'ตรวจเส้นทางหลักและ edge cases ก่อนเผยแพร่ได้',
        'จัดไฟล์และ README ให้คนอื่นทดลองได้',
        'เผยแพร่เว็บ static และบันทึกเวอร์ชันที่ทดสอบแล้วได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ใช้ MDN Learn Web Development เป็น checklist รอบสุดท้ายสำหรับ semantic HTML, responsive layout และ JavaScript error ใน console', link_url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development' },
      { order_index: 2, label: 'รันเส้นทางเพิ่ม-ทำเสร็จ-กรอง-ลบ-รีเฟรช รวมทั้ง JSON เสียและคีย์บอร์ด แล้วบันทึกผลผ่านใน README', link_url: null },
      { order_index: 3, label: 'เผยแพร่ด้วยบริการ static hosting ฟรีที่คุณมีบัญชีอยู่ แล้วเปิดลิงก์จากหน้าต่างไม่ระบุตัวตนเพื่อตรวจไฟล์และข้อมูลเริ่มต้น', link_url: null },
    ],
  },

  {
    topicSlug: 'ai-tools',
    level: 'advanced',
    dayNumber: 8,
    title: 'วันที่ 8: เปลี่ยน prompt เป็นแม่แบบใช้ซ้ำ',
    description: 'ยกระดับชุดงาน AI ให้รับข้อมูลใหม่ได้โดยไม่ต้องรื้อคำสั่งทุกครั้ง',
    content: {
      intro: 'เมื่อวานเราส่งชุดงานที่มี prompt ผลลัพธ์ และหลักฐานตรวจครบแล้ว วันนี้จะถอดส่วนคงที่ออกจากข้อมูลเฉพาะงาน แล้วทำ prompt template ที่มีช่องกรอก ข้อห้าม และเงื่อนไขขอข้อมูลเพิ่มก่อนตอบ',
      objectives: [
        'แยก instruction คงที่ออกจาก input ที่เปลี่ยนได้',
        'กำหนดช่องกรอกที่บังคับและค่าเริ่มต้นได้',
        'สั่งให้ AI หยุดทำงานและถามกลับเมื่อข้อมูลสำคัญไม่ครบได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิดคอร์ส Prompt Engineering ของ Skooldio แล้วใช้โครงบริบท-คำสั่ง-รูปแบบตรวจแม่แบบจากวันที่ 7', link_url: 'https://www.skooldio.com/courses/bdi-unlock-ai-with-prompt-engineering' },
      { order_index: 2, label: 'แทนข้อมูลเฉพาะด้วยช่อง [ผู้ชม] [เป้าหมาย] [ข้อมูลอ้างอิง] [โทน] และ [รูปแบบส่งออก] พร้อมระบุช่องที่ห้ามว่าง', link_url: null },
      { order_index: 3, label: 'ทดสอบแม่แบบกับงานต่างกัน 2 ชิ้นและกรณีเว้นข้อมูลอ้างอิง แล้วตรวจว่า AI ถามกลับแทนการเดา', link_url: null },
    ],
  },
  {
    topicSlug: 'ai-tools',
    level: 'advanced',
    dayNumber: 9,
    title: 'วันที่ 9: สร้างชุดทดสอบ prompt จากเคสยาก',
    description: 'เลิกตัดสิน prompt จากตัวอย่างเดียวและวัดความสม่ำเสมอกับข้อมูลหลายแบบ',
    content: {
      intro: 'เมื่อวานแม่แบบของเรารับงานใหม่และถามกลับเมื่อข้อมูลขาดได้แล้ว วันนี้จะสร้าง test set ขนาดเล็กที่มีทั้งเคสปกติ กำกวม ขัดแย้ง และยาวเกิน เพื่อดูว่าแม่แบบยังรักษากติกาได้สม่ำเสมอหรือไม่',
      objectives: [
        'ออกแบบ test cases ที่ครอบคลุม failure mode สำคัญได้',
        'ให้คะแนนผลลัพธ์ทุกเคสด้วย rubric เดียวกันได้',
        'แยกปัญหาที่ prompt แก้ได้ออกจากปัญหาของ input ได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ทบทวน Google AI Essentials แล้วเลือกข้อควรระวังหนึ่งข้อมาแปลงเป็นเคสทดสอบที่ตรวจผ่านหรือไม่ผ่านได้', link_url: 'https://www.coursera.org/learn/google-ai-essentials' },
      { order_index: 2, label: 'สร้าง test set 5 เคส: ปกติ ข้อมูลขาด คำสั่งขัดกัน ข้อความยาว และคำขอเกินขอบเขต พร้อม expected behavior', link_url: null },
      { order_index: 3, label: 'รันแม่แบบครบ 5 เคส ให้คะแนนตาม rubric วันที่ 7 และเลือก failure ที่กระทบงานจริงสูงสุดหนึ่งข้อ', link_url: null },
    ],
  },
  {
    topicSlug: 'ai-tools',
    level: 'advanced',
    dayNumber: 10,
    title: 'วันที่ 10: บังคับให้แยกข้ออ้างจากหลักฐาน',
    description: 'ออกแบบผลลัพธ์ให้ตรวจข้อเท็จจริงและความไม่แน่ใจได้ทีละรายการ',
    content: {
      intro: 'เมื่อวาน test set เปิดให้เห็นจุดที่ AI ตอบมั่นใจเกินข้อมูล วันนี้จะปรับแม่แบบให้คืนตารางข้ออ้าง หลักฐาน แหล่งข้อมูลที่ให้มา และความไม่แน่ใจก่อนเขียนข้อสรุป เพื่อให้ผู้ใช้เห็นทันทีว่าประโยคใดยืนยันได้หรือยังต้องตรวจ',
      objectives: [
        'แยกข้อความอ้างข้อเท็จจริงออกจากความเห็นได้',
        'กำหนดรูปแบบหลักฐานและสถานะตรวจสอบได้',
        'ทำให้ AI ระบุความไม่แน่ใจแทนการเติมข้อมูลได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิดแหล่งเรียน AI ของ depa แล้วเลือกหลักใช้ AI อย่างรับผิดชอบหนึ่งข้อมาใส่เป็นกติกาบังคับใน prompt', link_url: 'https://www.digitalskill.org/' },
      { order_index: 2, label: 'เพิ่มตาราง claims 4 คอลัมน์: ข้ออ้าง หลักฐานที่ให้มา สถานะตรวจ และสิ่งที่ยังไม่รู้ ก่อนส่วนสรุป', link_url: null },
      { order_index: 3, label: 'ใช้ข้อมูลที่มีข้อเท็จจริงยืนยันได้ 2 จุดและไม่มีหลักฐาน 2 จุด แล้วตรวจว่า AI ไม่แต่งแหล่งอ้างอิงหรือเปลี่ยนสิ่งไม่รู้เป็นข้อสรุป', link_url: null },
    ],
  },
  {
    topicSlug: 'ai-tools',
    level: 'advanced',
    dayNumber: 11,
    title: 'วันที่ 11: ทำด่านข้อมูลอ่อนไหวก่อนส่ง AI',
    description: 'เพิ่มขั้นตอนคัดออก แทนค่า และขออนุมัติก่อนนำข้อมูลจริงเข้าเครื่องมือ',
    content: {
      intro: 'เมื่อวานเราแยกข้ออ้างที่ตรวจได้ออกจากจุดที่ยังไม่มีหลักฐานแล้ว วันนี้จะป้องกันอีกด้านคือข้อมูลที่ไม่ควรถูกส่งเข้า AI โดยสร้าง preflight checklist และฝึก redact เอกสารจำลองก่อนใช้งาน',
      objectives: [
        'จำแนกข้อมูลที่ห้ามส่งและข้อมูลที่ลดความละเอียดได้',
        'แทนค่าข้อมูลระบุตัวบุคคลโดยรักษาความหมายงานได้',
        'กำหนดจุดขออนุมัติก่อนใช้ข้อมูลขององค์กรได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ทบทวนบทเรียนการใช้ AI อย่างรับผิดชอบใน Google AI Essentials แล้วเขียน preflight checklist ของตัวเองไม่เกิน 6 ข้อ', link_url: 'https://www.coursera.org/learn/google-ai-essentials' },
      { order_index: 2, label: 'สร้างเอกสารสมมติที่มีชื่อ อีเมล รหัสลูกค้า และยอดเงิน แล้วทำสำเนา redact ด้วย token เช่น [CUSTOMER_01]', link_url: null },
      { order_index: 3, label: 'ให้คนอื่นเทียบต้นฉบับกับฉบับ redact ว่ายังทำงานได้และไม่มีข้อมูลระบุตัวบุคคลหลงเหลือ พร้อมแก้จุดรั่วที่พบ', link_url: null },
    ],
  },
  {
    topicSlug: 'ai-tools',
    level: 'advanced',
    dayNumber: 12,
    title: 'วันที่ 12: ทำ A/B test กับ prompt อย่างยุติธรรม',
    description: 'เปรียบเทียบแม่แบบสองเวอร์ชันด้วย input, rubric และขั้นตอนเดียวกัน',
    content: {
      intro: 'เมื่อวานเราเพิ่มด่านข้อมูลก่อนส่งเข้าเครื่องมือแล้ว วันนี้จะตัดสินการแก้ prompt ด้วย A/B test ที่เปลี่ยนเพียงหนึ่งองค์ประกอบและใช้ test set เดิม แทนการเลือกคำตอบที่อ่านแล้วถูกใจเพียงครั้งเดียว',
      objectives: [
        'ตั้งสมมติฐานการปรับ prompt ที่วัดได้',
        'ควบคุม input และ rubric ให้สองเวอร์ชันเท่ากันได้',
        'เลือกเวอร์ชันจากผลรวมและ failure สำคัญได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิดคอร์ส Skooldio แล้วเลือกเทคนิค prompt เพียงหนึ่งอย่างสำหรับสมมติฐาน เช่น เพิ่มตัวอย่างหรือเพิ่มข้อห้าม', link_url: 'https://www.skooldio.com/courses/bdi-unlock-ai-with-prompt-engineering' },
      { order_index: 2, label: 'สร้างเวอร์ชัน A และ B ที่ต่างกันจุดเดียว รันกับ test set 5 เคสเดิม และบันทึกผลโดยไม่เปลี่ยน rubric ระหว่างทาง', link_url: null },
      { order_index: 3, label: 'รวมคะแนนและนับ critical failure ของแต่ละเวอร์ชัน แล้วเขียนคำตัดสิน 3 บรรทัดพร้อมหลักฐานที่ใช้', link_url: null },
    ],
  },
  {
    topicSlug: 'ai-tools',
    level: 'advanced',
    dayNumber: 13,
    title: 'วันที่ 13: วาง human checkpoint ใน workflow',
    description: 'กำหนดจุดที่ AI ทำต่อได้ จุดที่คนต้องตรวจ และหลักฐานที่ต้องเก็บก่อนส่งงาน',
    content: {
      intro: 'เมื่อวานเราเลือก prompt จากผล A/B test แทนความรู้สึกแล้ว วันนี้จะวาง workflow ตั้งแต่รับ brief ถึงอนุมัติฉบับส่ง โดยระบุ owner, input, output และ stop condition ของแต่ละขั้นให้คนอื่นทำตามได้',
      objectives: [
        'แบ่งงานระหว่าง AI กับคนตามระดับความเสี่ยงได้',
        'กำหนดหลักฐานที่ต้องตรวจในแต่ละ checkpoint ได้',
        'เขียน stop condition เมื่อข้อมูลไม่พอหรือความเสี่ยงสูงได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ใช้ Google AI Essentials เป็น reference แล้วเลือกตัวอย่างงานหนึ่งประเภทที่ต้องมี human review ก่อนเผยแพร่', link_url: 'https://www.coursera.org/learn/google-ai-essentials' },
      { order_index: 2, label: 'วาด workflow 5–7 ขั้น โดยใส่ owner, input, output และเงื่อนไขหยุดในทุกขั้นที่ AI สร้างหรือแก้เนื้อหา', link_url: null },
      { order_index: 3, label: 'ให้เพื่อนจำลองรับช่วงจากกลาง workflow โดยไม่อธิบายเพิ่ม แล้วแก้จุดที่เขาไม่รู้ว่าต้องตรวจหรือส่งต่ออะไร', link_url: null },
    ],
  },
  {
    topicSlug: 'ai-tools',
    level: 'advanced',
    dayNumber: 14,
    title: 'วันที่ 14: ส่งมอบชุด workflow AI ที่ตรวจสอบย้อนหลังได้',
    description: 'รวมแม่แบบ test set rubric privacy gate และ human review เป็นระบบงานพร้อมใช้ซ้ำ',
    content: {
      intro: 'เมื่อวานเราแบ่งหน้าที่ AI กับคนและทดสอบการส่งต่องานแล้ว วันนี้จะรวมทุกส่วนเป็น workflow kit หนึ่งชุด พร้อมตัวอย่าง run ที่ตามย้อนจาก input ไปถึงฉบับอนุมัติได้ ชิ้นงานสุดท้ายต้องบอกชัดว่าอะไรสร้างโดย AI อะไรคนแก้ และอะไรยังไม่ยืนยัน',
      objectives: [
        'จัดชุดแม่แบบและคู่มือให้ผู้อื่นใช้ซ้ำได้',
        'เก็บ audit trail ของ input, output และการแก้ไขได้',
        'สาธิตการตรวจคุณภาพ ความจริง และข้อมูลอ่อนไหวครบเส้นทางได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด depa Digital Skill แล้วใช้หลักจริยธรรมที่เรียนเป็น checklist รอบสุดท้ายของ workflow kit', link_url: 'https://www.digitalskill.org/' },
      { order_index: 2, label: 'จัดไฟล์ให้มี prompt template, input form, test set, rubric, privacy checklist, workflow และ change log พร้อมเลขเวอร์ชัน', link_url: null },
      { order_index: 3, label: 'รันงานตัวอย่างหนึ่งชิ้นตั้งแต่ preflight ถึงอนุมัติ แล้วแนบหลักฐานคะแนน จุดที่คนแก้ ข้อเท็จจริงที่ตรวจ และข้อจำกัดที่เหลือ', link_url: null },
    ],
  },

  {
    topicSlug: 'excel',
    level: 'advanced',
    dayNumber: 8,
    title: 'วันที่ 8: ตั้งด่านคุณภาพข้อมูลต้นทาง',
    description: 'ทำให้ dashboard แยกแถวผิดรูปแบบก่อนที่ยอดเสียจะไหลเข้า PivotTable',
    content: {
      intro: 'เมื่อวานเราจบด้วย dashboard รายจ่ายที่รีเฟรชและสรุปข้อมูลใหม่ได้แล้ว วันนี้จะเพิ่มชั้นตรวจข้อมูลก่อนสรุป เพื่อจับวันที่ผิด หมวดว่าง ยอดไม่ใช่ตัวเลข และรายการซ้ำโดยไม่ต้องไล่ดูด้วยตา',
      objectives: [
        'กำหนดกติกาคุณภาพข้อมูลที่ตรวจได้ด้วยสูตรได้',
        'ทำคอลัมน์สถานะแถวและสรุปจำนวนข้อผิดพลาดได้',
        'กันแถวไม่ผ่านออกจากตัวเลขบน dashboard ได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด Microsoft Support ภาษาไทยแล้วใช้เป็น reference เรื่อง data validation และสูตรตรวจข้อผิดพลาดกับตารางเดิม', link_url: 'https://support.microsoft.com/th-th/excel' },
      { order_index: 2, label: 'เพิ่มคอลัมน์ Check ที่จับอย่างน้อย 4 กติกา: วันที่ หมวด จำนวนเงิน และรหัสรายการซ้ำ พร้อมข้อความสาเหตุ', link_url: null },
      { order_index: 3, label: 'ใส่ข้อมูลเสีย 4 แบบ ทดสอบว่าถูกนับและไม่รวมใน KPI จากนั้นแก้ข้อมูลจนสถานะผ่านทั้งหมด', link_url: null },
    ],
  },
  {
    topicSlug: 'excel',
    level: 'advanced',
    dayNumber: 9,
    title: 'วันที่ 9: ทำขั้นตอนนำเข้าที่กดซ้ำได้',
    description: 'เปลี่ยนการคัดลอกข้อมูลด้วยมือเป็นกระบวนการนำเข้าและแปลงรูปแบบที่ทำซ้ำได้',
    content: {
      intro: 'เมื่อวานเรากันข้อมูลเสียก่อนเข้าตัวเลขสรุปได้แล้ว วันนี้จะบันทึกลำดับนำเข้า เปลี่ยนชนิด ตัดช่องว่าง และกรองแถวเสียให้กด refresh ซ้ำกับไฟล์รอบใหม่ได้ โดยไม่แก้ต้นทางด้วยมือทีละเซลล์',
      objectives: [
        'แยกข้อมูลดิบออกจากตารางที่พร้อมวิเคราะห์ได้',
        'ทำขั้นตอนแปลงข้อมูลที่ทำซ้ำได้ตามลำดับได้',
        'รีเฟรชไฟล์รอบใหม่โดยรักษากติกาเดิมได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ค้นแนวทาง Power Query หรือการนำเข้าข้อมูลในคลังเทพเอ็กเซล แล้วเลือกวิธีที่มีในโปรแกรมของคุณ', link_url: 'https://www.thepexcel.com/' },
      { order_index: 2, label: 'นำเข้าสำเนาข้อมูลดิบและบันทึกขั้นตอนเปลี่ยนชนิดข้อมูล trim ข้อความ และแยกแถวไม่ผ่าน Check ออกจากตารางหลัก', link_url: null },
      { order_index: 3, label: 'แทนไฟล์ต้นทางด้วยรอบที่มีเพิ่ม 5 แถว กด refresh และตรวจยอด จำนวนแถวดี และจำนวนแถวผิดกับค่าที่นับมือ', link_url: null },
    ],
  },
  {
    topicSlug: 'excel',
    level: 'advanced',
    dayNumber: 10,
    title: 'วันที่ 10: สร้างตารางวันที่ให้เทียบช่วงได้ถูก',
    description: 'เพิ่มมิติวันที่สำหรับวิเคราะห์เดือน ไตรมาส และช่วงที่ไม่มีรายการโดยไม่ปะปนกับข้อความวันที่',
    content: {
      intro: 'เมื่อวานข้อมูลรอบใหม่ผ่านขั้นตอนนำเข้าเดิมได้อัตโนมัติแล้ว วันนี้จะสร้างตาราง Calendar แยกและเชื่อมกับธุรกรรม เพื่อให้การเรียงเดือนและการเทียบช่วงไม่พังเมื่อบางวันไม่มีรายการ',
      objectives: [
        'สร้างตารางวันที่ต่อเนื่องครอบคลุมข้อมูลได้',
        'เพิ่มฟิลด์ปี เดือน และไตรมาสที่เรียงถูกได้',
        'ใช้ฟิลด์ Calendar กรอง PivotTable และกราฟได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ใช้บทความ Excel ใน 9Expert Training เป็น reference แล้วเลือกวิธีสร้างวันที่ต่อเนื่องที่เหมาะกับเวอร์ชันของคุณ', link_url: 'https://www.9experttraining.com/articles' },
      { order_index: 2, label: 'สร้างชีต Calendar ตั้งแต่วันต่ำสุดถึงสูงสุด พร้อม Year, MonthNo, MonthLabel และ Quarter โดยไม่พิมพ์เดือนทีละค่า', link_url: null },
      { order_index: 3, label: 'เชื่อมวันที่กับข้อมูลรายจ่าย ใช้ MonthLabel ในกราฟ และทดสอบว่ามกราคมถึงธันวาคมเรียงตาม MonthNo ไม่ใช่ตัวอักษร', link_url: null },
    ],
  },
  {
    topicSlug: 'excel',
    level: 'advanced',
    dayNumber: 11,
    title: 'วันที่ 11: ทำ KPI เทียบงบและช่วงก่อน',
    description: 'เพิ่มตัวเลขที่ตอบทั้งสถานะปัจจุบัน ส่วนต่างงบ และการเปลี่ยนแปลงจากช่วงก่อน',
    content: {
      intro: 'เมื่อวาน Calendar ทำให้ช่วงเวลาบน dashboard เรียงและกรองได้ถูกแล้ว วันนี้จะเพิ่มตารางงบและ KPI ที่เทียบ actual กับ budget และ previous period โดยระบุกรณีฐานเป็นศูนย์ให้ชัดแทนการซ่อน error',
      objectives: [
        'คำนวณ actual, budget และ variance ด้วยช่วงกรองเดียวกันได้',
        'คำนวณการเปลี่ยนแปลงจากช่วงก่อนพร้อมจัดการฐานศูนย์ได้',
        'ใช้รูปแบบสีที่สะท้อนความหมายของ KPI ได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิดคลังเทพเอ็กเซลแล้วใช้ตัวอย่างสูตร lookup และการทำ dashboard เป็น reference ขณะเชื่อมตารางงบกับหมวด', link_url: 'https://www.thepexcel.com/' },
      { order_index: 2, label: 'เพิ่ม Budget table และ KPI อย่างน้อย 4 ค่า: Actual, Budget, Variance และ Previous Period Change ให้ตอบสนองต่อช่วงวันที่', link_url: null },
      { order_index: 3, label: 'ทดสอบงบศูนย์ ช่วงก่อนหน้าไม่มีข้อมูล และยอดเกินงบ แล้วกำหนดข้อความหรือสัญลักษณ์ที่ไม่ทำให้เข้าใจผิด', link_url: null },
    ],
  },
  {
    topicSlug: 'excel',
    level: 'advanced',
    dayNumber: 12,
    title: 'วันที่ 12: ทำ control totals จับยอดไม่ตรง',
    description: 'เพิ่มจุดกระทบยอดระหว่างข้อมูลดิบ ตารางสะอาด PivotTable และ KPI',
    content: {
      intro: 'เมื่อวาน dashboard มี KPI หลายสูตรและหลายตารางเชื่อมกันแล้ว วันนี้จะเพิ่ม control totals เพื่อบอกว่ายอดหล่น ซ้ำ หรือถูกกรองผิดตรงชั้นใด ก่อนนำตัวเลขไปเล่าต่อในงานจริง',
      objectives: [
        'กำหนดยอดควบคุมของแต่ละชั้นข้อมูลได้',
        'ตรวจจำนวนแถวและยอดเงินระหว่างชั้นได้',
        'แสดงสถานะผ่านหรือไม่ผ่านโดยไม่ซ่อนส่วนต่างได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ใช้ Microsoft Support ภาษาไทยเป็น reference เรื่องการตรวจสูตร แล้วเปิดการแสดงสูตรเพื่อตามเส้นทาง KPI สำคัญหนึ่งค่า', link_url: 'https://support.microsoft.com/th-th/excel' },
      { order_index: 2, label: 'สร้างชีต Controls เทียบ count และ sum ระหว่าง Raw, Clean, Pivot และ Dashboard พร้อมคอลัมน์ Difference', link_url: null },
      { order_index: 3, label: 'จงใจตัดแถวจากช่วง Pivot หรือทำรายการซ้ำหนึ่งแถว ตรวจว่า control fail แล้วคืนค่าให้ผ่านพร้อมบันทึกสาเหตุ', link_url: null },
    ],
  },
  {
    topicSlug: 'excel',
    level: 'advanced',
    dayNumber: 13,
    title: 'วันที่ 13: ทำไฟล์ให้ส่งต่อโดยไม่พังง่าย',
    description: 'แยกพื้นที่กรอก ล็อกสูตร และใส่คำแนะนำรีเฟรชให้ผู้รับช่วงใช้ได้ปลอดภัย',
    content: {
      intro: 'เมื่อวาน control totals ทำให้เรารู้ทันทีเมื่อยอดระหว่างชั้นไม่ตรง วันนี้จะลดโอกาสที่ผู้ใช้ใหม่ลบสูตรหรือวางข้อมูลผิดที่ ด้วยสีพื้นที่กรอก การป้องกันชีต และข้อความสถานะ refresh ที่หาเจอง่าย',
      objectives: [
        'แยกพื้นที่ input, calculation และ output ได้ชัดเจน',
        'ป้องกันเซลล์สูตรโดยยังให้แก้ข้อมูลที่อนุญาตได้',
        'เขียนขั้นตอน refresh และแก้ error ให้ผู้รับช่วงทำตามได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด Microsoft Support ภาษาไทยแล้วใช้คู่มือ protect sheet และ data validation กับสำเนาไฟล์ก่อนปรับตัวจริง', link_url: 'https://support.microsoft.com/th-th/excel' },
      { order_index: 2, label: 'กำหนดสีพื้นที่กรอก ปลดล็อกเฉพาะ input และป้องกันสูตรกับชีต Controls โดยไม่ตั้งรหัสที่เสี่ยงลืมในแบบฝึกนี้', link_url: null },
      { order_index: 3, label: 'ให้เพื่อนเพิ่มไฟล์รอบใหม่และ refresh จากคำแนะนำไม่เกิน 6 ขั้น แล้วแก้จุดที่เขาเผลอแก้สูตรหรือหาสถานะไม่เจอ', link_url: null },
    ],
  },
  {
    topicSlug: 'excel',
    level: 'advanced',
    dayNumber: 14,
    title: 'วันที่ 14: ส่งมอบ dashboard ที่รีเฟรชและตรวจสอบได้',
    description: 'รวมขั้นตอนนำเข้า KPI control totals และคู่มือเป็นไฟล์รายงานพร้อมใช้ซ้ำ',
    content: {
      intro: 'เมื่อวานเราออกแบบไฟล์ให้คนอื่นกรอกและ refresh ได้โดยไม่แตะสูตรสำคัญแล้ว วันนี้จะทำ acceptance test ตั้งแต่รับไฟล์ดิบจน dashboard อัปเดต พร้อมส่งมอบ data dictionary และข้อจำกัดที่ยังต้องเฝ้าระวัง',
      objectives: [
        'รีเฟรชข้อมูลใหม่และตรวจ control totals ได้ครบเส้นทาง',
        'อธิบายที่มาของ KPI สำคัญย้อนกลับถึงข้อมูลดิบได้',
        'ส่งมอบไฟล์พร้อมคู่มือและข้อจำกัดสำหรับผู้ใช้จริงได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิดบทความ dashboard ในคลังเทพเอ็กเซล แล้วใช้เป็น checklist ตรวจความชัดของ KPI กราฟ ตัวกรอง และคำอธิบาย', link_url: 'https://www.thepexcel.com/' },
      { order_index: 2, label: 'ใช้ไฟล์ดิบรอบใหม่ทำ acceptance test: import, refresh, controls ผ่าน, slicer ทำงาน และ KPI เทียบงบตรงกับค่าตรวจมือ', link_url: null },
      { order_index: 3, label: 'แนบชีต Read Me ที่มี data dictionary ขั้นตอน refresh owner วันที่ทดสอบ และข้อจำกัด แล้วส่งสำเนาให้คนอื่นทดลองหนึ่งรอบ', link_url: null },
    ],
  },

  {
    topicSlug: 'finance',
    level: 'advanced',
    dayNumber: 8,
    title: 'วันที่ 8: เขียนกรอบนโยบายลงทุนก่อนเลือกของ',
    description: 'ยกระดับแผนลงทุนสมมติให้มีข้อจำกัด สภาพคล่อง และเกณฑ์ตัดสินใจที่ชัดเจน',
    content: {
      intro: 'เมื่อวานเราจบด้วยแผนลงทุนระยะยาวที่มีเป้าหมาย สัดส่วน ความเสี่ยง และกติกาทบทวนแล้ว วันนี้จะทำกรอบนโยบายลงทุนฉบับย่อ เพื่อแยกสิ่งที่ห้ามแตะ ข้อจำกัดด้านเวลา และเงื่อนไขสภาพคล่องออกจากความเห็นต่อตลาด',
      objectives: [
        'ระบุวัตถุประสงค์ ขอบเวลา และข้อจำกัดของแผนได้',
        'กำหนดเงินที่ห้ามนำมารับความผันผวนได้',
        'เขียนเกณฑ์เลือกสินทรัพย์โดยไม่อิงกระแสระยะสั้นได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด SET Invest Now แล้วใช้บทเรียนวางแผนลงทุนเป็น reference ตรวจหัวข้อที่กรอบนโยบายสมมติควรมี', link_url: 'https://www.setinvestnow.com/' },
      { order_index: 2, label: 'เพิ่มส่วน objective, horizon, liquidity, risk limit และ prohibited actions ลงในแผนวันที่ 7 โดยใช้ตัวเลขสมมติ', link_url: null },
      { order_index: 3, label: 'สร้างเหตุการณ์รายได้หยุด 3 เดือน แล้วตรวจว่ากรอบนโยบายบอกได้หรือไม่ว่าเงินก้อนไหนห้ามนำไปลงทุน', link_url: null },
    ],
  },
  {
    topicSlug: 'finance',
    level: 'advanced',
    dayNumber: 9,
    title: 'วันที่ 9: กดแผนด้วยสถานการณ์เลวร้าย',
    description: 'ทำ stress test กับตลาดลง รายได้สะดุด และเงินเฟ้อสูงเพื่อหาเงื่อนไขที่แผนรับไม่ไหว',
    content: {
      intro: 'เมื่อวานกรอบนโยบายแยกเงินจำเป็นและข้อห้ามออกจากพอร์ตได้แล้ว วันนี้จะทดสอบแผนด้วยสถานการณ์สมมติสามแบบพร้อมกันหรือแยกกัน เพื่อดูว่าจุดใดบังคับให้ขายผิดเวลา ลดเป้าหมาย หรือเติมสภาพคล่อง',
      objectives: [
        'สร้าง stress scenario ที่ระบุตัวแปรและช่วงเวลาได้',
        'คำนวณผลต่อมูลค่าพอร์ตและเงินสดสำรองได้',
        'ระบุ trigger ที่ต้องทบทวนแผนแทนการตกใจขายได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ทบทวนความพร้อมทางการเงินใน สตางค์ Story ของ ธปท. แล้วเลือกความเสี่ยงสภาพคล่องหนึ่งข้อมาใส่ใน scenario', link_url: 'https://www.bot.or.th/th/satang-story.html' },
      { order_index: 2, label: 'ทำตาราง 3 สถานการณ์: พอร์ตลด 25% รายได้หยุด 3 เดือน และเงินเฟ้อสูงขึ้น พร้อมคำนวณผลด้วยตัวเลขสมมติ', link_url: null },
      { order_index: 3, label: 'เขียน response rule ของแต่ละสถานการณ์หนึ่งข้อ โดยแยกสิ่งที่ทำทันทีออกจากสิ่งที่ต้องรอรอบทบทวน', link_url: null },
    ],
  },
  {
    topicSlug: 'finance',
    level: 'advanced',
    dayNumber: 10,
    title: 'วันที่ 10: ตั้งกรอบ rebalancing ที่คำนวณได้',
    description: 'กำหนดช่วงเบี่ยงเบนและลำดับปรับพอร์ตเพื่อไม่ซื้อขายตามอารมณ์',
    content: {
      intro: 'เมื่อวาน stress test แสดงว่าความผันผวนทำให้สัดส่วนพอร์ตเปลี่ยนและอารมณ์แกว่งได้ วันนี้จะตั้ง target band และกติกา rebalancing โดยพิจารณาเงินใหม่ ค่าธรรมเนียม และข้อจำกัดก่อนขาย',
      objectives: [
        'คำนวณสัดส่วนปัจจุบันและส่วนเบี่ยงจากเป้าหมายได้',
        'กำหนด band ที่ทำให้ trigger ตรวจสอบได้',
        'วางลำดับ rebalance ที่คำนึงถึงต้นทุนได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด SET e-Learning แล้วทบทวนหัวข้อจัดพอร์ตและการกระจายความเสี่ยงก่อนกำหนด band ของพอร์ตสมมติ', link_url: 'https://elearning.set.or.th/' },
      { order_index: 2, label: 'กำหนด target และช่วงยอมรับของสินทรัพย์ 3 ประเภท แล้วคำนวณสถานการณ์หลังประเภทหนึ่งเพิ่ม 30%', link_url: null },
      { order_index: 3, label: 'เขียนลำดับปรับพอร์ต: ใช้เงินใหม่ก่อน ตรวจค่าธรรมเนียม แล้วจึงพิจารณาขาย พร้อมคำนวณจำนวนสมมติหนึ่งรอบ', link_url: null },
    ],
  },
  {
    topicSlug: 'finance',
    level: 'advanced',
    dayNumber: 11,
    title: 'วันที่ 11: หักเงินเฟ้อและต้นทุนออกจากความหวัง',
    description: 'แปลงผลตอบแทนที่เห็นเป็นผลตอบแทนจริงโดยประมาณและทดสอบความไวของเป้าหมาย',
    content: {
      intro: 'เมื่อวานเรามีกติกาปรับสัดส่วนที่ไม่ตอบสนองต่อราคาแบบทันทีแล้ว วันนี้จะกลับมาตรวจสมมติฐานผลตอบแทน โดยหักเงินเฟ้อและค่าธรรมเนียมแบบประมาณการ แล้วดูว่าเป้าหมายยังถึงภายใต้หลายกรณีหรือไม่',
      objectives: [
        'แยกผลตอบแทน nominal ออกจาก real return ได้',
        'รวมผลของค่าธรรมเนียมในประมาณการระยะยาวได้',
        'ทำ sensitivity table โดยไม่ใช้ค่าคาดการณ์เดียวได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิดบทความความรู้การลงทุนใน SET Invest Now แล้วจดสมมติฐานที่ต้องระบุเมื่อพูดถึงผลตอบแทนระยะยาวอย่างน้อย 3 ข้อ', link_url: 'https://www.setinvestnow.com/' },
      { order_index: 2, label: 'ทำตารางกรณีต่ำ กลาง สูง ด้วยผลตอบแทน เงินเฟ้อ และค่าธรรมเนียมสมมติ แล้วคำนวณ real return โดยประมาณ', link_url: null },
      { order_index: 3, label: 'คำนวณมูลค่าเป้าหมายจากกรณีทั้งสามและเขียนว่าตัวแปรใดทำให้ผลเปลี่ยนมากที่สุด โดยไม่รับรองผลในอนาคต', link_url: null },
    ],
  },
  {
    topicSlug: 'finance',
    level: 'advanced',
    dayNumber: 12,
    title: 'วันที่ 12: วัดความเสี่ยงพลาดเป้าหมาย',
    description: 'เปลี่ยนคำถามจากผลตอบแทนสูงแค่ไหนเป็นแผนยังถึงเป้าหมายเมื่อสมมติฐานเปลี่ยนหรือไม่',
    content: {
      intro: 'เมื่อวาน sensitivity table ทำให้เห็นว่าผลลัพธ์ขึ้นกับสมมติฐานมากเพียงใด วันนี้จะวัด shortfall ของแต่ละกรณีและเตรียมคันโยกแก้แผน เช่น เวลา เงินออม หรือขนาดเป้าหมาย ก่อนเพิ่มความเสี่ยงเป็นทางเลือกแรก',
      objectives: [
        'คำนวณส่วนขาดจากเป้าหมายในหลายกรณีได้',
        'แยกคันโยกที่ควบคุมได้ออกจากผลตอบแทนที่ควบคุมไม่ได้ได้',
        'จัดลำดับทางเลือกแก้ shortfall ตามผลกระทบได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ใช้ สตางค์ Story ของ ธปท. เป็น reference เรื่องการวางแผนตามกำลัง แล้วทบทวนว่าตัวแปรใดอยู่ในการควบคุมของผู้วางแผน', link_url: 'https://www.bot.or.th/th/satang-story.html' },
      { order_index: 2, label: 'เพิ่มคอลัมน์ Target, Projected Value และ Shortfall ให้กรณีต่ำ กลาง สูงจากเมื่อวาน พร้อมระบุปีเป้าหมาย', link_url: null },
      { order_index: 3, label: 'ทดลองปรับทีละอย่าง: เพิ่มเงินออม 10% เลื่อนเวลา 2 ปี หรือลดเป้าหมาย 10% แล้วจัดลำดับทางเลือกโดยไม่เพิ่มความเสี่ยงอัตโนมัติ', link_url: null },
    ],
  },
  {
    topicSlug: 'finance',
    level: 'advanced',
    dayNumber: 13,
    title: 'วันที่ 13: ทำบันทึกตัดสินใจและด่านตรวจผลิตภัณฑ์',
    description: 'เก็บเหตุผล หลักฐาน ต้นทุน และสัญญาณเตือนก่อนเปลี่ยนพอร์ตทุกครั้ง',
    content: {
      intro: 'เมื่อวานเราเลือกวิธีรับมือ shortfall จากตัวแปรที่ควบคุมได้ก่อนแล้ว วันนี้จะสร้าง decision journal และ due diligence checklist เพื่อกันการเปลี่ยนแผนจากข่าวเดียว ผลตอบแทนย้อนหลัง หรือคำขายที่ไม่มีหลักฐาน',
      objectives: [
        'บันทึกสมมติฐานและหลักฐานของการตัดสินใจได้',
        'ตรวจต้นทุน สภาพคล่อง และความเสี่ยงของผลิตภัณฑ์ได้',
        'กำหนดเงื่อนไขยกเลิกหรือทบทวนการตัดสินใจได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด SET Invest Now แล้วเลือกบทความผลิตภัณฑ์หนึ่งชิ้นเพื่อฝึกแยกข้อมูลจริง ความเห็น และสิ่งที่ยังต้องหาเพิ่ม', link_url: 'https://www.setinvestnow.com/' },
      { order_index: 2, label: 'ทำ checklist 8 ข้อครอบคลุมเป้าหมาย ความเสี่ยง ค่าธรรมเนียม สภาพคล่อง ภาษี แหล่งข้อมูล conflict และ exit condition', link_url: null },
      { order_index: 3, label: 'กรอก decision journal จากผลิตภัณฑ์สมมติหนึ่งรายการ แล้วเลื่อนการตัดสินใจถ้ามีช่องสำคัญที่ยังไม่มีหลักฐาน', link_url: null },
    ],
  },
  {
    topicSlug: 'finance',
    level: 'advanced',
    dayNumber: 14,
    title: 'วันที่ 14: ส่งมอบแผนลงทุนที่ผ่าน stress test',
    description: 'รวมกรอบนโยบาย สถานการณ์ rebalancing shortfall และบันทึกตัดสินใจเป็นแผนที่ทบทวนได้',
    content: {
      intro: 'เมื่อวานเราสร้างด่านตรวจที่บังคับให้ทุกการเปลี่ยนพอร์ตมีเหตุผลและหลักฐานแล้ว วันนี้จะรวมเอกสารทั้งสัปดาห์เป็น playbook สมมติฉบับเดียวที่บอกว่าจะทำอะไรเมื่อแผนปกติ เมื่อหลุด band และเมื่อเกิดเหตุฉุกเฉิน โดยไม่เปลี่ยนเป็นคำแนะนำซื้อขายเฉพาะบุคคล',
      objectives: [
        'เชื่อมเป้าหมาย ข้อจำกัด และกติกาตัดสินใจเป็นเอกสารเดียวได้',
        'แสดงผล stress test และ shortfall พร้อมทางรับมือได้',
        'กำหนดรอบทบทวน owner และหลักฐานที่ต้องอัปเดตได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เปิด SET e-Learning แล้วใช้หัวข้อหลักการลงทุนเป็น checklist ตรวจว่าคำศัพท์และความเสี่ยงใน playbook อธิบายครบและไม่รับประกันผล', link_url: 'https://elearning.set.or.th/' },
      { order_index: 2, label: 'จัด playbook ให้มี policy, target bands, stress scenarios, real-return assumptions, shortfall actions และ due diligence checklist ภายใน 3 หน้า', link_url: null },
      { order_index: 3, label: 'จำลองเหตุการณ์ตลาดลงพร้อมรายได้สะดุด เดินตาม playbook ทีละขั้น แล้วแก้จุดที่ไม่มี owner ตัวเลข trigger หรือแหล่งหลักฐาน', link_url: null },
    ],
  },
];
