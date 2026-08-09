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
      'id, display_name, avatar_url, total_xp, current_streak, longest_streak, last_quest_date, last_active_at, grade, referral_code, is_premium, premium_until, leaderboard_opt_out, created_at'
    )
    .eq('id', user.id)
    .single();
  if (profileErr) return json(500, { error: profileErr.message });

  // ★ นับ "เปิดแอพ" ตรงนี้ — เดิมวัดไม่ได้เลยว่ามีคนกลับมาไหม เพราะ last_active_at เขียนเฉพาะตอน
  //   ทำเควสเสร็จ ส่วน last_sign_in_at ก็ไม่ช่วยเพราะ Supabase เก็บ session ไว้ เปิดซ้ำไม่ต้องล็อกอินใหม่
  //   ทำที่นี่เพราะ /me ถูกเรียกทุกครั้งที่เปิดแอพอยู่แล้ว → ไม่เพิ่ม invocation ของ Netlify แม้แต่ครั้งเดียว
  //   และ service role ข้าม RLS ได้ จึงไม่ต้องปลดล็อกคอลัมน์นี้ใน profiles_update_own (ซึ่งจะเปิดให้
  //   ผู้ใช้ปลอมเวลาเข้าใช้งานของตัวเองได้ — audit 5 ส.ค. ตั้งใจล็อกไว้)
  //   เขียนไม่เกินชั่วโมงละครั้ง กัน write ทุกครั้งที่เปลี่ยนหน้า และไม่ await เพราะเป็น telemetry ล้วน
  const lastActive = profile?.last_active_at ? Date.parse(profile.last_active_at) : 0;
  if (!Number.isFinite(lastActive) || Date.now() - lastActive > 60 * 60 * 1000) {
    admin
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', user.id)
      .then(({ error }) => {
        if (error) console.warn('[me] อัปเดต last_active_at ไม่สำเร็จ (ไม่กระทบผู้ใช้):', error.message);
      });
  }

  const { data: roadmaps, error: roadmapsErr } = await admin
    .from('roadmaps')
    .select('id, topic_id, topic_title, level, minutes_per_day, is_active, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (roadmapsErr) return json(500, { error: roadmapsErr.message });

  return json(200, { profile, roadmaps: roadmaps ?? [] });
};
