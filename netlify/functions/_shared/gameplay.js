// กติกาเกม: คำนวณ streak ใหม่ตอนทำเควสเสร็จ + letter grade จาก streak ปัจจุบัน
// หมายเหตุ 2026-07-16: complete-quest.js ย้ายการคำนวณจริงลง RPC complete_quest ใน Postgres แล้ว
// (แก้ race lost-update — ดู supabase/schema.sql) — logic ใน SQL ต้อง mirror ฟังก์ชันในไฟล์นี้
// ไฟล์นี้คงไว้เป็น reference/เผื่อใช้ฝั่ง JS อื่น threshold grade ยังมาจาก src/lib/gradeBands.js ที่เดียว
import { bangkokDateStr, prevDateStr } from './datetime.js';
// threshold ของแต่ละ grade มาจาก src/lib/gradeBands.js — ไฟล์เดียวที่ frontend (Quest.jsx)
// ก็ import ด้วย ห้ามฮาร์ดโค้ดตัวเลข A/B/C/D/F ซ้ำที่นี่อีก (จะ sync มือสองที่แล้วเพี้ยนได้)
import { GRADE_BANDS } from '../../../src/lib/gradeBands.js';

export function nextStreak({ lastQuestDate, todayStr = bangkokDateStr() }) {
  if (!lastQuestDate) return 1;
  if (lastQuestDate === todayStr) return null; // ทำเควสอื่นซ้ำวันเดียวกันแล้ว ไม่นับ streak เพิ่ม
  if (lastQuestDate === prevDateStr(todayStr)) return 'increment';
  return 1; // ขาดไปอย่างน้อย 1 วัน — เริ่ม streak ใหม่
}

export function computeGrade(currentStreak) {
  const band = GRADE_BANDS.reduce((acc, b) => (currentStreak >= b.min ? b : acc), GRADE_BANDS[0]);
  return band.grade;
}
