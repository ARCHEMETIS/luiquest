// เทสลำดับความสำคัญของสิ่งที่มาสคอตพูด
// ★ สิ่งที่ต้องกันไว้: ประโยคชวนติดตั้งแอพต้องไม่ไปแย่งที่ของเรื่องการเรียนเด็ดขาด
//   ถ้าวันไหนมีคนย้ายบล็อก canInstall ขึ้นไปข้างบน เทสชุดนี้ต้องแดง
import assert from 'node:assert/strict';
import test from 'node:test';
import { pickMascotMessage } from './mascotChatter.js';

const MORNING = new Date('2026-08-05T02:00:00Z'); // 09:00 เวลาไทย — ก่อนเวลาที่จะทวงเควส
// 260 XP = ไม่ใกล้เลเวลถัดไป ไม่ใกล้แรงค์ถัดไป → ปกติมาสคอตจะเงียบ
const QUIET_PROFILE = { last_quest_date: null, current_streak: 0, total_xp: 260 };

test('ไม่มีเรื่องเรียนจะพูด และติดตั้งไม่ได้ = เงียบ', () => {
  assert.equal(pickMascotMessage({ profile: QUIET_PROFILE, now: MORNING }), null);
});

test('ไม่มีเรื่องเรียนจะพูด แต่ติดตั้งได้ = ชวนติดตั้ง', () => {
  const msg = pickMascotMessage({ profile: QUIET_PROFILE, now: MORNING, canInstall: true });
  assert.equal(msg.id, 'install-nudge');
  assert.equal(msg.action, 'install'); // NavMascot ใช้ค่านี้ทำให้ฟองคำพูดกดได้
});

test('★ มีเรื่องเรียนจะพูด ต้องชนะการชวนติดตั้งเสมอ', () => {
  const doneToday = { last_quest_date: '2026-08-05', current_streak: 7, total_xp: 260 };
  const msg = pickMascotMessage({ profile: doneToday, now: MORNING, canInstall: true });
  assert.equal(msg.id, 'streak-7');

  const nearLevel = { last_quest_date: null, current_streak: 0, total_xp: 220 };
  assert.equal(pickMascotMessage({ profile: nearLevel, now: MORNING, canInstall: true }).id, 'near-level-7');

  const nearRank = { last_quest_date: null, current_streak: 0, total_xp: 300 };
  assert.equal(pickMascotMessage({ profile: nearRank, now: MORNING, canInstall: true }).id, 'near-rank-A');
});

test('ไม่มี profile = ไม่พูดอะไรเลย แม้ติดตั้งได้', () => {
  assert.equal(pickMascotMessage({ profile: null, canInstall: true }), null);
});
