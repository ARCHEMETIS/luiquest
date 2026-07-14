// POST /.netlify/functions/complete-quest — checklist gating -> XP/streak/grade + activity_log (#06)
// body: { quest_id, checked_item_ids: [uuid, ...] }
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';
import { bangkokDateStr, startOfBangkokDayISO } from './_shared/datetime.js';
import { nextStreak, computeGrade } from './_shared/gameplay.js';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const { user } = await requireUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const questId = body.quest_id;
  const checkedIds = new Set(Array.isArray(body.checked_item_ids) ? body.checked_item_ids : []);
  if (!questId) return json(400, { error: 'ต้องระบุ quest_id' });

  const admin = getAdminClient();

  const { data: quest, error: questErr } = await admin
    .from('daily_quests')
    .select('id, roadmap_id, xp_reward, roadmaps!inner(user_id)')
    .eq('id', questId)
    .maybeSingle();
  if (questErr) return json(500, { error: questErr.message });
  if (!quest || quest.roadmaps.user_id !== user.id) return json(404, { error: 'ไม่พบเควสนี้' });

  const { data: existing } = await admin
    .from('quest_completions')
    .select('id, xp_earned')
    .eq('user_id', user.id)
    .eq('quest_id', questId)
    .maybeSingle();
  if (existing) {
    const { data: profile } = await admin
      .from('profiles')
      .select('total_xp, current_streak, longest_streak, grade')
      .eq('id', user.id)
      .single();
    return json(200, { alreadyCompleted: true, xp_earned: existing.xp_earned, ...profile });
  }

  const { data: checklist, error: checklistErr } = await admin
    .from('quest_checklist_items')
    .select('id')
    .eq('quest_id', questId);
  if (checklistErr) return json(500, { error: checklistErr.message });

  const requiredIds = (checklist ?? []).map((c) => c.id);
  const allChecked = requiredIds.every((id) => checkedIds.has(id));
  if (requiredIds.length > 0 && !allChecked) {
    return json(400, { error: 'ติ๊ก checklist ให้ครบทุกข้อก่อนถึงจะได้ XP' });
  }

  const { error: completeErr } = await admin.from('quest_completions').insert({
    user_id: user.id,
    quest_id: questId,
    roadmap_id: quest.roadmap_id,
    xp_earned: quest.xp_reward,
    checked_items: [...checkedIds],
  });
  if (completeErr) {
    // race: อีก request คู่ขนาน (double-submit) แทรกไปก่อนแล้ว — ถือว่าสำเร็จโดยคำขอนั้น ไม่ใช่ error จริง
    if (completeErr.code === '23505') {
      const { data: profile } = await admin
        .from('profiles')
        .select('total_xp, current_streak, longest_streak, grade')
        .eq('id', user.id)
        .single();
      return json(200, { alreadyCompleted: true, xp_earned: quest.xp_reward, ...profile });
    }
    return json(500, { error: completeErr.message });
  }

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('total_xp, current_streak, longest_streak, last_quest_date')
    .eq('id', user.id)
    .single();
  if (profileErr) return json(500, { error: profileErr.message });

  const todayStr = bangkokDateStr();
  const streakChange = nextStreak({ lastQuestDate: profile.last_quest_date, todayStr });
  const currentStreak =
    streakChange === null
      ? profile.current_streak
      : streakChange === 'increment'
      ? profile.current_streak + 1
      : 1;
  const longestStreak = Math.max(profile.longest_streak, currentStreak);
  const grade = computeGrade(currentStreak);
  const totalXp = profile.total_xp + quest.xp_reward;

  const { error: updateErr } = await admin
    .from('profiles')
    .update({
      total_xp: totalXp,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_quest_date: todayStr,
      last_active_at: new Date().toISOString(),
      grade,
    })
    .eq('id', user.id);
  if (updateErr) return json(500, { error: updateErr.message });

  await admin.from('activity_log').insert({
    user_id: user.id,
    event_type: 'quest_complete',
    metadata: { quest_id: questId, roadmap_id: quest.roadmap_id, xp_earned: quest.xp_reward, day_start: startOfBangkokDayISO() },
  });

  return json(200, {
    alreadyCompleted: false,
    xp_earned: quest.xp_reward,
    total_xp: totalXp,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    grade,
  });
};
