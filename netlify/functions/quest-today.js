// GET /.netlify/functions/quest-today?roadmap_id=... — เควสปัจจุบันของ roadmap (#06)
// "เควสวันนี้" = daily_quest ที่ day_number น้อยที่สุดใน roadmap ที่ยังไม่มีแถวใน quest_completions
// (โมเดล carry-over: ถ้าทำไม่ทันวันก่อน เควสเดิมค้างรออยู่ ไม่ใช่ตายตัวตามปฏิทิน)
// ถ้าเควสหมด (ทำจบทุกวัน) และวันล่าสุดที่จบไม่ใช่วันนี้ → generate เควสวันถัดไป on-demand ทันที
// (roadmap ที่ถูกพักไว้ไม่เข้า cron รายคืน — ไม่มีทางนี้ผู้ใช้ที่สลับหัวข้อกลับมาจะค้างไร้เควสทั้งวัน)
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';
import { generateNextQuest } from './_shared/questGenerator.js';
import { learningDayStr } from './_shared/datetime.js';
import { isPremiumActive } from './_shared/questGenerator.js';

const FREE_DAILY_QUESTS = 1;
const PREMIUM_DAILY_QUESTS = 3; // ต้องตรงกับ p_premium_allowance ของ RPC complete_quest

// เหลือสิทธิ์ทำเควสที่ได้ XP อีกกี่เควสในวันเรียนนี้ (0 = ครบโควตาแล้ว)
async function xpQuotaRemaining(admin, userId, learningDay) {
  const { data: profile } = await admin
    .from('profiles')
    .select('is_premium, premium_until')
    .eq('id', userId)
    .maybeSingle();
  const limit = isPremiumActive(profile) ? PREMIUM_DAILY_QUESTS : FREE_DAILY_QUESTS;

  const { count } = await admin
    .from('xp_awards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('award_date', learningDay);

  return Math.max(0, limit - (count ?? 0));
}

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
    .select('id, phase_id, day_number, scheduled_date, title, description, content, xp_reward')
    .eq('roadmap_id', roadmap.id)
    .order('day_number', { ascending: true });
  if (questsErr) return json(500, { error: questsErr.message });

  const currentLearningDay = learningDayStr();
  const nextQuest = (quests ?? []).find(
    (q) => !doneIds.has(q.id) && q.scheduled_date && q.scheduled_date > currentLearningDay
  );
  const tomorrowQuest = nextQuest
    ? {
        title: nextQuest.title,
        description: nextQuest.description,
        objectives: Array.isArray(nextQuest.content?.objectives) ? nextQuest.content.objectives : [],
      }
    : null;
  let quest = (quests ?? []).find(
    (q) => !doneIds.has(q.id) && (!q.scheduled_date || q.scheduled_date <= currentLearningDay)
  );
  let generatedNow = null;

  if (!quest) {
    // เควสทุกวันทำจบหมดแล้ว — ตัดสินใจว่า "จบของวันนี้แล้ว" หรือ "ค้างไร้เควส ต้อง generate เดี๋ยวนี้"
    const questList = quests ?? [];
    const latestQuest = questList[questList.length - 1] ?? null;
    const latestDone = [...questList]
      .reverse()
      .filter((q) => !q.scheduled_date || q.scheduled_date <= currentLearningDay)
      .map((q) => (completedRows ?? []).find((r) => r.quest_id === q.id))
      .find(Boolean);
    const doneToday =
      latestDone?.completed_at && learningDayStr(new Date(latestDone.completed_at)) === currentLearningDay;

    // จบเควสของวันนี้ไปแล้ว — แต่พรีเมียมซื้อสิทธิ์ "มากกว่า 1 เควส/วัน" ไว้ จึงต้องเช็คโควตาจริง
    // ก่อนตัดจบ (ก่อนหน้านี้ตัดจบที่ 1 เควสสำหรับทุกคน ทั้งที่หน้าขายโฆษณา 3 เควส/วัน — audit 5 ส.ค.)
    // นับจาก xp_awards ซึ่งเป็นแหล่งเดียวกับที่ complete_quest ใช้ตัดสินเพดาน จึงไม่มีทางคิดคนละทาง
    const quotaLeft = doneToday ? await xpQuotaRemaining(admin, user.id, currentLearningDay) : 0;

    // แยก status 'done_today' ออกจาก 'not_ready' ให้ frontend โชว์ "จบวันนี้แล้ว พักได้" (บวก) ไม่ใช่ "ปั่นไม่ทัน ลองใหม่" (error)
    if (doneToday && quotaLeft <= 0) {
      return json(200, {
        status: 'done_today',
        roadmap,
        quest: null,
        tomorrowQuest,
        // roadmap ที่พักไว้ไม่เข้า cron — อย่าสัญญาว่า "พรุ่งนี้มีเควสใหม่" เพราะจะไม่มีจนกว่าจะสลับกลับมา
        message: roadmap.is_active
          ? 'เควสวันนี้จบแล้ว เก่งมาก! พรุ่งนี้เช้ามีเควสใหม่รอ'
          : 'เควสล่าสุดของหัวข้อนี้จบแล้ว — หัวข้อถูกพักไว้ สลับกลับมาลุยเมื่อไหร่เควสใหม่จะถูกเตรียมให้',
      });
    }
    if (!latestQuest || roadmap.status !== 'ready') {
      return json(200, {
        status: 'not_ready',
        roadmap,
        quest: null,
        message: 'กำลังเตรียมเควสถัดไป ลองรีเฟรชอีกครั้งเร็ว ๆ นี้',
      });
    }

    // roadmap ที่พักไว้ (is_active=false) เป็น read-only: ดูเควสที่มีอยู่แล้วได้ แต่ห้าม trigger generation ใหม่
    // ไม่งั้นแผนฟรีที่เก็บไว้ 3 หัวข้อจะ farm เควสได้ 3 เควส/วันผ่าน ?roadmap_id= โดยไม่ต้อง switch
    // (3× XP + เผาโควต้า Gemini — scrutinize Major 5) เควสใหม่ให้ generate เฉพาะหัวข้อที่ active เท่านั้น
    if (!roadmap.is_active) {
      return json(409, {
        status: 'inactive',
        roadmap,
        quest: null,
        message: 'หัวข้อนี้ถูกพักไว้ — เควสใหม่มีให้เฉพาะหัวข้อที่กำลังลุยอยู่ สลับกลับมาหัวข้อนี้ก่อนแล้วเควสถัดไปจะถูกเตรียมให้',
      });
    }

    // quest ที่ cron เตรียมไว้สำหรับวันเรียนถัดไปยังห้ามส่งให้ผู้ใช้ก่อน 05:00
    if (latestQuest.scheduled_date && latestQuest.scheduled_date > currentLearningDay) {
      return json(200, {
        status: 'not_ready',
        roadmap,
        quest: null,
        message: 'เควสของวันเรียนถัดไปกำลังเตรียมอยู่ กลับมาอีกครั้งหลัง 05:00 น.',
      });
    }

    // ผู้ใช้ควรมีเควสวันนี้แต่ยังไม่ถูกสร้าง (เช่นเพิ่งสลับหัวข้อกลับมา — roadmap ที่พักอยู่ไม่เข้า cron)
    // generate on-demand เลย: idempotent ด้วย unique(roadmap_id, day_number) ชนกับ cron ได้ปลอดภัย
    const gen = await generateNextQuest(admin, {
      roadmap,
      dayNumber: latestQuest.day_number + 1,
      scheduledDate: currentLearningDay,
    });
    if (gen.failed) {
      const { data: generationClaim } = await admin
        .from('quest_generation_claims')
        .select('status')
        .eq('roadmap_id', roadmap.id)
        .eq('day_number', latestQuest.day_number + 1)
        .maybeSingle();
      if (generationClaim?.status === 'generating') {
        return json(200, {
          status: 'generation_in_progress',
          roadmap,
          quest: null,
          message: 'กำลังสร้างเควสอยู่ ลองรีเฟรชอีกครั้งในอีกสักครู่',
        });
      }
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
    tomorrowQuest,
    checklist: checklist ?? [],
    phase,
    completedCount: doneIds.size,
  });
};
