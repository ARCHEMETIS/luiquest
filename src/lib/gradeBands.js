// Single source of truth: letter-grade thresholds (streak -> grade)
// ใช้ร่วมกันทั้งฝั่ง frontend (src/pages/Quest.jsx) และ backend
// (netlify/functions/_shared/gameplay.js -> computeGrade) แก้ threshold ที่นี่ที่เดียว
// ไม่ต้อง sync มือ 2 ที่อีกต่อไป — ไฟล์นี้เป็น plain values-only module ที่ทั้ง Vite (frontend)
// และ esbuild (Netlify function bundler) import ข้าม runtime ได้ตรง ๆ เพราะเป็นแค่ JS ธรรมดา
export const GRADE_BANDS = [
  { grade: 'F', min: 0 },
  { grade: 'D', min: 1 },
  { grade: 'C', min: 3 },
  { grade: 'B', min: 7 },
  { grade: 'A', min: 14 },
];

export const GRADE_ORDER = GRADE_BANDS.map((b) => b.grade);
