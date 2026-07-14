// GET /.netlify/functions/me — โปรไฟล์ + roadmap ของผู้ใช้ที่ล็อกอิน (#06)
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method Not Allowed' });

  const { user } = await requireUser(req);
  if (!user) return unauthorized();

  const admin = getAdminClient();

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select(
      'id, display_name, avatar_url, total_xp, current_streak, longest_streak, grade, referral_code, is_premium, premium_until, leaderboard_opt_out, created_at'
    )
    .eq('id', user.id)
    .single();
  if (profileErr) return json(500, { error: profileErr.message });

  const { data: roadmaps, error: roadmapsErr } = await admin
    .from('roadmaps')
    .select('id, topic_id, topic_title, level, minutes_per_day, is_active, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (roadmapsErr) return json(500, { error: roadmapsErr.message });

  return json(200, { profile, roadmaps: roadmaps ?? [] });
};
