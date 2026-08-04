// POST /.netlify/functions/create-payment — สร้างหรือคืน payment ที่ยังเปิดอยู่
// ต้องสร้าง ref ฝั่ง server เพื่อให้เลขอ้างอิงจับคู่กับยอดโอนได้จริงและแก้ไขจาก client ไม่ได้
import { randomInt } from 'node:crypto';
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';

const PAYMENT_AMOUNT = 39;
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_REF_ATTEMPTS = 8;

function env(name) {
  return typeof Netlify !== 'undefined' ? Netlify.env.get(name) : process.env[name];
}

export function generateRefCode(randomIndex = (max) => randomInt(0, max)) {
  let suffix = '';
  for (let i = 0; i < 4; i += 1) suffix += REF_ALPHABET[randomIndex(REF_ALPHABET.length)];
  return `LQ-${suffix}`;
}

export function isPremiumActive(profile, now = new Date()) {
  if (!profile?.is_premium || !profile.premium_until) return false;
  const premiumUntil = new Date(profile.premium_until);
  return Number.isFinite(premiumUntil.getTime()) && premiumUntil > new Date(now);
}

// ใช้เฉพาะเป็น pure logic ประกอบการทดสอบและเอกสาร — สิทธิจริงต้องต่ออายุใน RPC ที่ atomic
export function extendPremiumUntil(existingPremiumUntil, now = new Date()) {
  const nowDate = new Date(now);
  const existingDate = existingPremiumUntil ? new Date(existingPremiumUntil) : null;
  const base = existingDate && Number.isFinite(existingDate.getTime()) && existingDate > nowDate
    ? existingDate
    : nowDate;

  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  const day = base.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const extended = new Date(Date.UTC(year, month, Math.min(day, lastDay)));
  extended.setUTCHours(base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds(), base.getUTCMilliseconds());
  return extended.toISOString();
}

export async function insertPaymentWithRetry({
  insertAttempt,
  findOpenPayment,
  maxAttempts = MAX_REF_ATTEMPTS,
  generate = generateRefCode,
}) {
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const refCode = generate();
    const result = await insertAttempt(refCode);
    if (!result?.error) return { ...result, refCode, reused: false };

    // 23505 อาจเป็น ref_code ชน หรือ unique index ของ payment ที่เปิดอยู่ — เช็คแถวของ user ก่อนสุ่มใหม่
    if (result.error.code !== '23505') return result;
    lastError = result.error;
    const open = await findOpenPayment();
    if (open?.error) return { data: null, error: open.error };
    if (open?.data) return { data: open.data, error: null, refCode: open.data.ref_code, reused: true };
  }

  return { data: null, error: lastError || new Error('สร้างรหัส payment ไม่สำเร็จ') };
}

async function findOpenPayment(admin, userId) {
  return admin
    .from('payments')
    .select('id, ref_code, amount, status, slip_url, created_at, submitted_at')
    .eq('user_id', userId)
    .in('status', ['pending', 'submitted'])
    .order('created_at', { ascending: false })
    .maybeSingle();
}

function paymentResponse(payment, promptpayId) {
  return {
    ref_code: payment.ref_code,
    amount: payment.amount,
    status: payment.status,
    promptpay_id: promptpayId,
  };
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const { user } = await requireUser(req);
  if (!user) return unauthorized();

  const promptpayId = env('PROMPTPAY_ID')?.trim();
  if (!promptpayId) {
    return json(503, { error: 'ระบบชำระเงินยังไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่ภายหลัง' });
  }

  const admin = getAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('is_premium, premium_until')
    .eq('id', user.id)
    .single();
  if (profileErr) return json(500, { error: profileErr.message });

  if (isPremiumActive(profile)) {
    return json(409, { error: 'บัญชีนี้มี Premium ที่ยังใช้งานอยู่ ไม่ต้องสร้างรายการชำระเงินซ้ำ' });
  }

  const existingResult = await findOpenPayment(admin, user.id);
  if (existingResult.error) return json(500, { error: existingResult.error.message });

  let payment = existingResult.data;
  let reused = Boolean(payment);
  if (!payment) {
    const insertResult = await insertPaymentWithRetry({
      insertAttempt: (refCode) => admin
        .from('payments')
        .insert({ user_id: user.id, ref_code: refCode, amount: PAYMENT_AMOUNT, status: 'pending' })
        .select('id, ref_code, amount, status, slip_url, created_at, submitted_at')
        .single(),
      findOpenPayment: () => findOpenPayment(admin, user.id),
    });
    if (insertResult.error) return json(500, { error: insertResult.error.message });
    payment = insertResult.data;
    reused = insertResult.reused;
  }

  // เก็บ intent แม้ผู้ใช้กดกลับมาเปิด QR เดิม เพื่อวัด demand โดยไม่สร้าง payment ซ้ำ
  await admin.from('activity_log').insert({
    user_id: user.id,
    event_type: 'premium_submit',
    metadata: { payment_id: payment.id, ref_code: payment.ref_code, amount: payment.amount, reused },
  });

  return json(200, paymentResponse(payment, promptpayId));
};
