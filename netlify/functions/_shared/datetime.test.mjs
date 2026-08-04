import assert from 'node:assert/strict';
import test from 'node:test';
import { learningDayStr, nextLearningDayStr } from './datetime.js';

test('learning day stays on the previous Bangkok date from 00:00 through 04:59', () => {
  assert.equal(learningDayStr(new Date('2026-08-04T00:00:00+07:00')), '2026-08-03');
  assert.equal(learningDayStr(new Date('2026-08-04T04:59:59+07:00')), '2026-08-03');
});

test('learning day changes at exactly 05:00 Bangkok time', () => {
  assert.equal(learningDayStr(new Date('2026-08-04T05:00:00+07:00')), '2026-08-04');
  assert.equal(nextLearningDayStr(new Date('2026-08-04T04:59:59+07:00')), '2026-08-04');
});
