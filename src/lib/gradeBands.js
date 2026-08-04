// Single source of truth ของระบบความก้าวหน้าทั้งแอพ: XP -> เลเวล -> แรงค์
// ใช้ร่วมกันทั้ง frontend (src/pages/Quest.jsx, DailyQuestPage) และ backend
// (netlify/functions/_shared/gameplay.js -> computeGrade + RPC complete_quest ที่รับ bands เป็น jsonb)
// เป็น plain values/functions ล้วน ทั้ง Vite และ esbuild (Netlify bundler) import ข้าม runtime ได้ตรง ๆ
//
// อัพเดต 23 ก.ค. 2026 — เปลี่ยนเป็นระบบเลเวลแบบเกม (เจ้าของขอ):
// เดิมตัดเกรดจาก "วันติด (streak)" ทำให้หลอดค้าง 0% ทั้งที่ทำเควสได้ XP ทุกวัน (ตัวหารขยับได้วันละ 1
// และรีเซ็ตทันทีที่ขาดวัน) ตอนนี้ทุกอย่างมาจากเส้นเดียวกันหมด:
//
//   ทำเควส -> ได้ XP (10-30/เควส) -> XP สะสมดันเลเวล -> ถึงเลเวลหมุดหมาย = เลื่อนแรงค์
//
// แต่ละเลเวลต้องใช้ XP มากขึ้นเรื่อย ๆ แบบเกมทั่วไป: เลเวล 1->2 ใช้ 25 XP แล้วบวกทีละ 5 ต่อเลเวล
// (ที่ ~20 XP/วัน: D ~1 วัน, C ~5 วัน, B ~9 วัน, A ~17 วัน, S ~27 วัน, SS ~45 วัน, SSS ~66 วัน)
// streak ยังอยู่ครบในฐานะตัวเลข/การ์ดแชร์/แรงจูงใจรายวัน แค่ไม่ใช่ตัวตัดแรงค์อีกต่อไป

export const LEVEL_BASE_XP = 25; // XP ที่ต้องใช้เลื่อนจากเลเวล 1 -> 2
export const LEVEL_STEP_XP = 5; // แต่ละเลเวลถัดไปต้องการเพิ่มขึ้นทีละเท่านี้

/** XP สะสมที่ต้องมีเพื่อ "ถึง" เลเวลนี้ (เลเวล 1 = 0 XP) */
export function xpToReachLevel(level) {
  const steps = Math.max(0, level - 1);
  return steps * LEVEL_BASE_XP + ((steps * (steps - 1)) / 2) * LEVEL_STEP_XP;
}

/** XP ที่ต้องใช้เลื่อนจากเลเวลนี้ไปเลเวลถัดไป */
export function xpForNextLevel(level) {
  return LEVEL_BASE_XP + (level - 1) * LEVEL_STEP_XP;
}

/** เลเวลปัจจุบันจาก XP สะสม (เริ่มที่เลเวล 1) */
export function levelFromXp(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  let level = 1;
  while (xp >= xpToReachLevel(level + 1)) level += 1;
  return level;
}

/**
 * ความคืบหน้าภายในเลเวลปัจจุบัน — ใช้วาดหลอด XP
 * @returns {{ level, xpIntoLevel, xpForLevel, xpToNext, pct }}
 */
export function levelProgress(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  const level = levelFromXp(xp);
  const floor = xpToReachLevel(level);
  const span = xpForNextLevel(level);
  const xpIntoLevel = xp - floor;
  return {
    level,
    xpIntoLevel,
    xpForLevel: span,
    xpToNext: Math.max(0, span - xpIntoLevel),
    pct: Math.max(0, Math.min(100, Math.round((xpIntoLevel / span) * 100))),
  };
}

// หมุดหมายแรงค์: ถึงเลเวลไหนได้แรงค์อะไร (S/SS/SSS ได้สีทองอัตโนมัติเพราะ UI ดูจากตัวอักษรแรก)
export const RANK_LEVELS = [
  { grade: 'F', level: 1 },
  { grade: 'D', level: 2 },
  { grade: 'C', level: 4 },
  { grade: 'B', level: 6 },
  { grade: 'A', level: 9 },
  { grade: 'S', level: 12 },
  { grade: 'SS', level: 16 },
  { grade: 'SSS', level: 20 },
];

// เกณฑ์แรงค์เป็น "XP สะสม" ที่คำนวณจากหมุดหมายเลเวลด้านบน — backend/RPC ใช้ก้อนนี้ตรง ๆ
// จึงไม่มีทางที่เลเวลกับแรงค์จะคิดคนละทาง (แก้เส้นโค้งเลเวลที่เดียว เกณฑ์แรงค์ขยับตามเอง)
export const GRADE_BANDS = RANK_LEVELS.map((r) => ({
  grade: r.grade,
  min: xpToReachLevel(r.level),
  level: r.level,
}));

export const GRADE_ORDER = GRADE_BANDS.map((b) => b.grade);

/** แรงค์ถัดไป + เลเวลที่ต้องไปให้ถึง (null = แรงค์สูงสุดแล้ว) */
export function nextRankFrom(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  return GRADE_BANDS.find((b) => xp < b.min) ?? null;
}

/**
 * แรงค์ปัจจุบันจาก XP สะสม — helper กลางของทุกหน้าจอ
 * ห้ามอ่าน profiles.grade ที่เก็บใน DB มาโชว์ตรง ๆ: XP จากลิงก์ชวนเพื่อน (redeem-referral) บวก total_xp
 * โดยไม่แตะคอลัมน์ grade แถบโปรไฟล์จึงเคยโชว์แรงค์เก่าค้างสวนทางกับหน้าเควส
 * @returns {{ grade: string, min: number, level: number }} band ปัจจุบัน
 */
export function gradeFromXp(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  return GRADE_BANDS.reduce((acc, b) => (xp >= b.min ? b : acc), GRADE_BANDS[0]);
}

/** แรงค์ "จริง" ของเลเวลที่กำหนด — คู่กับตัวเลข Lv. ที่โชว์ข้าง ๆ กัน (Lv.3 ยังเป็น D ไม่ใช่ C) */
export function gradeForLevel(level) {
  const lv = Math.max(1, Number(level) || 1);
  return RANK_LEVELS.reduce((acc, r) => (lv >= r.level ? r.grade : acc), RANK_LEVELS[0].grade);
}
