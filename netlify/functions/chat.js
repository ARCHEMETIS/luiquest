// POST /.netlify/functions/chat — แชทโค้ช AI (flash-lite) จำกัด 10 ข้อความ/คน/วัน (ฟรี), ~100/วัน (premium) (#07)
// body: { message, quest_id? }
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';
import { startOfBangkokDayISO, nextBangkokMidnightISO } from './_shared/datetime.js';
import { generateText, CHAT_MODEL_CHAIN } from './_shared/gemini.js';

const FREE_DAILY_LIMIT = 10;
const PREMIUM_DAILY_LIMIT = 100; // soft cap กัน abuse โควต้า Gemini (#13 flag 17)
const MAX_MESSAGE_LEN = 2000;
const DEGRADED_REPLY = 'โค้ชไม่ว่างตอนนี้ ลองใหม่อีกครั้งได้เลยนะ 😅';

function buildSystemPrompt(questContext) {
  let ctx = '';
  if (questContext) {
    ctx = `\n\nบริบทเควสของผู้เรียนตอนนี้:
- หัวข้อ: ${questContext.topicTitle || '-'}
- ชื่อเควส: ${questContext.title || '-'}
- รายละเอียด: ${questContext.description || '-'}
- ขั้นตอนที่ต้องทำ: ${(questContext.checklistLabels || []).join('; ') || '-'}`;
  }
  return `คุณคือ "Quest Coach" โค้ชการเรียนรู้ที่อบอุ่น เป็นกันเอง ให้กำลังใจ อยู่ในแอปเรียนแบบเควสรายวัน "ลุยเควส" (LuiQuest)
ผู้เรียนอาจกำลังเรียนหัวข้อไหนก็ได้ (Python, สร้างเว็บ, ใช้ AI ให้เป็น, Excel, การเงินส่วนบุคคล, Data/ML หรือหัวข้อที่พิมพ์เองก็ได้) ไม่ใช่แค่หัวข้อเดียว
ตอบเป็นภาษาไทยเสมอ กระชับ เข้าใจง่าย ความยาวไม่เกินประมาณ 150 คำ
เน้นให้ "ใบ้/ตั้งคำถามกระตุ้นความคิด" มากกว่าเฉลยทั้งหมด ยกเว้นผู้เรียนขอเฉลยตรง ๆ
ใส่โค้ดตัวอย่างเฉพาะเมื่อจำเป็น และใส่ใน code block${ctx}`;
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const { user } = await requireUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const message = String(body.message || '').trim();
  const questId = body.quest_id || null;

  if (!message) return json(400, { error: 'ต้องมีข้อความ (message)' });
  if (message.length > MAX_MESSAGE_LEN) return json(400, { error: 'ข้อความยาวเกินไป' });

  const admin = getAdminClient();

  // ----- (ออปชัน) บริบทเควส — ต้องเป็นเควสของ user เองเท่านั้น (ผูกผ่าน roadmap ownership เหมือน complete-quest.js) -----
  let questContext = null;
  if (questId) {
    const { data: quest, error: questErr } = await admin
      .from('daily_quests')
      .select('id, roadmap_id, title, description, roadmaps!inner(user_id, topic_title)')
      .eq('id', questId)
      .maybeSingle();
    if (questErr) return json(500, { error: questErr.message });
    if (!quest || quest.roadmaps.user_id !== user.id) return json(404, { error: 'ไม่พบเควสนี้' });

    const { data: checklist } = await admin
      .from('quest_checklist_items')
      .select('label')
      .eq('quest_id', questId)
      .order('order_index', { ascending: true });

    questContext = {
      roadmapId: quest.roadmap_id,
      topicTitle: quest.roadmaps.topic_title,
      title: quest.title,
      description: quest.description,
      checklistLabels: (checklist ?? []).map((c) => c.label),
    };
  }

  // ----- เช็คลิมิต 10/วัน (ฟรี) หรือ ~100/วัน (premium) ก่อนเรียก Gemini เสมอ (#03/#13) -----
  const { count, error: countErr } = await admin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')
    .gte('created_at', startOfBangkokDayISO());
  if (countErr) return json(500, { error: countErr.message });

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('is_premium')
    .eq('id', user.id)
    .single();
  if (profileErr) return json(500, { error: profileErr.message });

  const limit = profile.is_premium ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const usedToday = count ?? 0;

  if (usedToday >= limit) {
    return json(200, { limited: true, remaining: 0, resetAt: nextBangkokMidnightISO() });
  }

  // ----- ประวัติแชท ~10 ข้อความล่าสุดของ user (ทุก roadmap) เป็นบริบท multi-turn -----
  const { data: historyRows, error: historyErr } = await admin
    .from('chat_messages')
    .select('role, message')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);
  if (historyErr) return json(500, { error: historyErr.message });
  const history = (historyRows ?? [])
    .slice()
    .reverse()
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.message }));

  let reply = null;
  let degraded = false;
  try {
    reply = await generateText({
      prompt: message,
      systemInstruction: buildSystemPrompt(questContext),
      chain: CHAT_MODEL_CHAIN,
      temperature: 0.7,
      history,
    });
  } catch (err) {
    if (!err?.exhausted) return json(500, { error: String(err.message || err) });
    degraded = true; // Gemini หมด chain ทั้งหมด — ใช้คำตอบ static แทน
  }

  // นับข้อความของ user เสมอแม้ Gemini ล่ม (โควต้ายังตรง) — คำตอบ static ไม่บันทึกเป็นแถว assistant จริง
  const { error: insertUserErr } = await admin.from('chat_messages').insert({
    user_id: user.id,
    roadmap_id: questContext?.roadmapId ?? null,
    quest_id: questId,
    role: 'user',
    message,
  });
  if (insertUserErr) return json(500, { error: insertUserErr.message });

  if (degraded) {
    return json(200, { reply: DEGRADED_REPLY, degraded: true });
  }

  const { error: insertAssistantErr } = await admin.from('chat_messages').insert({
    user_id: user.id,
    roadmap_id: questContext?.roadmapId ?? null,
    quest_id: questId,
    role: 'assistant',
    message: reply,
  });
  if (insertAssistantErr) return json(500, { error: insertAssistantErr.message });

  await admin.from('activity_log').insert({
    user_id: user.id,
    event_type: 'chat',
    metadata: { quest_id: questId },
  });

  return json(200, { reply, remaining: Math.max(0, limit - usedToday - 1) });
};
