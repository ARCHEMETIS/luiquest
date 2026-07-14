// กติกาเกม: คำนวณ streak ใหม่ตอนทำเควสเสร็จ + letter grade จาก streak ปัจจุบัน
// เป็น source of truth เดียวที่ complete-quest.js เรียกใช้ (ห้ามคำนวณซ้ำที่อื่น)
import { bangkokDateStr, prevDateStr } from './datetime.js';

export function nextStreak({ lastQuestDate, todayStr = bangkokDateStr() }) {
  if (!lastQuestDate) return 1;
  if (lastQuestDate === todayStr) return null; // ทำเควสอื่นซ้ำวันเดียวกันแล้ว ไม่นับ streak เพิ่ม
  if (lastQuestDate === prevDateStr(todayStr)) return 'increment';
  return 1; // ขาดไปอย่างน้อย 1 วัน — เริ่ม streak ใหม่
}

export function computeGrade(currentStreak) {
  if (currentStreak >= 14) return 'A';
  if (currentStreak >= 7) return 'B';
  if (currentStreak >= 3) return 'C';
  if (currentStreak >= 1) return 'D';
  return 'F';
}
