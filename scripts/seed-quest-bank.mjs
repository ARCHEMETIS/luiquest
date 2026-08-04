// Seed authored quests for days 2-7 of the six curated LuiQuest topics.
// Run: node --env-file=.env scripts/seed-quest-bank.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { QUEST_BANK_beginner } from './quest-bank-beginner.mjs';
import { QUEST_BANK_intermediate } from './quest-bank-intermediate.mjs';
import { QUEST_BANK_advanced } from './quest-bank-advanced.mjs';

const QUEST_BANK = [
  ...QUEST_BANK_beginner,
  ...QUEST_BANK_intermediate,
  ...QUEST_BANK_advanced,
];

const KNOWN_TOPIC_SLUGS = new Set(['python', 'data-ml', 'web', 'ai-tools', 'excel', 'finance']);
const VALID_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const SOURCE_LIST_PATH = new URL('../.scratch/app-v2-spec/assets/thai-lesson-sources.md', import.meta.url);
const XP_REWARD = 10;

function rowError(index, message) {
  return new Error(`quest-bank row ${index + 1}: ${message}`);
}

export function validateQuestBank(quests, sourceText = readFileSync(SOURCE_LIST_PATH, 'utf8')) {
  if (!Array.isArray(quests)) throw new Error('quest bank must be an array');

  quests.forEach((quest, index) => {
    if (!quest || typeof quest !== 'object') throw rowError(index, 'must be an object');
    if (!KNOWN_TOPIC_SLUGS.has(quest.topicSlug)) {
      throw rowError(index, `unknown topicSlug "${quest.topicSlug}"`);
    }
    if (!VALID_LEVELS.has(quest.level)) {
      throw rowError(index, `invalid level "${quest.level}"`);
    }
    if (!Number.isInteger(quest.dayNumber) || quest.dayNumber < 2 || quest.dayNumber > 7) {
      throw rowError(index, `dayNumber must be an integer from 2 to 7, got ${quest.dayNumber}`);
    }
    if (typeof quest.title !== 'string' || !quest.title.trim()) throw rowError(index, 'title is required');
    if (typeof quest.description !== 'string' || !quest.description.trim()) {
      throw rowError(index, 'description is required');
    }
    if (!quest.content || typeof quest.content !== 'object') throw rowError(index, 'content is required');
    if (!Array.isArray(quest.content.objectives)) throw rowError(index, 'content.objectives must be an array');
    if (!Array.isArray(quest.checklist) || quest.checklist.length < 2 || quest.checklist.length > 4) {
      throw rowError(index, 'checklist must contain 2 to 4 items');
    }

    quest.checklist.forEach((item, itemIndex) => {
      if (!item || typeof item !== 'object') throw rowError(index, `checklist item ${itemIndex + 1} must be an object`);
      if (item.order_index !== itemIndex + 1) {
        throw rowError(index, `checklist order_index must be contiguous from 1; item ${itemIndex + 1} is ${item.order_index}`);
      }
      if (typeof item.label !== 'string' || !item.label.trim()) {
        throw rowError(index, `checklist item ${itemIndex + 1} label is required`);
      }
      if (item.link_url !== null && typeof item.link_url !== 'string') {
        throw rowError(index, `checklist item ${itemIndex + 1} link_url must be a string or null`);
      }
      if (item.link_url !== null && !sourceText.includes(item.link_url)) {
        throw rowError(index, `checklist item ${itemIndex + 1} link_url is not in thai-lesson-sources.md: ${item.link_url}`);
      }
    });
  });

  return true;
}

async function main() {
  validateQuestBank(QUEST_BANK);

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('ต้องตั้ง SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อนรัน (node --env-file=.env ...)');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: topics, error: topicsErr } = await supabase
    .from('topics')
    .select('id, slug');
  if (topicsErr) throw topicsErr;

  const topicIdBySlug = new Map(topics.map((topic) => [topic.slug, topic.id]));
  const missingSlugs = [...new Set(QUEST_BANK.map((quest) => quest.topicSlug))].filter(
    (slug) => !topicIdBySlug.has(slug)
  );
  if (missingSlugs.length) {
    throw new Error(`ไม่พบ topic ใน DB: ${missingSlugs.join(', ')} — รัน schema.sql seed topics ก่อน`);
  }

  const rows = QUEST_BANK.map((quest) => ({
    topic_id: topicIdBySlug.get(quest.topicSlug),
    level: quest.level,
    day_number: quest.dayNumber,
    title: quest.title,
    description: quest.description,
    content: quest.content,
    checklist: quest.checklist,
    xp_reward: XP_REWARD,
  }));

  const { data, error } = await supabase
    .from('starter_quests')
    .upsert(rows, { onConflict: 'topic_id,level,day_number' })
    .select('id, topic_id, level, day_number, title');
  if (error) throw error;

  console.log(`อัปเสิร์ต starter_quests สำเร็จ ${data.length} แถว`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error('seed ล้มเหลว:', error.message || error);
    process.exit(1);
  });
}
