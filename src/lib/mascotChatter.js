// สมองของมาสคอตที่เดินอยู่บน bottom nav — ตัดสินว่า "จะพูดอะไร" และ "พูดได้หรือยัง"
//
// กฎข้อเดียวที่ทำให้มาสคอตแบบนี้รอด (Duolingo/Finch ใช้เหมือนกัน): มันต้องพูดถึง
// **สถานการณ์จริงของผู้ใช้คนนี้ ณ ตอนนี้** เท่านั้น — คำให้กำลังใจสุ่ม ๆ คนจะเลิกอ่านภายใน 2-3 วัน
// และมาสคอตที่พูดพร่ำแย่กว่าไม่มีมาสคอตเลย ดังนั้นทุกอย่างในไฟล์นี้ตั้งใจ "พูดน้อยแต่ตรง"
//
// ที่มาของข้อมูล: profile จาก useProfile() ล้วน (total_xp / current_streak / last_quest_date)
// ไม่มีการยิง API เพิ่มแม้แต่ครั้งเดียว

import { gradeForLevel, levelProgress, nextRankFrom } from './gradeBands.js';

// ---- เวลาไทย (UTC+7 คงที่ ไม่มี DST) — ชุดเดียวกับที่ src/pages/Quest.jsx ใช้ตัดสิน streak ----
function bangkokParts(d = new Date()) {
  const bkk = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return {
    dateStr: bkk.toISOString().slice(0, 10),
    hour: bkk.getUTCHours(),
    minute: bkk.getUTCMinutes(),
  };
}

function prevDateStr(s) {
  const [y, m, dd] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd - 1)).toISOString().slice(0, 10);
}

const STREAK_MILESTONE_TEXT = {
  3: 'สามวันติดแล้วนะ! ช่วงนี้แหละที่คนส่วนใหญ่หลุด แต่เรายังอยู่ 🔥',
  7: 'ครบ 7 วันติด! หนึ่งสัปดาห์ไม่ขาดเลยสักวัน เก่งของจริง 🔥',
  14: '14 วันติดแล้ว! นี่ไม่ใช่ความขยันชั่วคราวละ มันคือนิสัยแล้ว 💪',
  30: '30 วันติด!! เต็มเดือนแบบไม่พลาดเลย ขอคารวะ 🏆',
};

const NEAR_RANK_XP = 40; // ใกล้แรงค์ถัดไปแค่ไหนถึงจะพูดถึง
const NEAR_LEVEL_XP = 10; // ใกล้เลเวลถัดไปแค่ไหนถึงจะพูดถึง
const LATE_EVENING_HOUR = 20; // เตือน streak ใกล้ขาดตอนสามทุ่ม... (20:00 เป็นต้นไป)
const AFTERNOON_HOUR = 12; // ก่อนเที่ยงไม่ทวงเควส (เพิ่งตื่น)

/**
 * เลือกข้อความที่ตรงกับสถานะจริงของผู้ใช้ ณ เวลานี้
 * @param {{ profile: object|null, now?: Date }} args
 * @returns {{ id: string, text: string, mood: string }|null} null = ไม่มีอะไรควรพูด (เงียบไว้ดีกว่า)
 */
// canInstall = ยังติดตั้งลงหน้าจอโฮมได้อยู่ไหม (ดู src/lib/installState.js) — ใช้เป็นประโยคสำรอง
// ตอนไม่มีเรื่องเรียนจะพูด ไม่ใช่ประโยคหลัก
export function pickMascotMessage({ profile, now = new Date(), canInstall = false }) {
  if (!profile) return null;

  const { dateStr, hour, minute } = bangkokParts(now);
  const lastDate = profile.last_quest_date || null;
  const doneToday = lastDate === dateStr;
  // streak ที่เก็บใน DB ค้างเป็นเลขเก่าตลอดช่วงที่ขาด (backend รีเซ็ตแบบ lazy ตอนเคลมครั้งถัดไป)
  // ต้องดูจาก last_quest_date เองเหมือนหน้าเควส ไม่งั้นมาสคอตจะไปอวย streak ที่ขาดไปแล้ว
  const streakBroken = !!lastDate && lastDate < prevDateStr(dateStr);
  const streak = streakBroken ? 0 : profile.current_streak ?? 0;
  const totalXp = profile.total_xp ?? 0;

  // ---- ทำเควสของวันนี้ไปแล้ว: ชม + ไล่ไปพัก ----
  if (doneToday) {
    if (STREAK_MILESTONE_TEXT[streak]) {
      return { id: `streak-${streak}`, text: STREAK_MILESTONE_TEXT[streak], mood: 'celebrate' };
    }
    return {
      id: 'done-today',
      text: 'เควสวันนี้จบแล้ว พักได้เต็มที่เลย~ เดี๋ยวพรุ่งนี้มาลุยต่อ 😊',
      mood: 'groove',
    };
  }

  // ---- ผู้ใช้ใหม่เอี่ยม ยังไม่เคยทำเควสเลย: ชวนเริ่ม (เบา ๆ ไม่กดดัน) ----
  if (!lastDate && totalXp === 0) {
    return {
      id: 'first-quest',
      text: 'เควสแรกรออยู่นะ~ ใช้เวลาแค่ช่วงพักเบรกเดียวก็จบแล้ว ลุยมั้ย?',
      mood: 'idle',
    };
  }

  // ---- ดึกแล้วยังไม่ได้ลุย + มี streak ค้างอยู่: เตือนว่าใกล้ขาด พร้อมเวลาที่เหลือจริง ----
  if (hour >= LATE_EVENING_HOUR && streak > 0) {
    const minutesLeft = (24 - hour) * 60 - minute; // ถึงเที่ยงคืนเวลาไทย = เส้นตายของ streak
    const left = minutesLeft >= 60 ? `อีก ${Math.floor(minutesLeft / 60)} ชั่วโมง` : 'อีกไม่ถึงชั่วโมง';
    return {
      id: 'streak-risk',
      text: `streak ${streak} วันจะขาดแล้ว! เหลือ${left} — เควสวันนี้ยังทันอยู่นะ 😰`,
      mood: 'sad',
    };
  }

  // ---- ใกล้ขึ้นแรงค์ใหม่: จูงใจด้วยตัวเลขจริง ----
  const nextRank = nextRankFrom(totalXp);
  if (nextRank && nextRank.min - totalXp <= NEAR_RANK_XP) {
    return {
      id: `near-rank-${nextRank.grade}`,
      text: `อีก ${nextRank.min - totalXp} XP ขึ้นแรงค์ ${nextRank.grade} แล้ว! เควสเดียวก็อาจถึงนะ ✨`,
      mood: 'rankup',
    };
  }

  // ---- ใกล้ขึ้นเลเวล (ถี่กว่าแรงค์ ใช้ตอนแรงค์ยังไกล) ----
  const lv = levelProgress(totalXp);
  if (lv.xpToNext <= NEAR_LEVEL_XP) {
    return {
      id: `near-level-${lv.level + 1}`,
      text: `อีกแค่ ${lv.xpToNext} XP ขึ้น Lv.${lv.level + 1} (แรงค์ ${gradeForLevel(lv.level + 1)}) แล้ว~`,
      mood: 'celebrate',
    };
  }

  // ---- บ่ายแล้วยังไม่ได้ลุย แต่ streak ยังอยู่: ทวงเบา ๆ ครั้งเดียวพอ ----
  if (streak > 0 && hour >= AFTERNOON_HOUR) {
    return {
      id: 'streak-keep',
      text: `ตอนนี้ streak ${streak} วันติดอยู่นะ วันนี้ยังไม่ได้ลุยเลย~`,
      mood: 'idle',
    };
  }

  // ---- streak เพิ่งขาด (เคยทำ แต่หลุดไปแล้ว): ชวนกลับมา ไม่ประณาม ----
  if (streakBroken && hour >= AFTERNOON_HOUR) {
    return {
      id: 'streak-comeback',
      text: 'streak ขาดไปก็ไม่เป็นไรเลย~ ทำเควสวันนี้ก็เริ่มนับใหม่ทันที 💜',
      mood: 'idle',
    };
  }

  // ---- ไม่มีเรื่องเรียนจะพูดแล้ว แต่ยังติดตั้งแอพลงหน้าจอได้อยู่: ชวนเบา ๆ ----
  // ★ ต้องอยู่ล่างสุดเสมอ — เรื่องความคืบหน้าการเรียนสำคัญกว่าการชวนติดตั้งทุกกรณี
  //   ประโยคนี้จึงโผล่เฉพาะตอนที่ปกติมาสคอตจะเงียบอยู่แล้ว ไม่ไปแย่งที่ของเรื่องเควส
  //   (คูลดาวน์ + wasSpoken ของ NavMascot คุมความถี่ให้อยู่แล้ว พูดซ้ำใน session เดียวไม่ได้)
  if (canInstall) {
    return {
      id: 'install-nudge',
      text: 'อยากให้เราไปอยู่หน้าจอโฮมด้วยมั้ย? กดตรงนี้เลย~',
      mood: 'celebrate',
      action: 'install', // NavMascot เอาไปทำให้ฟองคำพูดกดได้
    };
  }

  return null; // ไม่มีอะไรจริง ๆ ให้พูด — เงียบไว้ ดีกว่าพูดพล่อย ๆ
}

// ---------- คุมความถี่ (บังคับ) ----------
// - พูดได้ไม่เกิน 1 ครั้งต่อ SPEAK_COOLDOWN_MS
// - ข้อความเดิมพูดซ้ำใน session เดียวไม่ได้ (จำใน sessionStorage — ปิดแท็บแล้วเริ่มใหม่ได้)
export const SPEAK_COOLDOWN_MS = 4 * 60 * 1000; // 4 นาที
export const BUBBLE_VISIBLE_MS = 7000; // โผล่ค้างไว้ 7 วิ แล้วหายเอง
export const FIRST_SPEAK_DELAY_MS = 4000; // เข้าแอพมาอย่าเพิ่งทัก ให้ตั้งหลักก่อน

const SHOWN_KEY = 'luiquest_mascot_shown';
const LAST_KEY = 'luiquest_mascot_last';

function readStore(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null; // โหมดส่วนตัว/ปิด storage — ถือว่าไม่เคยพูด (ยังคุมด้วย cooldown ใน memory อยู่)
  }
}

function writeStore(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* เขียนไม่ได้ก็ช่างมัน ไม่ควรทำให้ UI พัง */
  }
}

/** เคยพูดข้อความนี้ไปแล้วใน session นี้หรือยัง */
export function wasSpoken(id) {
  const raw = readStore(SHOWN_KEY);
  if (!raw) return false;
  try {
    return JSON.parse(raw).includes(id);
  } catch {
    return false;
  }
}

/** ถึงเวลาพูดรอบใหม่หรือยัง (คูลดาวน์ข้ามการเปลี่ยนหน้า/รีโหลดได้เพราะเก็บใน sessionStorage) */
export function cooldownPassed(now = Date.now()) {
  const last = Number(readStore(LAST_KEY) || 0);
  return !last || now - last >= SPEAK_COOLDOWN_MS;
}

/** บันทึกว่าพูดข้อความนี้ไปแล้ว + รีเซ็ตคูลดาวน์ */
export function markSpoken(id, now = Date.now()) {
  const raw = readStore(SHOWN_KEY);
  let list = [];
  try {
    list = raw ? JSON.parse(raw) : [];
  } catch {
    list = [];
  }
  if (!list.includes(id)) list.push(id);
  writeStore(SHOWN_KEY, JSON.stringify(list.slice(-40)));
  writeStore(LAST_KEY, String(now));
}
