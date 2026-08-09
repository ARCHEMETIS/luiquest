import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExamSchedule } from './examSchedule.js';

function totalFor(items, kind, topicIndex) {
  return items
    .filter((item) => item.kind === kind)
    .flatMap((item) => item.allocations)
    .filter((allocation) => allocation.topicIndex === topicIndex)
    .reduce((sum, allocation) => sum + allocation.minutes, 0);
}

test('one-day plan uses the only study day for first pass and has no review', () => {
  const result = buildExamSchedule({
    topics: ['พีชคณิต'],
    today: '2026-08-09',
    examDate: '2026-08-10',
    minutesPerDay: 30,
  });

  assert.equal(result.reviewDayCount, 0);
  assert.equal(result.fitStatus, 'fits');
  assert.deepEqual(result.items, [{
    scheduledDate: '2026-08-09',
    kind: 'first_pass',
    allocations: [{ topicIndex: 1, topic: 'พีชคณิต', minutes: 30 }],
    plannedMinutes: 30,
  }]);
});

test('reserves the rounded-up final fifth of study days for review', () => {
  const result = buildExamSchedule({
    topics: ['A', 'B'],
    today: '2026-08-01',
    examDate: '2026-08-11',
    minutesPerDay: 60,
  });

  assert.equal(result.reviewDayCount, 2);
  assert.deepEqual(
    result.items.filter((item) => item.kind === 'review').map((item) => item.scheduledDate),
    ['2026-08-10'],
  );
  assert.ok(result.items.filter((item) => item.kind === 'first_pass')
    .every((item) => item.scheduledDate < '2026-08-09'));
});

test('splits one topic across dates without losing minutes', () => {
  const result = buildExamSchedule({
    topics: ['บทใหญ่'],
    today: '2026-08-01',
    examDate: '2026-08-04',
    minutesPerDay: 15,
  });

  const firstPass = result.items.filter((item) => item.kind === 'first_pass');
  assert.deepEqual(firstPass.map((item) => item.scheduledDate), ['2026-08-01', '2026-08-02']);
  assert.deepEqual(firstPass.map((item) => item.allocations[0].minutes), [15, 15]);
  assert.equal(totalFor(result.items, 'first_pass', 1), 30);
});

test('spreads sessions evenly across each phase', () => {
  const result = buildExamSchedule({
    topics: ['A', 'B', 'C', 'D'],
    today: '2026-08-01',
    examDate: '2026-08-11',
    minutesPerDay: 30,
  });

  assert.deepEqual(
    result.items.filter((item) => item.kind === 'first_pass').map((item) => item.scheduledDate),
    ['2026-08-01', '2026-08-03', '2026-08-06', '2026-08-08'],
  );
  assert.deepEqual(
    result.items.filter((item) => item.kind === 'review').map((item) => item.scheduledDate),
    ['2026-08-09', '2026-08-10'],
  );
});

test('preserves duplicate Thai topic names as separate ordered syllabus units', () => {
  const result = buildExamSchedule({
    topics: ['  สมการ  ', '', 'สมการ'],
    today: '2026-08-01',
    examDate: '2026-08-05',
    minutesPerDay: 60,
  });

  assert.deepEqual(result.topics, ['สมการ', 'สมการ']);
  assert.deepEqual(
    result.items[0].allocations.map(({ topicIndex, topic }) => ({ topicIndex, topic })),
    [
      { topicIndex: 1, topic: 'สมการ' },
      { topicIndex: 2, topic: 'สมการ' },
    ],
  );
});

test('reports overload explicitly and keeps the selected and required capacity separate', () => {
  const result = buildExamSchedule({
    topics: ['A', 'B', 'C', 'D', 'E'],
    today: '2026-08-01',
    examDate: '2026-08-06',
    minutesPerDay: 30,
  });

  assert.equal(result.fitStatus, 'overloaded');
  assert.equal(result.overloaded, true);
  assert.equal(result.selectedMinutesPerDay, 30);
  assert.equal(result.requiredMinutesPerDay, 50);
  assert.equal(result.firstPassRequired, 150);
  assert.equal(result.reviewRequired, 50);
  assert.ok(result.items.some((item) => item.plannedMinutes > result.selectedMinutesPerDay));
});

test('every phase allocation sums to its full per-topic estimate', () => {
  for (const input of [
    { topics: ['A', 'B', 'C'], today: '2026-08-01', examDate: '2026-08-12', minutesPerDay: 45 },
    { topics: ['A', 'B', 'C', 'D', 'E'], today: '2026-08-01', examDate: '2026-08-06', minutesPerDay: 30 },
  ]) {
    const result = buildExamSchedule(input);

    result.topics.forEach((_topic, index) => {
      assert.equal(totalFor(result.items, 'first_pass', index + 1), 30);
      assert.equal(totalFor(result.items, 'review', index + 1), 10);
    });

    for (const item of result.items) {
      assert.equal(
        item.allocations.reduce((sum, allocation) => sum + allocation.minutes, 0),
        item.plannedMinutes,
      );
    }
  }
});
