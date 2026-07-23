// ด่านกรองหัวข้อพิมพ์อิสระ (freeform topic) — ชั้นที่ 1 ของ 2
//
// ที่มา: 22 ก.ค. 2026 มีผู้ใช้จริงพิมพ์คำหยาบเป็นหัวข้อเรียน แล้วระบบ generate roadmap ให้เรียบร้อย
// (ตอนนั้น generate-quest.js เช็คแค่ความยาว + level เท่านั้น) — หัวข้อไม่หลุดหน้าสาธารณะ
// (view leaderboard/public_stats/stats_daily_growth ไม่มีคอลัมน์ topic_title) แต่โผล่บนจอเจ้าตัวเต็ม ๆ
//
// ชั้นที่ 1 (ไฟล์นี้): บล็อกลิสต์ deterministic ฝั่ง server — ฟรี ไม่กินโควตา Gemini และตอบทันที
// ชั้นที่ 2: ให้ Gemini ตีกลับเองผ่าน field `topic_ok` ใน ROADMAP_JSON_SCHEMA (ไม่เพิ่ม request)
//           — จับสิ่งที่บล็อกลิสต์ไม่รู้จัก (คำเลี่ยงบาลี, ภาษาอื่น, หัวข้อผิดกฎหมาย/อันตราย)
//
// เจตนาของลิสต์: กันการพิมพ์เล่นแบบเปิดเผยเท่านั้น ไม่ใช่ระบบ moderation สมบูรณ์แบบ
// **ตั้งใจไม่ใส่** คำที่หัวข้อเรียนจริงอาจใช้: "ยาเสพติด" (เรียนเรื่องโทษของมันได้), "กัญชา"
// (ปลูกถูกกฎหมายในไทย), "เจาะระบบ/pentest" (สายอาชีพจริง), "ช่วยตัวเอง" (= พึ่งตัวเอง ก็ได้)
// — ปล่อยให้ชั้นที่ 2 ตัดสินตามบริบทแทน ดีกว่าบล็อกหัวข้อที่ผู้ใช้ตั้งใจเรียนจริง

export const TOPIC_REJECT_CODE = 'TOPIC_NOT_ALLOWED';
export const TOPIC_REJECT_MESSAGE =
  'หัวข้อนี้ไม่เข้าข่ายสิ่งที่เรียนรู้ในแอปได้ ลองพิมพ์ทักษะหรือเรื่องที่อยากเก่งจริง ๆ ดูใหม่นะ';

// คำไทยที่ชัดเจนว่าไม่ใช่หัวข้อเรียน (เพศ/คำด่า/ความรุนแรง) — จับแบบ substring บนข้อความที่ normalize แล้ว
const THAI_BLOCKED = [
  'เย็ด', 'ควย', 'จิ๋ม', 'แตด', 'เงี่ยน', 'หนังโป๊', 'คลิปหลุด', 'ขายตัว', 'ค้าประเวณี',
  'เหี้ย', 'สัส', 'ระยำ', 'ชิบหาย', 'พ่อง', 'อีดอก', 'ไอ้เวร',
  'ทำระเบิด', 'ประกอบระเบิด', 'ฆ่าคน', 'วิธีฆ่า', 'ปืนเถื่อน',
];

// "หี" ต้องกันคำปกติที่มีเสียงนี้อยู่ข้างใน:
//   หีบ / หีบเพลง        -> ตามด้วย บ
//   เหี่ยว (ผิวเหี่ยวย่น) -> ตามด้วยไม้เอก ่
// ("เหี้ย" ใช้ไม้โท ้ จึงยังโดนจับ และมีในลิสต์ข้างบนอยู่แล้ว)
const THAI_BLOCKED_PATTERNS = [/หี(?![บ่])/];

// คำอังกฤษ — จับด้วยขอบเขตคำ (\b) เท่านั้น ห้ามใช้ substring เด็ดขาด:
//   substring "cock" จะไปโดน cooking, "anal" จะไปโดน analysis/analytics ซึ่งเป็นหัวข้อเรียนจริง
// \b ใช้กับข้อความไทยได้ เพราะอักษรไทยเป็น non-word char จึงเกิดขอบเขตคำให้เอง (เช่น "อยากดูporn")
const EN_BLOCKED = [
  'fuck', 'fucking', 'shit', 'bitch', 'dick', 'pussy', 'cock', 'cunt', 'porn', 'pornhub',
  'nude', 'nudes', 'blowjob', 'handjob', 'anal', 'rape', 'incest', 'hentai',
];

// normalize สำหรับภาษาไทย — กันการเลี่ยงแบบง่าย ๆ
// - ตัดช่องว่าง/เครื่องหมายวรรคตอน/zero-width (ค​ ว ย, ค.ว.ย)
// - ยุบตัวอักษรซ้ำติดกันเหลือตัวเดียว (คววยยย -> ควย)
// หมายเหตุ: ยุบตัวซ้ำทำให้ "ธรรมะ" -> "ธรมะ" ด้วย ไม่เป็นไรเพราะคำในบล็อกลิสต์ normalize แบบเดียวกัน
function normalizeThai(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[​-‍﻿]/g, '')
    .replace(/[\s._\-*+=/\\|~^`'"(){}\[\]<>!?,;:]/g, '')
    .replace(/(.)\1+/g, '$1');
}

// สำหรับอังกฤษ: ตัดแค่เครื่องหมายคั่นที่ใช้เลี่ยงคำ (p.o.r.n / f-u-c-k) แต่เก็บ whitespace ไว้
// เพื่อให้ \b ยังเห็นขอบเขตของวลีหลายคำ (nude drawing / rape culture / anal anatomy)
function deobfuscateLatin(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[​-‍﻿]/g, '')
    .replace(/(?<=[a-z])[-._*](?=[a-z])/g, '');
}

// leetspeak + ยุบตัวอักษรซ้ำเป็น variant แยก — ต้องคงข้อความปกติไว้ด้วยเพื่อไม่ให้ cooking/analysis ถูกแปลงจนเกิด false positive
const LATIN_LEET_MAP = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

function normalizeLatinLeet(text) {
  return text.replace(/[013457@$]/g, (char) => LATIN_LEET_MAP[char] ?? char);
}

function collapseLatinRepeats(text) {
  return text.replace(/([a-z])\1+/g, '$1');
}

/**
 * ตรวจหัวข้อที่ผู้ใช้พิมพ์เอง (ชั้นที่ 1)
 * @returns {{ ok: true } | { ok: false, matched: string }}
 */
export function checkTopicText(rawText) {
  const thai = normalizeThai(rawText);
  if (!thai) return { ok: true }; // ว่างเปล่า — ปล่อยให้ตัว validate ความยาวเดิมใน generate-quest จัดการ

  for (const term of THAI_BLOCKED) {
    if (thai.includes(normalizeThai(term))) return { ok: false, matched: term };
  }
  for (const pattern of THAI_BLOCKED_PATTERNS) {
    if (pattern.test(thai)) return { ok: false, matched: pattern.source };
  }

  const latin = deobfuscateLatin(rawText);
  const latinVariants = [latin, collapseLatinRepeats(normalizeLatinLeet(latin))];
  for (const variant of latinVariants) {
    for (const word of EN_BLOCKED) {
      if (new RegExp(`\\b${word}\\b`).test(variant)) return { ok: false, matched: word };
    }
  }

  return { ok: true };
}
