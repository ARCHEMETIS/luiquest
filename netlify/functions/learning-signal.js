// POST /.netlify/functions/learning-signal — บันทึกผลการวัดของเควส (pilot "อ่าน + โจทย์")
// body: { quest_id, event: 'pre'|'post'|'reveal'|'rating', correct?, difficulty?, time_fit? }
//
// ทำไมต้องผ่าน function ไม่ให้ browser เขียน Supabase ตรง ๆ:
//   ค่า "ตอบถูกครั้งแรก" ต้องเขียนได้ครั้งเดียวจริง ๆ ถ้าเปิด policy ให้ client upsert เอง
//   ผู้ใช้รีเฟรชแล้วตอบใหม่จะทับของเดิมได้ = ตัวเลขที่เอาไปนำเสนอเชื่อไม่ได้
//   ที่นี่ยังได้ยืนยันด้วยว่าเควสนั้นเป็นของผู้ใช้จริง (แพตเทิร์นเดียวกับ complete-quest.js)
//
// ★ ห้ามให้ endpoint นี้มีผลต่อ XP/streak/leaderboard เด็ดขาด — เป็น telemetry ล้วน
//   และฝั่ง UI ต้องยิงแบบ best-effort ล้มเหลวแล้วห้ามบล็อกการเคลม XP
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';
import { topicKeyOf } from './_shared/topicKey.js';

const VALID_EVENTS = new Set(['pre', 'post', 'reveal', 'rating']);
const VALID_DIFFICULTY = new Set(['too_easy', 'right', 'too_hard']);
const VALID_TIME_FIT = new Set(['within_budget', 'over_budget']);

// ชุดโจทย์เวอร์ชันไหน — เปลี่ยนค่านี้เมื่อแก้เนื้อโจทย์ เพื่อไม่ให้ผลก่อน/หลังแก้ปนกันตอนสรุป
const EXERCISE_VERSION = '2026-08-05-pilot-1';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const { user } = await requireUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const questId = body.quest_id;
  const event = body.event;

  if (!questId) return json(400, { error: 'ต้องระบุ quest_id' });
  if (!VALID_EVENTS.has(event)) return json(400, { error: 'event ไม่ถูกต้อง' });

  const correct = typeof body.correct === 'boolean' ? body.correct : null;
  const difficulty = VALID_DIFFICULTY.has(body.difficulty) ? body.difficulty : null;
  const timeFit = VALID_TIME_FIT.has(body.time_fit) ? body.time_fit : null;

  const admin = getAdminClient();

  // เควสต้องเป็นของผู้ใช้คนนี้จริง — เช็คผ่าน roadmap ownership เหมือน complete-quest.js
  // ดึง topic/level/day มาเก็บเป็น snapshot ด้วย เพราะแถวสัญญาณต้องอยู่รอดแม้เควสถูกลบ
  const { data: quest, error: questErr } = await admin
    .from('daily_quests')
    .select('id, day_number, roadmaps!inner(user_id, level, topic_title, topics(slug))')
    .eq('id', questId)
    .maybeSingle();
  if (questErr) return json(500, { error: questErr.message });
  if (!quest || quest.roadmaps.user_id !== user.id) return json(404, { error: 'ไม่พบเควสนี้' });

  const { data: result, error: rpcErr } = await admin.rpc('record_learning_signal', {
    p_user_id: user.id,
    p_quest_id: questId,
    p_topic_key: topicKeyOf(quest.roadmaps),
    p_level: quest.roadmaps.level,
    p_day_number: quest.day_number,
    p_exercise_version: EXERCISE_VERSION,
    p_event: event,
    p_correct: correct,
    p_difficulty: difficulty,
    p_time_fit: timeFit,
  });
  if (rpcErr) return json(500, { error: rpcErr.message });

  return json(200, result ?? {});
};
