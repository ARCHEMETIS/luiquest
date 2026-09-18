// เทสตรรกะ "วันไหนแน่นเกินไป" ของปฏิทินแผนสอบ
// เคสสำคัญมาจากผลรีวิวโค้ด 18 ก.ย. 2026: เกณฑ์ต้องอิงเวลาที่ผู้ใช้ตั้งเอง ไม่ใช่เลขตายตัว
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCalendarIndex, cellLoad, heavyDaysFrom } from './calendarLoad.js';

// ตัวแตกรายการเหมือนที่ component ใช้จริง (topic_indexes/topic_minutes เดินคู่กัน)
const allocationsOf = (plan, item) =>
  (item.topic_indexes || []).map((topicIndex, i) => ({
    topicIndex,
    topic: plan.topics?.[topicIndex - 1] ?? `หัวข้อ ${topicIndex}`,
    minutes: Number(item.topic_minutes?.[i]) || 0,
  }));

function plan({ id, minutesPerDay, examDate, items }) {
  return {
    id,
    title: id,
    minutes_per_day: minutesPerDay,
    exam_date: examDate,
    topics: ['ก', 'ข', 'ค', 'ง'],
    items: items.map((it, n) => ({
      id: `${id}-${n}`,
      scheduled_date: it.date,
      status: it.status ?? 'scheduled',
      kind: it.kind ?? 'first_pass',
      topic_indexes: it.topics ?? [1],
      topic_minutes: it.minutes,
    })),
  };
}

test('วันที่ใช้เวลาพอดีกับที่ตั้งไว้ ไม่ถือว่าแน่น (เคสที่เกณฑ์ตายตัวเดิมเตือนผิด)', () => {
  // สามวิชา 30+60+30 = 120 นาที เท่ากับเพดานรวมเป๊ะ — เกณฑ์เดิม 120 นาทีจะฟ้องทั้งที่ยังไม่เกิน
  const index = buildCalendarIndex([
    plan({ id: 'db', minutesPerDay: 30, examDate: '2026-09-24', items: [{ date: '2026-09-18', minutes: [30] }] }),
    plan({ id: 'stat', minutesPerDay: 60, examDate: '2026-09-28', items: [{ date: '2026-09-18', minutes: [60] }] }),
    plan({ id: 'calc', minutesPerDay: 30, examDate: '2026-09-30', items: [{ date: '2026-09-18', minutes: [30] }] }),
  ], allocationsOf);

  const cell = index.get('2026-09-18');
  assert.equal(cell.minutes, 120);
  assert.equal(cell.capacity, 120);
  assert.equal(cellLoad(cell), 'ok');
});

test('คนตั้งวันละ 30 นาที 3 วิชา รวม 90 = พอดี แต่ 100 = เกินตัวแล้ว', () => {
  const build = (lastMinutes) => buildCalendarIndex([
    plan({ id: 'a', minutesPerDay: 30, examDate: '2026-10-01', items: [{ date: '2026-09-20', minutes: [30] }] }),
    plan({ id: 'b', minutesPerDay: 30, examDate: '2026-10-01', items: [{ date: '2026-09-20', minutes: [30] }] }),
    plan({ id: 'c', minutesPerDay: 30, examDate: '2026-10-01', items: [{ date: '2026-09-20', minutes: [lastMinutes] }] }),
  ], allocationsOf);

  assert.equal(cellLoad(build(30).get('2026-09-20')), 'ok', '90/90 ต้องไม่เตือน');
  // เกณฑ์ตายตัว 120 นาทีจะปล่อยผ่านเคสนี้ ทั้งที่เกินที่เจ้าตัวบอกว่าไหว
  assert.equal(cellLoad(build(40).get('2026-09-20')), 'heavy', '100/90 ต้องเตือน');
});

test('คนตั้งวันละ 150 นาที อ่าน 150 ต้องไม่โดนเตือน (เกณฑ์เดิมฟ้องทุกวัน)', () => {
  const index = buildCalendarIndex([
    plan({ id: 'big', minutesPerDay: 150, examDate: '2026-10-05', items: [{ date: '2026-09-21', minutes: [150] }] }),
  ], allocationsOf);
  assert.equal(cellLoad(index.get('2026-09-21')), 'ok');
});

test('เกินเพดานเกินครึ่ง = overloaded', () => {
  const index = buildCalendarIndex([
    plan({ id: 'a', minutesPerDay: 60, examDate: '2026-10-01', items: [{ date: '2026-09-22', minutes: [100] }] }),
  ], allocationsOf);
  const cell = index.get('2026-09-22');
  assert.equal(cell.minutes, 100);
  assert.equal(cell.capacity, 60);
  assert.equal(cellLoad(cell), 'overloaded'); // 100 > 60*1.5
});

test('วิชาเดียวลงสองรายการในวันเดียว เพดานไม่คูณสอง', () => {
  // ย้ายวันมาซ้อนกันเองในวิชาเดียว ⇒ ภาระเพิ่มแต่ความไหวของคนเท่าเดิม
  const index = buildCalendarIndex([
    plan({ id: 'a', minutesPerDay: 30, examDate: '2026-10-01', items: [
      { date: '2026-09-23', minutes: [30] },
      { date: '2026-09-23', minutes: [30] },
    ] }),
  ], allocationsOf);
  const cell = index.get('2026-09-23');
  assert.equal(cell.capacity, 30, 'เพดานต้องนับวิชาละครั้ง');
  assert.equal(cell.minutes, 60);
  assert.equal(cellLoad(cell), 'overloaded');
});

test('รายการที่ทำแล้ว/ข้ามแล้วไม่นับเป็นภาระค้าง', () => {
  const index = buildCalendarIndex([
    plan({ id: 'a', minutesPerDay: 30, examDate: '2026-10-01', items: [
      { date: '2026-09-19', minutes: [90], status: 'completed' },
      { date: '2026-09-19', minutes: [80], status: 'skipped' },
    ] }),
  ], allocationsOf);
  const cell = index.get('2026-09-19');
  assert.equal(cell.minutes, 0);
  assert.equal(cell.capacity, 0);
  assert.equal(cellLoad(cell), 'none', 'วันที่ผ่านไปแล้วต้องไม่ค้างสีแดง');
  assert.equal(cell.study.length, 2, 'แต่ยังต้องโชว์ในแผงรายละเอียดอยู่');
});

test('วันสอบถูกทำดัชนีแยกจากวันอ่าน และซ้อนกับวันแน่นได้', () => {
  const index = buildCalendarIndex([
    plan({ id: 'stat', minutesPerDay: 60, examDate: '2026-09-28', items: [] }),
    plan({ id: 'calc', minutesPerDay: 60, examDate: '2026-10-02', items: [{ date: '2026-09-28', minutes: [200] }] }),
  ], allocationsOf);

  const examDay = index.get('2026-09-28');
  assert.equal(examDay.exams.length, 1, 'ต้องรู้ว่าวันนี้มีสอบ');
  assert.equal(examDay.minutes, 200);
  // เคสที่แย่ที่สุดที่แท็บนี้มีไว้จับ: สอบวิชาหนึ่ง + ต้องอ่านอีกวิชาหนักมากในวันเดียวกัน
  assert.equal(cellLoad(examDay), 'overloaded');
});

test('heavyDaysFrom นับเฉพาะวันที่ยังมาไม่ถึง', () => {
  const index = buildCalendarIndex([
    plan({ id: 'a', minutesPerDay: 30, examDate: '2026-10-01', items: [
      { date: '2026-09-10', minutes: [120] }, // อดีต
      { date: '2026-09-25', minutes: [120] }, // อนาคต
    ] }),
  ], allocationsOf);

  const heavy = heavyDaysFrom(index, '2026-09-18');
  assert.equal(heavy.length, 1);
  assert.equal(heavy[0][0], '2026-09-25');
});

test('วันว่างและวันที่ไม่มีเพดาน ไม่ถูกจัดเป็นแน่น', () => {
  assert.equal(cellLoad(undefined), 'none');
  assert.equal(cellLoad({ minutes: 0, capacity: 0 }), 'none');
  assert.equal(cellLoad({ minutes: 50, capacity: 0 }), 'none');
});

test('วันที่รูปแบบเพี้ยนถูกข้าม ไม่ทำให้ทั้งปฏิทินพัง', () => {
  const index = buildCalendarIndex([
    plan({ id: 'a', minutesPerDay: 30, examDate: 'ไม่ใช่วันที่', items: [
      { date: '25/09/2026', minutes: [30] },
      { date: '2026-09-25', minutes: [30] },
    ] }),
  ], allocationsOf);
  assert.deepEqual([...index.keys()], ['2026-09-25']);
});
