// POST /.netlify/functions/submit-slip — ผูกสลิปกับ payment ของผู้ใช้
// ตรวจ prefix ฝั่ง server เพราะ service role ข้าม RLS และ path จาก client เชื่อถือไม่ได้
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';
import {
  isSlipVerificationEnabled,
  normalisePromptPayAccount,
  verifySlip,
} from './_shared/slipVerify.js';

function env(name) {
  return typeof Netlify !== 'undefined' ? Netlify.env.get(name) : process.env[name];
}

export function ownsSlipPath(slipPath, userId) {
  return typeof slipPath === 'string' && typeof userId === 'string' && slipPath.startsWith(`${userId}/`);
}

function amountInSatang(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const satang = Math.round(amount * 100);
  return Math.abs(amount * 100 - satang) < 0.000001 ? satang : null;
}

async function recordVerificationOutcome(admin, paymentId, outcome) {
  try {
    const base = {
      slip_verification_status: outcome.status,
      slip_verification_checked_at: new Date().toISOString(),
      slip_verification_raw: outcome.raw ?? null,
      slip_verified_amount: outcome.amount ?? null,
      slip_receiver_account: outcome.receiverAccount || null,
    };
    if (outcome.transRef) base.slip_trans_ref = outcome.transRef;

    let { error } = await admin
      .from('payments')
      .update(base)
      .eq('id', paymentId)
      .eq('status', 'submitted');

    if (error?.code === '23505' && outcome.transRef) {
      // ref ซ้ำต้องไม่เขียนทับเจ้าของเดิม แต่ยังเก็บผลว่าแถวนี้เป็นการใช้สลิปซ้ำไว้ให้ admin เห็น
      delete base.slip_trans_ref;
      base.slip_verification_status = 'duplicate_transaction_reference';
      ({ error } = await admin
        .from('payments')
        .update(base)
        .eq('id', paymentId)
        .eq('status', 'submitted'));
    }
    return error;
  } catch (error) {
    // audit เป็น best effort หลังเก็บ slip แล้ว จึงห้ามทำให้ request ล้มและผู้ใช้คิดว่าสลิปหาย
    return error;
  }
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const { user } = await requireUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const refCode = typeof body.ref_code === 'string' ? body.ref_code.trim().toUpperCase() : '';
  const slipPath = typeof body.slip_path === 'string' ? body.slip_path.trim() : '';
  if (!refCode) return json(400, { error: 'ต้องระบุ ref_code' });
  if (!slipPath) return json(400, { error: 'ต้องระบุ slip_path' });
  if (!ownsSlipPath(slipPath, user.id)) {
    return json(403, { error: 'เส้นทางสลิปไม่ใช่โฟลเดอร์ของบัญชีนี้' });
  }

  const admin = getAdminClient();
  const { data: payment, error: paymentErr } = await admin
    .from('payments')
    .select('id, ref_code, amount, status, slip_url, submitted_at')
    .eq('ref_code', refCode)
    .eq('user_id', user.id)
    .maybeSingle();
  if (paymentErr) return json(500, { error: paymentErr.message });
  if (!payment) return json(404, { error: 'ไม่พบรายการชำระเงินของบัญชีนี้' });
  if (payment.status !== 'pending') {
    return json(409, { error: 'รายการชำระเงินนี้ส่งสลิปไปแล้วหรือไม่สามารถส่งซ้ำได้' });
  }

  const submittedAt = new Date().toISOString();
  const { data: submitted, error: submitErr } = await admin
    .from('payments')
    .update({ slip_url: slipPath, submitted_at: submittedAt, status: 'submitted' })
    .eq('id', payment.id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select('id, ref_code, amount, status, slip_url, submitted_at')
    .maybeSingle();
  if (submitErr) return json(500, { error: submitErr.message });
  if (!submitted) return json(409, { error: 'รายการนี้ถูกส่งสลิปไปแล้ว กรุณารีเฟรชหน้า' });

  // ไม่ตั้ง key = flow เดิมทุกประการ เพื่อให้เปิดระบบได้โดยไม่ผูกกับผู้ให้บริการภายนอก
  if (!isSlipVerificationEnabled()) return json(200, submitted);

  const expectedReceiverAccount = normalisePromptPayAccount(env('PROMPTPAY_ID')?.trim() || '');
  if (!expectedReceiverAccount) {
    await recordVerificationOutcome(admin, submitted.id, {
      status: 'receiver_config_missing',
      raw: { code: 'RECEIVER_CONFIG_MISSING' },
    });
    return json(200, submitted);
  }

  try {
    const verification = await verifySlip(slipPath);
    const audit = {
      raw: verification.raw,
      amount: verification.amount,
      transRef: verification.transRef,
      receiverAccount: verification.receiverAccount,
    };

    if (!verification.ok) {
      await recordVerificationOutcome(admin, submitted.id, { ...audit, status: 'not_genuine' });
      return json(200, submitted);
    }

    // เทียบยอดจาก payment ที่ server อ่านเองเท่านั้น — body จาก client ไม่มีสิทธิ์กำหนดยอด
    if (amountInSatang(verification.amount) !== amountInSatang(submitted.amount)) {
      await recordVerificationOutcome(admin, submitted.id, { ...audit, status: 'amount_mismatch' });
      return json(200, submitted);
    }

    // เทียบเต็มทั้งเลขเท่านั้น ไม่เทียบ suffix ของเลขที่ถูก mask เพราะอาจอนุมัติเงินที่จ่ายให้คนอื่น
    if (!verification.receiverAccount || verification.receiverAccount !== expectedReceiverAccount) {
      await recordVerificationOutcome(admin, submitted.id, { ...audit, status: 'receiver_mismatch' });
      return json(200, submitted);
    }
    if (!verification.transRef) {
      await recordVerificationOutcome(admin, submitted.id, {
        ...audit,
        status: 'missing_transaction_reference',
      });
      return json(200, submitted);
    }

    // RPC นี้ให้สิทธิ์เฉพาะ service_role และ claim transRef + ต่อ Premium ใน transaction เดียว
    const { data: verified, error: verifyErr } = await admin.rpc('auto_verify_payment', {
      p_payment_id: submitted.id,
      p_trans_ref: verification.transRef,
      p_api_genuine: true,
      p_verified_amount: verification.amount,
      p_receiver_account: verification.receiverAccount,
      p_expected_receiver_account: expectedReceiverAccount,
      p_verification_raw: verification.raw,
    });
    if (!verifyErr) return json(200, { ...submitted, ...verified, status: 'verified' });

    // unique violation หมายถึงมีอีกแถว claim transRef นี้ก่อนแล้ว จึงห้ามจ่ายสิทธิ์ซ้ำ
    await recordVerificationOutcome(admin, submitted.id, {
      ...audit,
      status: verifyErr.code === '23505' ? 'duplicate_transaction_reference' : 'approval_error',
      raw: { verification: verification.raw, approval_error: verifyErr.message },
    });
  } catch (error) {
    // SlipOK ล่ม/ช้า/ตอบผิดรูปต้องไม่ทำสลิปหาย — คง submitted ให้เจ้าของตรวจเองเสมอ
    await recordVerificationOutcome(admin, submitted.id, {
      status: error?.code === 'TIMEOUT' ? 'timeout' : 'verification_error',
      raw: error?.raw ?? { code: error?.code || 'UNKNOWN_ERROR', message: error?.message },
    });
  }

  return json(200, submitted);
};
