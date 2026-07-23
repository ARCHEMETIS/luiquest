// POST /.netlify/functions/redeem-referral — สมัครผ่านลิงก์ชวนเพื่อน -> XP ทั้งคู่ (#10)
// body: { referral_code }
// ผู้ใช้เขียน referrals/แจก XP เองไม่ได้ (กันโกง) ต้องผ่าน service role ตัวนี้เท่านั้น
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';

// โบนัสยังไม่ล็อกในสเปก (#09 flag 11) — ตั้งเท่า xp_reward เควสทั่วไป (10-30) ที่ระดับกลาง
const REFERRAL_XP_BONUS = 20;

// เจตนา referral คือ "สมัครใหม่ผ่านลิงก์ชวน" — บัญชีเก่าไม่ควรวนกลับมา redeem เก็บ XP ได้
// ขยายเวลาเป็น 30 วันให้เพื่อนร่วมชั้นที่ได้รับลิงก์ช้ากว่ายัง redeem ได้
const REDEEM_WINDOW_DAYS = 30;
const REDEEM_WINDOW_EXPIRED_CODE = 'REFERRAL_REDEEM_WINDOW_EXPIRED';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const { user } = await requireUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  // referral_code สุ่มเป็นตัวพิมพ์ใหญ่เสมอ (handle_new_user) — normalize กันเคส URL/share sheet แปลงพิมพ์เล็ก
  const referralCode =
    typeof body.referral_code === 'string' ? body.referral_code.trim().toUpperCase() : '';
  if (!referralCode) return json(400, { error: 'ต้องระบุ referral_code' });

  // user.created_at มาจาก Supabase Auth (ผู้ใช้แก้เองไม่ได้) — เชื่อถือได้กว่าข้อมูลฝั่ง client
  const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
  if (accountAgeMs > REDEEM_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    return json(403, {
      error: `ลิงก์ชวนใช้ได้เฉพาะบัญชีที่สมัครใหม่ไม่เกิน ${REDEEM_WINDOW_DAYS} วัน`,
      code: REDEEM_WINDOW_EXPIRED_CODE,
    });
  }

  const admin = getAdminClient();

  const { data: me, error: meErr } = await admin
    .from('profiles')
    .select('id, referred_by, referral_code')
    .eq('id', user.id)
    .single();
  if (meErr) return json(500, { error: meErr.message });

  if (me.referred_by) {
    return json(400, { error: 'บัญชีนี้ถูกชวนไปแล้ว ใช้ลิงก์ชวนซ้ำไม่ได้' });
  }

  if (me.referral_code === referralCode) {
    return json(400, { error: 'ใช้ลิงก์ชวนของตัวเองไม่ได้' });
  }

  const { data: referrer, error: referrerErr } = await admin
    .from('profiles')
    .select('id')
    .eq('referral_code', referralCode)
    .maybeSingle();
  if (referrerErr) return json(500, { error: referrerErr.message });
  if (!referrer) return json(404, { error: 'ไม่พบลิงก์ชวนนี้' });
  if (referrer.id === user.id) {
    return json(400, { error: 'ใช้ลิงก์ชวนของตัวเองไม่ได้' });
  }

  // insert referrals + จ่าย XP ทั้งคู่ + activity_log ทำใน transaction เดียวของ Postgres (RPC)
  // กัน lost-update ถ้า referrer โดนแก้ total_xp พร้อมกันจากที่อื่น (เช่น complete-quest.js)
  // และกันสถานะค้างครึ่ง ๆ กลาง ๆ ถ้าขั้นใดขั้นหนึ่งพังกลางทาง
  const { data: referredTotalXp, error: redeemErr } = await admin.rpc('redeem_referral', {
    p_referrer_id: referrer.id,
    p_referred_id: user.id,
    p_bonus: REFERRAL_XP_BONUS,
  });
  if (redeemErr) {
    // race: อีก request แทรก redeem ไปก่อนแล้ว (unique referred_id) — ไม่ใช่ error จริง แค่กันแจก XP ซ้ำ
    if (redeemErr.code === '23505') {
      return json(409, { error: 'บัญชีนี้ถูกชวนไปแล้ว ใช้ลิงก์ชวนซ้ำไม่ได้' });
    }
    return json(500, { error: redeemErr.message });
  }

  return json(200, {
    referrer_xp_awarded: REFERRAL_XP_BONUS,
    referred_xp_awarded: REFERRAL_XP_BONUS,
    total_xp: referredTotalXp,
  });
};
