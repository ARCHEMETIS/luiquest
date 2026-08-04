import assert from 'node:assert/strict';
import test from 'node:test';
import { orderEligibleRoadmaps } from './pre-generate-quests.js';

test('orders eligible roadmaps by least-recently-generated first', () => {
  const rows = [
    { id: 'new', last_generated_at: '2026-08-04T02:10:00Z', created_at: '2026-08-01T00:00:00Z' },
    { id: 'old', last_generated_at: '2026-08-04T01:10:00Z', created_at: '2026-08-03T00:00:00Z' },
    { id: 'middle', last_generated_at: '2026-08-04T01:40:00Z', created_at: '2026-08-01T00:00:00Z' },
  ];

  assert.deepEqual(orderEligibleRoadmaps(rows).map((row) => row.id), ['old', 'middle', 'new']);
});

test('uses roadmap creation time and id as deterministic tie-breakers', () => {
  const rows = [
    { id: 'b', last_generated_at: '2026-08-04T01:00:00Z', created_at: '2026-08-03T00:00:00Z' },
    { id: 'a', last_generated_at: '2026-08-04T01:00:00Z', created_at: '2026-08-03T00:00:00Z' },
  ];

  assert.deepEqual(orderEligibleRoadmaps(rows).map((row) => row.id), ['a', 'b']);
});
