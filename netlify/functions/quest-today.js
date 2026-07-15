// GET /.netlify/functions/quest-today?roadmap_id=... — เควสปัจจุบันของ roadmap (#06)
// "เควสวันนี้" = daily_quest ที่ day_number น้อยที่สุดใน roadmap ที่ยังไม่มีแถวใน quest_completions
// (โมเดล carry-over: ถ้าทำไม่ทันวันก่อน เควสเดิมค้างรออยู่ ไม่ใช่ตายตัวตามปฏิทิน)
// ถ้าเควสหมด (ทำจบทุกวัน) และวันล่าสุดที่จบไม่ใช่วันนี้ → generate เควสวันถัดไป on-demand ทันที
// (roadmap ที่ถูกพักไว้ไม่เข้า cron รายคืน — ไม่มีทางนี้ผู้ใช้ที่สลับหัวข้อกลับมาจะค้างไร้เควสทั้งวัน)
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';
import { generateNextQuest } from './_shared/questGenerator.js';
import { bangkokDateStr } from './_shared/datetime.js';

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method Not Allowed' });

  const { user } = await requireUser(req);
  if (!user) return unauthorized();

  const admin = getAdminClient();
  const url = new URL(req.url);
  const roadmapId = url.searchParams.get('roadmap_id');

  const baseSelect = admin
    .from('roadmaps')
    .select('id, topic_id, topic_title, level, minutes_per_day, is_active, status, content')
    .eq('user_id', user.id);
  const roadmapQuery = roadmapId
    ? baseSelect.eq('id', roadmapId)
    : baseSelect.eq('is_active', true).order('created_at', { ascending: true }).limit(1);

  const { data: roadmaps, error: roadmapErr } = await roadmapQuery;
  if (roadmapErr) return json(500, { error: roadmapErr.message });
  const roadmap = roadmaps?.[0];
  if (!roadmap) return json(200, { status: 'no_roadmap', roadmap: null, quest: null });

  const { data: completedRows, error: completedErr } = await admin
    .from('quest_completions')
    .select('quest_id, completed_at')
    .eq('user_id', user.id)
    .eq('roadmap_id', roadmap.id);
  if (completedErr) return json(500, { error: completedErr.message });
  const doneIds = new Set((completedRows ?? []).map((r) => r.quest_id));

  const { data: quests, error: questsErr } = await admin
    .from('daily_quests')
    .select('id, phase_id, day_number, title, description, content, xp_reward')
    .eq('roadmap_id', roadmap.id)
    .order('day_number', { ascending: true });
  if (questsErr) return json(500, { error: questsErr.message });

  let quest = (quests ?? []).find((q) => !doneIds.has(q.id));
  let generatedNow = null;

  if (!quest) {
    // เควสทุกวันทำจบหมดแล้ว — ตัดสินใจว่า "จบของวันนี้แล้ว" หรือ "ค้างไร้เควส ต้อง generate เดี๋ยวนี้"
    const questList = quests ?? [];
    const latestQuest = questList[questList.length - 1] ?? null;
    const latestDone = latestQuest
      ? (completedRows ?? []).find((r) => r.quest_id === latestQuest.id)
      : null;
    const doneToday =
      latestDone?.completed_at && bangkokDateStr(new Date(latestDone.completed_at)) === bangkokDateStr();

    if (doneToday || !latestQuest || roadmap.status !== 'ready') {
      // จบเควสวันนี้ไปแล้ว = เจตนา 1 เควส/วัน ไม่ generate ล่วงหน้าให้ binge — cron รายคืนเตรียมของพรุ่งนี้เอง
      return json(200, {
        status: 'not_ready',
        roadmap,
        quest: null,
        message: doneToday
          ? 'เควสวันนี้จบแล้ว เก่งมาก! พรุ่งนี้เช้ามีเควสใหม่รอ'
          : 'กำลังเตรียมเควสถัดไป ลองรีเฟรชอีกครั้งเร็ว ๆ นี้',
      });
    }

    // ผู้ใช้ควรมีเควสวันนี้แต่ยังไม่ถูกสร้าง (เช่นเพิ่งสลับหัวข้อกลับมา — roadmap ที่พักอยู่ไม่เข้า cron)
    // generate on-demand เลย: idempotent ด้วย unique(roadmap_id, day_number) ชนกับ cron ได้ปลอดภัย
    const gen = await generateNextQuest(admin, { roadmap, dayNumber: latestQuest.day_number + 1 });
    if (gen.failed) {
      return json(200, {
        status: 'not_ready',
        roadmap,
        quest: null,
        message: 'ระบบปั่นเควสไม่ทันแป๊บนึง ลองใหม่อีกครั้งได้เลย',
      });
    }
    quest = gen.quest;
    generatedNow = gen;
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
