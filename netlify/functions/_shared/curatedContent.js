// Whitelist โดเมน + โครง roadmap ต่อหัวข้อ — จาก .scratch/app-v2-spec/assets/thai-lesson-sources.md (#12)
// ใช้เป็น grounding context ให้ Gemini ตอน generate roadmap/เควส (#07) + guardrail ตรวจลิงก์โหมดพิมพ์อิสระ (#02)
// ห้ามแก้ตัวเลข/รายชื่อโดเมนโดยไม่เช็ค thai-lesson-sources.md ก่อน — เป็นสเปกที่ล็อกแล้ว

export const WHITELIST_DOMAINS = [
  'school.borntodev.com',
  'www.borntodev.com',
  'www.youtube.com',
  'github.com',
  'mooc.chula.ac.th',
  'www.skooldio.com',
  'www.w3schools.com',
  'www.kaggle.com',
  'datarockie.com',
  'blog.datath.com',
  'developers.google.com',
  'code-th.com',
  'developer.mozilla.org',
  'www.freecodecamp.org',
  'www.digitalskill.org',
  'www.coursera.org',
  'www.thepexcel.com',
  'www.9experttraining.com',
  'support.microsoft.com',
  'elearning.set.or.th',
  'www.setinvestnow.com',
  'www.bot.or.th',
  'aommoney.com', // ห้ามใส่ www — www.aommoney.com เข้าไม่ได้
  'www.moneybuffalo.in.th',
];

// ลิงก์ค้นหาที่อนุญาต — AI แต่งคำค้นได้ แต่ domain+path ต้องตรง pattern นี้เป๊ะ
const SEARCH_PATTERNS = [
  { hostname: 'www.youtube.com', pathname: '/results' },
  { hostname: 'www.google.com', pathname: '/search' },
];

// อนุญาตเฉพาะ (ก) ลิงก์ค้นหาตาม pattern — ห้ามแต่ง deep URL เด็ดขาด
//
// อัพเดต 23 ก.ค. 2026 (เจ้าของเจอตอนใช้จริง): เดิมอนุญาต "หน้าหลัก" ของโดเมน whitelist ด้วย
// ผลคือเควสที่ Gemini สร้างมักแนบ https://www.youtube.com/ เฉย ๆ (พรอมพ์ก็สั่งให้ใช้หน้าหลัก)
// ผู้เรียนกดแล้วไปโผล่หน้าแรก YouTube ไม่ได้บทเรียนอะไรเลย — ลิงก์ที่ไม่พาไปถึงเนื้อหาก็ไม่ต่างจากไม่มีลิงก์
// ตอนนี้หน้าหลักเปล่า ๆ ถือว่า "ไม่ผ่าน" แล้ว sanitizeChecklistLinks จะแทนด้วยลิงก์ค้นหาจากชื่อขั้นตอน+หัวข้อ
// (ยังคงกฎเดิมที่ห้ามแต่ง URL ลึกไว้ครบ — เราไม่เคยเดา URL ที่อาจไม่มีจริง)
export function isAllowedLink(url) {
  let u;
  try {
    u = new URL(String(url));
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;

  const isSearch = SEARCH_PATTERNS.some((p) => p.hostname === u.hostname && u.pathname === p.pathname);
  return isSearch;
}

export function safeSearchLink(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

// โครง roadmap ต่อหัวข้อ curated 6 หัวข้อ (#02/#12) — ใช้เป็น grounding ตอนสั่ง Gemini วาง phase/เควส
// Data/ML ยก roadmap Kaggle จาก ml-quest เดิมมาเป็นแกน (ตัดสินใจแล้วใน #02)
export const TOPIC_OUTLINES = {
  python: {
    title: 'Python เริ่มจากศูนย์',
    outline:
      'ติดตั้ง Python / ใช้ Google Colab -> ตัวแปร+ชนิดข้อมูล+input/print -> if-else -> loop -> ฟังก์ชัน -> list/dict -> อ่านไฟล์+error พื้นฐาน -> มินิโปรเจกต์ (เช่น โปรแกรมบันทึกรายจ่าย)',
    sources: [
      { label: 'borntoDev School — Zero to One: Python', url: 'https://school.borntodev.com/', lang: 'th' },
      { label: 'KongRuksiam Official (YouTube)', url: 'https://www.youtube.com/', lang: 'th' },
      { label: 'Skooldio — Python พื้นฐาน', url: 'https://www.skooldio.com/', lang: 'th' },
      { label: 'CHULA MOOC — Learn Python', url: 'https://mooc.chula.ac.th/', lang: 'th' },
      { label: 'W3Schools Python (เสริม)', url: 'https://www.w3schools.com/', lang: 'en' },
    ],
  },
  'data-ml': {
    title: 'Data/ML',
    outline:
      'Python & Data Wrangling (Pandas) -> Core ML (Intro to ML, Intermediate ML) -> Deep Learning -> Specialize & Portfolio (โปรเจกต์ dataset จริง) — ยก roadmap Kaggle จาก ml-quest เดิมเป็นแกน',
    sources: [
      { label: 'Kaggle Learn', url: 'https://www.kaggle.com/', lang: 'en' },
      { label: 'DataRockie', url: 'https://datarockie.com/', lang: 'th' },
      { label: 'DataTH', url: 'https://blog.datath.com/', lang: 'th' },
      { label: 'PrasertCBS (YouTube)', url: 'https://www.youtube.com/', lang: 'th' },
      { label: 'Google ML Crash Course (เสริม)', url: 'https://developers.google.com/', lang: 'en' },
    ],
  },
  web: {
    title: 'สร้างเว็บ (HTML/CSS/JS)',
    outline:
      'HTML โครงสร้างหน้า -> CSS จัดหน้า/สี/ฟอนต์ -> Flexbox/Grid + responsive -> JS พื้นฐาน + DOM -> ฟอร์ม+event -> โปรเจกต์เว็บโปรไฟล์ตัวเอง + deploy ฟรี',
    sources: [
      { label: 'Code-TH.com', url: 'https://code-th.com/', lang: 'th' },
      { label: 'borntoDev — Fundamental Web Dev', url: 'https://www.borntodev.com/', lang: 'th' },
      { label: 'KongRuksiam Official (YouTube)', url: 'https://www.youtube.com/', lang: 'th' },
      { label: 'MDN Learn Web Development (เสริม)', url: 'https://developer.mozilla.org/', lang: 'en' },
      { label: 'freeCodeCamp (เสริม)', url: 'https://www.freecodecamp.org/', lang: 'en' },
    ],
  },
  'ai-tools': {
    title: 'ใช้ AI ให้เป็น',
    outline:
      'AI ทำอะไรได้/ไม่ได้ + ข้อจำกัด -> สมัครใช้ ChatGPT/Gemini ฟรี -> หลักเขียน prompt (บริบท-คำสั่ง-ตัวอย่าง-รูปแบบผลลัพธ์) -> use case เรียน/งานเอกสาร/สรุป/แปล -> เครื่องมือ AI สร้างรูป/สไลด์ -> จริยธรรม + ตรวจสอบข้อเท็จจริง',
    sources: [
      { label: 'Skooldio — Unlock AI with Prompt Engineering', url: 'https://www.skooldio.com/', lang: 'th' },
      { label: 'depa Digital Skill', url: 'https://www.digitalskill.org/', lang: 'th' },
      { label: 'YouTube ไทย (ค้นหา)', url: 'https://www.youtube.com/results?search_query=สอนใช้+ChatGPT', lang: 'th' },
      { label: 'Google AI Essentials (Coursera, เสริม)', url: 'https://www.coursera.org/', lang: 'en' },
    ],
  },
  excel: {
    title: 'Excel/Google Sheets',
    outline:
      'รู้จักหน้าจอ+กรอกข้อมูล -> สูตรพื้นฐาน SUM/AVERAGE/COUNT -> IF + เงื่อนไข -> จัด format + conditional formatting -> VLOOKUP/XLOOKUP -> PivotTable -> มินิโปรเจกต์ dashboard รายจ่าย',
    sources: [
      { label: 'เทพเอ็กเซล', url: 'https://www.thepexcel.com/', lang: 'th' },
      { label: 'borntoDev School — Excel for Everyone', url: 'https://school.borntodev.com/', lang: 'th' },
      { label: '9Expert Training (บทความ)', url: 'https://www.9experttraining.com/', lang: 'th' },
      { label: 'Microsoft Support ภาษาไทย', url: 'https://support.microsoft.com/', lang: 'th' },
      { label: 'YouTube ไทย (ค้นหา Google Sheets)', url: 'https://www.youtube.com/results?search_query=Google+Sheets+พื้นฐาน', lang: 'th' },
    ],
  },
  finance: {
    title: 'การเงินส่วนบุคคล',
    outline:
      'ทำงบส่วนตัว รายรับ-รายจ่าย -> เงินออมฉุกเฉิน 3-6 เดือน -> หนี้+ดอกเบี้ย -> ภาษีเงินได้เบื้องต้น -> เริ่มลงทุน (เงินฝาก/กองทุนรวม/หุ้น) -> วางแผนเป้าหมายระยะยาว',
    sources: [
      { label: 'SET e-Learning', url: 'https://elearning.set.or.th/', lang: 'th' },
      { label: 'SET Invest Now', url: 'https://www.setinvestnow.com/', lang: 'th' },
      { label: 'แบงก์ชาติ — สตางค์ Story', url: 'https://www.bot.or.th/', lang: 'th' },
      { label: 'aomMONEY', url: 'https://aommoney.com/', lang: 'th' },
      { label: 'Money Buffalo', url: 'https://www.moneybuffalo.in.th/', lang: 'th' },
    ],
  },
};

export function getTopicOutline(slug) {
  return TOPIC_OUTLINES[slug] ?? null;
}
