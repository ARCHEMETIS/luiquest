import assert from 'node:assert/strict';
import test from 'node:test';
import { QUEST_BANK_beginner } from './quest-bank-beginner.mjs';
import { validateQuestBank } from './seed-quest-bank.mjs';

const validQuest = structuredClone(QUEST_BANK_beginner[0]);

test('rejects an unknown topic slug', () => {
  const quest = structuredClone(validQuest);
  quest.topicSlug = 'not-a-curated-topic';
  assert.throws(() => validateQuestBank([quest]), /unknown topicSlug/);
});

test('rejects non-contiguous checklist order indexes', () => {
  const quest = structuredClone(validQuest);
  quest.checklist[1].order_index = 3;
  assert.throws(() => validateQuestBank([quest]), /order_index must be contiguous/);
});

test('rejects a checklist with five items', () => {
  const quest = structuredClone(validQuest);
  quest.checklist.push({ order_index: 5, label: 'เกินจำนวนที่กำหนด', link_url: null });
  assert.throws(() => validateQuestBank([quest]), /checklist must contain 2 to 4 items/);
});

test('accepts day 14 and rejects day 15 (คลังขยายถึงสัปดาห์ที่ 2)', () => {
  const ok = structuredClone(validQuest);
  ok.dayNumber = 14;
  assert.equal(validateQuestBank([ok]), true);

  const tooFar = structuredClone(validQuest);
  tooFar.dayNumber = 15;
  assert.throws(() => validateQuestBank([tooFar]), /dayNumber must be an integer from 2 to 14/);
});

test('rejects a link absent from the vetted source list', () => {
  const quest = structuredClone(validQuest);
  quest.checklist[0].link_url = 'https://example.com/unvetted';
  assert.throws(() => validateQuestBank([quest]), /not in thai-lesson-sources\.md/);
});
