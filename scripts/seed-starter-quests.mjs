// Seed 18 starter quests (6 หัวข้อ × 3 ระดับ) ลงตาราง public.starter_quests — ticket #04
//
// ใช้ SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ข้าม RLS) อัปเสิร์ตผ่าน PostgREST
// (ไม่ต้องใช้ raw SQL — starter_quests.unique(topic_id, level) ใช้เป็น onConflict target ได้ตรง ๆ)
//
// รัน: node --env-file=.env scripts/seed-starter-quests.mjs
//
// รูปแบบ content/checklist (jsonb):
//   content: { intro: string, objectives: string[] }
//   checklist: [{ order_index: number, label: string, link_url: string|null }]
// checklist ใช้ shape เดียวกับคอลัมน์ของ quest_checklist_items (order_index/label/link_url)
// เพราะตอน onboarding ระบบจะก๊อป starter_quests แถวนี้ไปเป็น daily_quests แถวแรก แล้วแตก
// checklist เป็นแถวจริงในตารางนั้น (ตามคอมเมนต์ schema.sql: "ตอนก๊อปค่อยแตกเป็นแถว")
//
// ลิงก์ทุกอันต้องมาจาก .scratch/app-v2-spec/assets/thai-lesson-sources.md เท่านั้น
// (whitelist 24 โดเมน) — ห้ามแต่ง deep URL เอง ตามข้อกำหนด ticket 04

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ต้องตั้ง SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อนรัน (node --env-file=.env ...)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const XP_REWARD = 10;

// เนื้อหาอิงแหล่งเรียนจริงจาก thai-lesson-sources.md (เช็ค HTTP 200 ทุก URL แล้วก่อน seed)
const STARTER_QUESTS = [
  // ---------- 1. python ----------
  {
    topicSlug: 'python',
    level: 'beginner',
    title: 'เควสแรก: ติดตั้ง Python + พิมพ์ "สวัสดี"',
    description: 'รู้จัก Python แล้วรันโค้ดแรกใน Colab',
    content: {
      intro: 'Python คือภาษาโปรแกรมที่เขียนง่ายที่สุดภาษาหนึ่ง เควสนี้พาไปรู้จักภาษา Python แบบเร็ว ๆ แล้วรันโค้ดบรรทัดแรกให้สำเร็จ',
      objectives: [
        'รู้ว่า Python ใช้ทำอะไรได้บ้าง',
        'เปิด Google Colab แล้วรันโค้ดได้',
        'เข้าใจฟังก์ชัน print() เบื้องต้น',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ดูคลิปแนะนำคอร์ส Python เริ่มจากศูนย์ (borntoDev)', link_url: 'https://school.borntodev.com/course/zero-to-one-python' },
      { order_index: 2, label: 'เปิด Google Colab แล้วสร้างสมุดบันทึกใหม่ 1 ไฟล์', link_url: null },
      { order_index: 3, label: 'พิมพ์โค้ด print("สวัสดี ลุยเควส") แล้วกด Run ให้เห็นผลลัพธ์', link_url: null },
      { order_index: 4, label: 'ดูคลิปสอน Python พื้นฐานอีก 1 คลิปจากช่อง KongRuksiam Official', link_url: 'https://www.youtube.com/@KongRuksiamOfficial' },
    ],
  },
  {
    topicSlug: 'python',
    level: 'intermediate',
    title: 'เควสแรก: ทบทวนตัวแปร + เขียน loop สั้น ๆ',
    description: 'วอร์มพื้นฐานที่พอมีอยู่แล้วให้แน่น',
    content: {
      intro: 'สำหรับคนที่เคยแตะ Python มาบ้าง เควสนี้ทบทวนตัวแปร ชนิดข้อมูล แล้วฝึกเขียนลูปสั้น ๆ ให้คล่องมือ',
      objectives: [
        'ทบทวนตัวแปรกับชนิดข้อมูลพื้นฐาน',
        'เขียน for loop คำนวณอะไรบางอย่างได้เอง',
        'อ่าน error message แล้วแก้บั๊กง่าย ๆ ได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ดูคอร์ส Python พื้นฐานแบบสรุปในคลิปเดียวจาก Skooldio', link_url: 'https://www.skooldio.com/courses/free-basic-python' },
      { order_index: 2, label: 'เขียนโค้ด for loop พิมพ์เลข 1-10 ใน Colab', link_url: null },
      { order_index: 3, label: 'แก้โจทย์: เขียน loop รวมผลบวกเลข 1-100 ให้ได้คำตอบ 5050', link_url: null },
      { order_index: 4, label: 'เปิด W3Schools Python ไว้เป็นคู่มือค้นคำสั่งเวลาไม่แน่ใจ syntax', link_url: 'https://www.w3schools.com/python/' },
    ],
  },
  {
    topicSlug: 'python',
    level: 'advanced',
    title: 'เควสแรก: เขียนฟังก์ชัน + จัดการ error',
    description: 'ต่อยอดสำหรับคนเขียนเป็นแล้ว',
    content: {
      intro: 'สำหรับคนเขียน Python เป็นแล้ว เควสนี้ฝึกออกแบบฟังก์ชันของตัวเองและจัดการข้อผิดพลาดด้วย try/except',
      objectives: [
        'เขียนฟังก์ชันที่รับพารามิเตอร์และคืนค่าได้เอง',
        'ใช้ try/except ดักข้อผิดพลาดได้',
        'อ่านโค้ดคนอื่นแล้วปรับใช้เป็น',
      ],
    },
    checklist: [
      { order_index: 1, label: 'อ่านเอกสารฟังก์ชัน + error handling ของ Python ที่ W3Schools', link_url: 'https://www.w3schools.com/python/' },
      { order_index: 2, label: 'เขียนฟังก์ชัน safe_divide(a, b) ที่ดัก ZeroDivisionError ด้วย try/except', link_url: null },
      { order_index: 3, label: 'ดูคลิปเทคนิค Python เพิ่มอีก 1 คลิปจากช่อง KongRuksiam Official', link_url: 'https://www.youtube.com/@KongRuksiamOfficial' },
      { order_index: 4, label: 'อ่านโค้ดตัวอย่างในคลัง programmer-class-room บน GitHub แล้วสรุปว่าเข้าใจอะไรบ้าง', link_url: 'https://github.com/kongruksiamza/programmer-class-room' },
    ],
  },

  // ---------- 2. data-ml ----------
  {
    topicSlug: 'data-ml',
    level: 'beginner',
    title: 'เควสแรก: รู้จัก Data/ML คืออะไร + เปิดบัญชี Kaggle',
    description: 'ปูพื้นว่า Data Science/ML ทำอะไรได้บ้าง แล้วเริ่มบัญชี Kaggle ของตัวเอง',
    content: {
      intro: 'ก่อนลงลึกเรื่องโมเดล เควสนี้พาไปรู้จักภาพรวมของสาย Data/ML และเปิดบัญชี Kaggle ซึ่งเป็นสนามฝึกหลักตลอด roadmap',
      objectives: [
        'เข้าใจว่า Data Analyst / Data Scientist / ML Engineer ต่างกันยังไงคร่าว ๆ',
        'มีบัญชี Kaggle พร้อมใช้งาน',
        'รู้จักแหล่งเรียนไทยสาย Data ที่จะใช้ตลอดทาง',
      ],
    },
    checklist: [
      { order_index: 1, label: 'อ่านบทความแนะนำสาย Data Science จากบล็อก DataTH', link_url: 'https://blog.datath.com/' },
      { order_index: 2, label: 'เปิดบัญชี Kaggle ฟรีที่ kaggle.com/learn', link_url: 'https://www.kaggle.com/learn' },
      { order_index: 3, label: 'ดูคลิปแนะนำ Data/Python เบื้องต้นจากช่อง PrasertCBS 1 คลิป', link_url: 'https://www.youtube.com/@prasertcbs' },
      { order_index: 4, label: 'จดหัวข้อที่อยากรู้เพิ่ม 3 ข้อ เก็บไว้ถามโค้ช AI ทีหลัง', link_url: null },
    ],
  },
  {
    topicSlug: 'data-ml',
    level: 'intermediate',
    title: 'เควสแรก: ทบทวน Pandas อ่าน-กรองข้อมูลตาราง',
    description: 'วอร์มทักษะ Pandas ที่น่าจะเคยแตะมาบ้างให้คล่องขึ้น',
    content: {
      intro: 'สำหรับคนที่เคยเขียน Python/Pandas มาบ้าง เควสนี้ทบทวนการอ่านและกรองข้อมูลตารางด้วย Pandas',
      objectives: [
        'ทบทวนคำสั่ง Pandas อ่าน-กรอง-สรุปข้อมูล',
        'ลองเปิด dataset ตัวอย่างบน Kaggle Learn',
        'ฝึกอธิบายสิ่งที่เจอในข้อมูลเป็นภาษาคน',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ทบทวนบทเรียน Pandas สั้น ๆ ที่ Kaggle Learn', link_url: 'https://www.kaggle.com/learn' },
      { order_index: 2, label: 'ดูคลิปสอน Pandas จากช่อง PrasertCBS', link_url: 'https://www.youtube.com/@prasertcbs' },
      { order_index: 3, label: 'เปิด dataset ตัวอย่าง 1 ชุด แล้วลองกรองข้อมูล 1 คอลัมน์ด้วยเงื่อนไขที่ตัวเองตั้ง', link_url: null },
      { order_index: 4, label: 'อ่านบทความสรุปเทคนิค Data Analytics จาก DataRockie เพิ่มมุมมอง', link_url: 'https://datarockie.com/' },
    ],
  },
  {
    topicSlug: 'data-ml',
    level: 'advanced',
    title: 'เควสแรก: เทรนโมเดลแรกด้วย Kaggle Learn',
    description: 'ลงมือเทรนโมเดล ML ตัวแรกสำหรับคนมีพื้นแน่นแล้ว',
    content: {
      intro: 'สำหรับคนที่มีพื้นฐาน Python/สถิติมาบ้างแล้ว เควสนี้พาลงมือเทรนโมเดล Machine Learning ตัวแรกจริง ๆ',
      objectives: [
        'เข้าใจขั้นตอน train/validate โมเดลแบบคร่าว ๆ',
        'เทรนโมเดลแรกด้วย Kaggle Learn: Intro to Machine Learning',
        'รู้ว่าจะไปต่อยังไงในสาย Deep Learning',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ทำบทเรียน Kaggle Learn: Intro to Machine Learning บทแรก', link_url: 'https://www.kaggle.com/learn' },
      { order_index: 2, label: 'อ่านทฤษฎี ML ภาพรวมที่ Google ML Crash Course', link_url: 'https://developers.google.com/machine-learning/crash-course' },
      { order_index: 3, label: 'ลอง submit ผลทำนายแรกใน competition ฝึกซ้อมบน Kaggle', link_url: null },
      { order_index: 4, label: 'ดูคลิปเทคนิค ML/Data ขั้นกลางจากช่อง PrasertCBS', link_url: 'https://www.youtube.com/@prasertcbs' },
    ],
  },

  // ---------- 3. web ----------
  {
    topicSlug: 'web',
    level: 'beginner',
    title: 'เควสแรก: เขียนหน้าเว็บ HTML หน้าแรกของตัวเอง',
    description: 'รู้จักโครงสร้าง HTML แล้วสร้างหน้าเว็บง่าย ๆ หน้าแรก',
    content: {
      intro: 'ทุกเว็บเริ่มจาก HTML เควสนี้พาไปรู้จักแท็กพื้นฐานแล้วสร้างหน้าเว็บของตัวเองหน้าแรก',
      objectives: [
        'รู้จักโครงสร้าง HTML เบื้องต้น (head/body/แท็กหลัก)',
        'สร้างไฟล์ HTML หน้าแรกของตัวเองได้',
        'เปิดดูผลลัพธ์ในเบราว์เซอร์เป็น',
      ],
    },
    checklist: [
      { order_index: 1, label: 'อ่านบทเรียน HTML พื้นฐานที่ Code-TH.com', link_url: 'https://code-th.com/' },
      { order_index: 2, label: 'ดูคลิปแนะนำคอร์ส Fundamental Web Dev จาก borntoDev', link_url: 'https://www.borntodev.com/fundamental-web-dev-with-html5-css3/' },
      { order_index: 3, label: 'สร้างไฟล์ index.html มีหัวข้อ+รูป+ย่อหน้าแนะนำตัวเอง แล้วเปิดดูในเบราว์เซอร์', link_url: null },
      { order_index: 4, label: 'ลองแก้ข้อความในไฟล์แล้วรีเฟรชดูผลลัพธ์ที่เปลี่ยน', link_url: null },
    ],
  },
  {
    topicSlug: 'web',
    level: 'intermediate',
    title: 'เควสแรก: จัดหน้าเว็บด้วย CSS Flexbox',
    description: 'ทบทวน CSS แล้วฝึกจัดเลย์เอาต์ด้วย Flexbox',
    content: {
      intro: 'สำหรับคนที่เขียน HTML/CSS มาบ้าง เควสนี้ทบทวนแล้วฝึกจัดเลย์เอาต์หน้าเว็บด้วย Flexbox ให้คล่องขึ้น',
      objectives: [
        'ทบทวนการเขียน CSS เลือก selector',
        'ใช้ display:flex จัดแถว/คอลัมน์ได้',
        'จัดหน้าเว็บที่เขียนไว้ให้ดูเป็นระเบียบขึ้น',
      ],
    },
    checklist: [
      { order_index: 1, label: 'อ่านบทเรียน CSS/Flexbox ที่ MDN Learn Web Development', link_url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development' },
      { order_index: 2, label: 'ดูคลิปสอน CSS/Flexbox จากช่อง KongRuksiam Official', link_url: 'https://www.youtube.com/@KongRuksiamOfficial' },
      { order_index: 3, label: 'จัดหน้าเว็บของตัวเอง (จากเควสก่อนหน้า) ให้เมนูเรียงแนวนอนด้วย Flexbox', link_url: null },
      { order_index: 4, label: 'ลองปรับหน้าจอแคบ-กว้างดูว่าเลย์เอาต์ยังดูดีไหม', link_url: null },
    ],
  },
  {
    topicSlug: 'web',
    level: 'advanced',
    title: 'เควสแรก: เพิ่ม JavaScript ให้เว็บโต้ตอบได้',
    description: 'ต่อยอดสำหรับคนมีพื้นแล้ว ใส่ JS ให้หน้าเว็บมีปฏิสัมพันธ์',
    content: {
      intro: 'สำหรับคนที่คุ้นกับ HTML/CSS แล้ว เควสนี้เริ่มใส่ JavaScript ให้หน้าเว็บโต้ตอบกับผู้ใช้ได้จริง',
      objectives: [
        'ใช้ JS จับ event คลิกปุ่มได้',
        'แก้ไข DOM ด้วย JavaScript ได้',
        'เข้าใจว่าจะเรียนต่อสาย Frontend ยังไงต่อ',
      ],
    },
    checklist: [
      { order_index: 1, label: 'อ่านบทเรียน JavaScript/DOM เบื้องต้นที่ MDN', link_url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development' },
      { order_index: 2, label: 'ลองทำแบบฝึกหัด JavaScript พื้นฐานบน freeCodeCamp', link_url: 'https://www.freecodecamp.org/learn' },
      { order_index: 3, label: 'เขียนปุ่มบนหน้าเว็บของตัวเอง กดแล้วเปลี่ยนข้อความ/สีด้วย JS', link_url: null },
      { order_index: 4, label: 'ดูคลิป JavaScript เบื้องต้นเพิ่มอีก 1 คลิปจากช่อง KongRuksiam Official', link_url: 'https://www.youtube.com/@KongRuksiamOfficial' },
    ],
  },

  // ---------- 4. ai-tools ----------
  {
    topicSlug: 'ai-tools',
    level: 'beginner',
    title: 'เควสแรก: สมัครใช้ AI แชทฟรีแล้วลองคุยครั้งแรก',
    description: 'รู้จัก AI แชทคืออะไร แล้วเริ่มใช้งานจริงครั้งแรก',
    content: {
      intro: 'เควสนี้พาไปรู้จักว่า AI แชท (เช่น ChatGPT/Gemini) ทำอะไรได้บ้าง แล้วลงมือสมัครใช้งานจริงเป็นครั้งแรก',
      objectives: [
        'รู้ว่า AI แชทช่วยอะไรในชีวิตประจำวันได้บ้าง',
        'มีบัญชี AI แชทฟรีพร้อมใช้',
        'ลองพิมพ์คำถามแรกแล้วได้คำตอบ',
      ],
    },
    checklist: [
      { order_index: 1, label: 'ดูคลิปแนะนำวิธีใช้ ChatGPT เบื้องต้น (ค้นหาใน YouTube)', link_url: 'https://www.youtube.com/results?search_query=สอนใช้+ChatGPT' },
      { order_index: 2, label: 'สมัครบัญชี AI แชทฟรี 1 ตัว (ChatGPT หรือ Gemini)', link_url: null },
      { order_index: 3, label: 'ลองถามคำถามที่อยากรู้จริง ๆ 3 ข้อ แล้วอ่านคำตอบ', link_url: null },
      { order_index: 4, label: 'จดไว้ว่าคำตอบไหนน่าเชื่อถือ คำตอบไหนต้องเช็คซ้ำ', link_url: null },
    ],
  },
  {
    topicSlug: 'ai-tools',
    level: 'intermediate',
    title: 'เควสแรก: เขียน prompt ให้ได้คำตอบตรงใจขึ้น',
    description: 'ทบทวนหลักเขียน prompt ที่ชัดเจนขึ้นสำหรับคนเคยใช้ AI มาบ้าง',
    content: {
      intro: 'สำหรับคนที่เคยใช้ AI แชทมาบ้าง เควสนี้ทบทวนหลักการเขียน prompt ให้ได้คำตอบตรงจุดขึ้น',
      objectives: [
        'เข้าใจหลักเขียน prompt (บริบท-คำสั่ง-ตัวอย่าง-รูปแบบผลลัพธ์)',
        'ลองปรับ prompt เดิมให้ได้คำตอบดีขึ้น',
        'ใช้ AI ช่วยงานจริงได้ 1 อย่าง',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เรียนคอร์ส Unlock AI with Prompt Engineering ของ Skooldio (บทแรก)', link_url: 'https://www.skooldio.com/courses/bdi-unlock-ai-with-prompt-engineering' },
      { order_index: 2, label: 'ลองเขียน prompt สรุปบทความ/อีเมลของตัวเอง 1 ชิ้น', link_url: null },
      { order_index: 3, label: 'ปรับ prompt เดิมให้ระบุรูปแบบผลลัพธ์ที่ต้องการชัดขึ้น แล้วเทียบผลลัพธ์', link_url: null },
      { order_index: 4, label: 'อ่านบทความ/คอร์สดิจิทัลเสริมที่ depa Digital Skill', link_url: 'https://www.digitalskill.org/' },
    ],
  },
  {
    topicSlug: 'ai-tools',
    level: 'advanced',
    title: 'เควสแรก: ใช้ AI ช่วยงานเอกสาร/สรุปแบบมีวิจารณญาณ',
    description: 'ต่อยอดสำหรับคนใช้ AI คล่องแล้ว เน้นใช้งานจริง+ตรวจสอบข้อเท็จจริง',
    content: {
      intro: 'สำหรับคนใช้ AI แชทคล่องแล้ว เควสนี้เน้นใช้ AI ช่วยงานเอกสารจริงพร้อมฝึกตรวจสอบความถูกต้องของคำตอบ',
      objectives: [
        'ใช้ AI ช่วยร่างเอกสาร/สไลด์งานจริงได้',
        'รู้วิธีตรวจสอบข้อเท็จจริงที่ AI ตอบ',
        'เข้าใจข้อจำกัดและจริยธรรมการใช้ AI เบื้องต้น',
      ],
    },
    checklist: [
      { order_index: 1, label: 'เรียนคอร์ส Google AI Essentials บทที่เกี่ยวกับการใช้งานจริง (audit ฟรี)', link_url: 'https://www.coursera.org/learn/google-ai-essentials' },
      { order_index: 2, label: 'ใช้ AI ช่วยร่างเอกสาร/สรุปงานจริงของตัวเอง 1 ชิ้น แล้วแก้ไขให้เป็นสำนวนตัวเอง', link_url: null },
      { order_index: 3, label: 'เช็คข้อเท็จจริงอย่างน้อย 1 จุดที่ AI ตอบ ด้วยแหล่งอื่นเพิ่ม', link_url: null },
      { order_index: 4, label: 'สรุปข้อจำกัด/ข้อควรระวังการใช้ AI ที่ตัวเองเจอ 2-3 ข้อ', link_url: null },
    ],
  },

  // ---------- 5. excel ----------
  {
    topicSlug: 'excel',
    level: 'beginner',
    title: 'เควสแรก: รู้จักหน้าจอ Excel/Sheets + กรอกข้อมูลแรก',
    description: 'ทำความรู้จักตาราง แถว คอลัมน์ แล้วกรอกข้อมูลจริงชุดแรก',
    content: {
      intro: 'เควสนี้พาไปรู้จักหน้าจอ Excel หรือ Google Sheets แล้วลงมือกรอกตารางข้อมูลง่าย ๆ ชุดแรกด้วยตัวเอง',
      objectives: [
        'รู้จักแถว คอลัมน์ เซลล์ ใน Excel/Sheets',
        'กรอกข้อมูลตารางง่าย ๆ ได้เอง',
        'บันทึกไฟล์เก็บไว้ใช้ต่อ',
      ],
    },
    checklist: [
      { order_index: 1, label: 'อ่านบทเรียนพื้นฐาน Excel ที่เทพเอ็กเซล', link_url: 'https://www.thepexcel.com/' },
      { order_index: 2, label: 'ดูคลิปแนะนำคอร์ส Excel for Everyone จาก borntoDev', link_url: 'https://school.borntodev.com/course/excel-for-everyone' },
      { order_index: 3, label: 'สร้างตารางรายรับ-รายจ่าย 1 สัปดาห์ของตัวเอง ใน Excel หรือ Google Sheets', link_url: null },
      { order_index: 4, label: 'บันทึกไฟล์ตั้งชื่อให้หาเจอง่าย เก็บไว้ใช้ในเควสถัดไป', link_url: null },
    ],
  },
  {
    topicSlug: 'excel',
    level: 'intermediate',
    title: 'เควสแรก: ทบทวนสูตร SUM/AVERAGE/IF',
    description: 'วอร์มสูตรพื้นฐานที่พอเคยใช้มาให้แม่นขึ้น',
    content: {
      intro: 'สำหรับคนที่เคยใช้ Excel มาบ้าง เควสนี้ทบทวนสูตรพื้นฐานที่ใช้บ่อยที่สุดให้แม่นขึ้น',
      objectives: [
        'ทบทวนสูตร SUM/AVERAGE/COUNT',
        'ใช้สูตร IF ตั้งเงื่อนไขง่าย ๆ ได้',
        'ใช้กับข้อมูลจริงของตัวเองได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'อ่านบทความสูตร Excel ที่ใช้บ่อยจาก 9Expert Training', link_url: 'https://www.9experttraining.com/articles' },
      { order_index: 2, label: 'เปิดตารางรายรับ-รายจ่ายที่ทำไว้ ใส่สูตร SUM รวมยอดรายจ่ายทั้งหมด', link_url: null },
      { order_index: 3, label: 'ใส่สูตร IF ทำเครื่องหมายวันไหนใช้จ่ายเกินงบที่ตั้งไว้', link_url: null },
      { order_index: 4, label: 'ค้นคู่มือสูตรเพิ่มเติมที่ Microsoft Support ภาษาไทยเมื่อไม่แน่ใจ syntax', link_url: 'https://support.microsoft.com/th-th/excel' },
    ],
  },
  {
    topicSlug: 'excel',
    level: 'advanced',
    title: 'เควสแรก: ทำ Pivot Table สรุปข้อมูล',
    description: 'ต่อยอดสำหรับคนใช้สูตรคล่องแล้ว ลองสรุปข้อมูลด้วย PivotTable',
    content: {
      intro: 'สำหรับคนใช้สูตร Excel คล่องแล้ว เควสนี้พาลองสรุปข้อมูลก้อนใหญ่ด้วย PivotTable ให้เห็นภาพเร็วขึ้น',
      objectives: [
        'เข้าใจว่า PivotTable ใช้ทำอะไร',
        'สร้าง PivotTable สรุปข้อมูลของตัวเองได้',
        'อ่านผลสรุปแล้วเล่าเป็นข้อสรุปสั้น ๆ ได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'อ่าน/ดูตัวอย่างการทำ PivotTable ที่เทพเอ็กเซล', link_url: 'https://www.thepexcel.com/' },
      { order_index: 2, label: 'สร้าง PivotTable จากตารางรายรับ-รายจ่ายของตัวเอง สรุปยอดตามหมวดหมู่', link_url: null },
      { order_index: 3, label: 'ค้นวิธีใช้ Google Sheets ทำตารางสรุปแบบเดียวกัน (ถ้าถนัด Sheets มากกว่า)', link_url: 'https://www.youtube.com/results?search_query=Google+Sheets+พื้นฐาน' },
      { order_index: 4, label: 'สรุปผลที่เห็นจาก PivotTable เป็นข้อความสั้น ๆ 2-3 บรรทัด', link_url: null },
    ],
  },

  // ---------- 6. finance ----------
  {
    topicSlug: 'finance',
    level: 'beginner',
    title: 'เควสแรก: ทำงบส่วนตัวรายรับ-รายจ่ายครั้งแรก',
    description: 'รู้เงินเข้า-เงินออกของตัวเองจริง ๆ เป็นครั้งแรก',
    content: {
      intro: 'จุดเริ่มต้นของการวางแผนการเงินคือรู้ตัวเลขจริงของตัวเองก่อน เควสนี้พาทำงบรายรับ-รายจ่ายเดือนล่าสุด',
      objectives: [
        'รู้จำนวนเงินเข้า-ออกของตัวเองในเดือนล่าสุด',
        'แยกรายจ่ายจำเป็น/ไม่จำเป็นได้คร่าว ๆ',
        'เห็นภาพรวมการเงินตัวเองครั้งแรก',
      ],
    },
    checklist: [
      { order_index: 1, label: 'อ่านบทความความรู้การเงินพื้นฐานที่ สตางค์ Story (ธปท.)', link_url: 'https://www.bot.or.th/th/satang-story.html' },
      { order_index: 2, label: 'รวบรวมรายรับ-รายจ่ายเดือนล่าสุดของตัวเองมาจดในที่เดียว', link_url: null },
      { order_index: 3, label: 'แยกรายจ่ายเป็น 2 กลุ่ม: จำเป็น กับ ไม่จำเป็น', link_url: null },
      { order_index: 4, label: 'อ่านบทความเสริมภาษาบ้าน ๆ ที่ aomMONEY', link_url: 'https://aommoney.com/' },
    ],
  },
  {
    topicSlug: 'finance',
    level: 'intermediate',
    title: 'เควสแรก: ทบทวนเงินออมฉุกเฉิน + วางแผนหนี้',
    description: 'วอร์มเรื่องออมฉุกเฉินและหนี้สำหรับคนมีพื้นฐานการเงินอยู่บ้าง',
    content: {
      intro: 'สำหรับคนที่เริ่มดูแลเงินตัวเองอยู่บ้างแล้ว เควสนี้ทบทวนเรื่องเงินออมฉุกเฉินและการวางแผนหนี้',
      objectives: [
        'รู้ว่าเงินออมฉุกเฉินควรมีเท่าไหร่',
        'เช็คสถานะหนี้/ดอกเบี้ยของตัวเอง (ถ้ามี)',
        'ตั้งเป้าออมฉุกเฉินของตัวเองได้',
      ],
    },
    checklist: [
      { order_index: 1, label: 'อ่านบทความเรื่องเงินออมฉุกเฉิน/การจัดการหนี้ที่ Money Buffalo', link_url: 'https://www.moneybuffalo.in.th/' },
      { order_index: 2, label: 'คำนวณว่าเงินออมฉุกเฉิน 3-6 เดือนของตัวเองควรมีเท่าไหร่', link_url: null },
      { order_index: 3, label: 'ถ้ามีหนี้ ให้จดอัตราดอกเบี้ยของหนี้แต่ละก้อนไว้เทียบกัน', link_url: null },
      { order_index: 4, label: 'อ่านบทความเสริมเรื่องวางแผนการเงินที่ aomMONEY', link_url: 'https://aommoney.com/' },
    ],
  },
  {
    topicSlug: 'finance',
    level: 'advanced',
    title: 'เควสแรก: เริ่มรู้จักการลงทุนกองทุน/หุ้น',
    description: 'ต่อยอดสำหรับคนวางแผนการเงินพื้นฐานแน่นแล้ว เริ่มโลกการลงทุน',
    content: {
      intro: 'สำหรับคนที่วางแผนการเงินพื้นฐาน (งบ-ออม-หนี้) แน่นแล้ว เควสนี้พาเริ่มรู้จักโลกการลงทุนกองทุนรวม/หุ้น',
      objectives: [
        'รู้จักความแตกต่างเงินฝาก/กองทุนรวม/หุ้นคร่าว ๆ',
        'สมัครสมาชิก SET ฟรีเพื่อเข้าถึงคอร์สลงทุน',
        'ตั้งเป้าหมายการลงทุนระยะยาวของตัวเองข้อแรก',
      ],
    },
    checklist: [
      { order_index: 1, label: 'สมัครสมาชิกฟรีแล้วเรียนคอร์สหลักการลงทุนที่ SET e-Learning', link_url: 'https://elearning.set.or.th/' },
      { order_index: 2, label: 'อ่านบทความ/ห้องเรียนนักลงทุนที่ SET Invest Now', link_url: 'https://www.setinvestnow.com/' },
      { order_index: 3, label: 'จดความแตกต่างของเงินฝาก/กองทุนรวม/หุ้น ที่เข้าใจ 3 ข้อ', link_url: null },
      { order_index: 4, label: 'ตั้งเป้าหมายการลงทุนระยะยาวของตัวเอง 1 ข้อ (เช่น เกษียณ/ซื้อบ้าน)', link_url: null },
    ],
  },
];

async function main() {
  const { data: topics, error: topicsErr } = await supabase
    .from('topics')
    .select('id, slug');
  if (topicsErr) throw topicsErr;

  const topicIdBySlug = new Map(topics.map((t) => [t.slug, t.id]));
  const missingSlugs = [...new Set(STARTER_QUESTS.map((q) => q.topicSlug))].filter(
    (slug) => !topicIdBySlug.has(slug)
  );
  if (missingSlugs.length) {
    throw new Error(`ไม่พบ topic ใน DB: ${missingSlugs.join(', ')} — รัน schema.sql seed topics ก่อน`);
  }

  const rows = STARTER_QUESTS.map((q) => ({
    topic_id: topicIdBySlug.get(q.topicSlug),
    level: q.level,
    title: q.title,
    description: q.description,
    content: q.content,
    checklist: q.checklist,
    xp_reward: XP_REWARD,
  }));

  const { data, error } = await supabase
    .from('starter_quests')
    .upsert(rows, { onConflict: 'topic_id,level' })
    .select('id, topic_id, level, title');
  if (error) throw error;

  console.log(`อัปเสิร์ต starter_quests สำเร็จ ${data.length} แถว`);

  const { count, error: countErr } = await supabase
    .from('starter_quests')
    .select('id', { count: 'exact', head: true });
  if (countErr) throw countErr;
  console.log(`รวมทั้งหมดใน DB ตอนนี้: ${count} แถว (คาดหวัง 18)`);
}

main().catch((err) => {
  console.error('seed ล้มเหลว:', err.message || err);
  process.exit(1);
});
