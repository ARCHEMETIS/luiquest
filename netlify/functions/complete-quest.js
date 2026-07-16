// POST /.netlify/functions/complete-quest — checklist gating -> XP/streak/grade + activity_log (#06)
// body: { quest_id, checked_item_ids: [uuid, ...] }
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';
import { bangkokDateStr, startOfBangkokDayISO } from './_shared/datetime.js';
// GRADE_BANDS ส่งเข้า RPC complete_quest — single source of truth เดิม (streak/grade คำนวณใน SQL แล้ว)
import { GRADE_BANDS } from '../../src/lib/gradeBands.js';

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

  // insert completion + XP/streak/grade + activity_log ทำ atomic ใน RPC เดียว (Postgres lock
  // แถว profiles) — เดิม read-modify-write ฝั่ง JS ทำ 2 เควสพร้อมกัน/ชน redeem_referral แล้ว
  // XP หายได้ (scrutinize 2026-07-15 Major 4); RPC จัดการ double-submit (unique conflict) เองด้วย
  const { data: result, error: rpcErr } = await admin.rpc('complete_quest', {
    p_user_id: user.id,
    p_quest_id: questId,
    p_roadmap_id: quest.roadmap_id,
    p_xp: quest.xp_reward,
    p_checked_items: [...checkedIds],
    p_today: bangkokDateStr(),
    p_grade_bands: GRADE_BANDS,
    p_metadata: { quest_id: questId, roadmap_id: quest.roadmap_id, xp_earned: quest.xp_reward, day_start: startOfBangkokDayISO() },
  });
  if (rpcErr) return json(500, { error: rpcErr.message });

  return json(200, {
    alreadyCompleted: result.already_completed,
    xp_earned: result.xp_earned,
    total_xp: result.total_xp,
    current_streak: result.current_streak,
    longest_streak: result.longest_streak,
    grade: result.grade,
  });
};
