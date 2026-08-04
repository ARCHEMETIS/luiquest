import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_CHECKLIST_ERROR, validateChecklist } from './complete-quest.js';

test('rejects an empty checklist instead of treating it as complete', () => {
  const result = validateChecklist([], new Set());

  assert.equal(result.ok, false);
  assert.equal(result.error, EMPTY_CHECKLIST_ERROR);
});

test('requires every checklist item to be checked', () => {
  assert.equal(validateChecklist(['one', 'two'], new Set(['one'])).ok, false);
  assert.equal(validateChecklist(['one', 'two'], new Set(['one', 'two'])).ok, true);
});
