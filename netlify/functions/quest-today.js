// GET /.netlify/functions/quest-today?roadmap_id=... — เควสปัจจุบันของ roadmap (#06)
// "เควสวันนี้" = daily_quest ที่ day_number น้อยที่สุดใน roadmap ที่ยังไม่มีแถวใน quest_completions
// (โมเดล carry-over: ถ้าทำไม่ทันวันก่อน เควสเดิมค้างรออยู่ ไม่ใช่ตายตัวตามปฏิทิน)
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method Not Allowed' });

  const { user } = await requireUser(req);
  if (!user) return unauthorized();

  const admin = getAdminClient();
  const url = new URL(req.url);
  const roadmapId = url.searchParams.get('roadmap_id');

  const baseSelect = admin
    .from('roadmaps')
    .select('id, topic_id, topic_title, level, minutes_per_day, is_active, status')
    .eq('user_id', user.id);
  const roadmapQuery = roadmapId
    ? baseSelect.eq('id', roadmapId)
    : baseSelect.eq('is_active', true).order('created_at', { ascending: true }).limit(1);

  const { data: roadmaps, error: roadmapErr } = await roadmapQuery;
  if (roadmapErr) return json(500, { error: roadmapErr.message });
  const roadmap = roadmaps?.[0];
  if (!roadmap) return json(200, { status: 'no_roadmap', roadmap: null, quest: null });

  const { data: completedIds, error: completedErr } = await admin
    .from('quest_completions')
    .select('quest_id')
    .eq('user_id', user.id)
    .eq('roadmap_id', roadmap.id);
  if (completedErr) return json(500, { error: completedErr.message });
  const doneIds = new Set((completedIds ?? []).map((r) => r.quest_id));

  const { data: quests, error: questsErr } = await admin
    .from('daily_quests')
    .select('id, phase_id, day_number, title, description, content, xp_reward')
    .eq('roadmap_id', roadmap.id)
    .order('day_number', { ascending: true });
  if (questsErr) return json(500, { error: questsErr.message });

  const quest = (quests ?? []).find((q) => !doneIds.has(q.id));
  if (!quest) {
    return json(200, {
      status: 'not_ready',
      roadmap,
      quest: null,
      message: 'กำลังเตรียมเควสถัดไป ลองรีเฟรชอีกครั้งเร็ว ๆ นี้',
    });
  }

  const { data: checklist, error: checklistErr } = await admin
    .from('quest_checklist_items')
    .select('id, order_index, label, link_url')
    .eq('quest_id', quest.id)
    .order('order_index', { ascending: true });
  if (checklistErr) return json(500, { error: checklistErr.message });

  let phase = null;
  if (quest.phase_id) {
    const { data: phaseRow } = await admin
      .from('phases')
      .select('phase_number, title, description')
      .eq('id', quest.phase_id)
      .maybeSingle();
    phase = phaseRow ?? null;
  }

  return json(200, {
    status: 'ready',
    roadmap,
    quest,
    checklist: checklist ?? [],
    phase,
    completedCount: doneIds.size,
  });
};
