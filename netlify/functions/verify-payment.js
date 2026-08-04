// POST /.netlify/functions/verify-payment — เจ้าของตรวจสลิปและให้สิทธิ์ Premium
// ตรวจ is_admin จากฐานข้อมูลทุกครั้ง เพราะข้อมูลจาก client ปลอมได้
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const { user } = await requireUser(req);
  if (!user) return unauthorized();

  const admin = getAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (profileErr) return json(500, { error: profileErr.message });
  if (!profile?.is_admin) return json(403, { error: 'ไม่มีสิทธิ์สำหรับผู้ดูแลระบบ' });

  const body = await req.json().catch(() => ({}));
  const paymentId = typeof body.payment_id === 'string' ? body.payment_id.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';
  const rejectReason = typeof body.reject_reason === 'string' ? body.reject_reason.trim() : '';
  if (!paymentId) return json(400, { error: 'ต้องระบุ payment_id' });
  if (!['verify', 'reject'].includes(action)) {
    return json(400, { error: "action ต้องเป็น 'verify' หรือ 'reject'" });
  }
  if (action === 'reject' && !rejectReason) return json(400, { error: 'กรุณาระบุเหตุผลที่ปฏิเสธสลิป' });

  if (action === 'verify') {
    // payment + profile + activity_log อยู่ใน transaction เดียว เพื่อไม่ให้จ่ายสิทธิ์ครึ่ง ๆ กลาง ๆ
    const { data: verified, error: verifyErr } = await admin.rpc('verify_payment', {
      p_payment_id: paymentId,
      p_admin_id: user.id,
    });
    if (verifyErr) {
      if (verifyErr.code === 'P0002') return json(404, { error: 'ไม่พบรายการชำระเงินนี้' });
      if (verifyErr.code === 'P0001') return json(409, { error: 'รายการนี้ไม่ได้อยู่ระหว่างรอตรวจสอบ' });
      if (verifyErr.code === '42501') return json(403, { error: 'ไม่มีสิทธิ์สำหรับผู้ดูแลระบบ' });
      return json(500, { error: verifyErr.message });
    }
    return json(200, verified);
  }

  const { data: payment, error: paymentErr } = await admin
    .from('payments')
    .select('id, user_id, ref_code, amount, status')
    .eq('id', paymentId)
    .maybeSingle();
  if (paymentErr) return json(500, { error: paymentErr.message });
  if (!payment) return json(404, { error: 'ไม่พบรายการชำระเงินนี้' });
  if (payment.status !== 'submitted') return json(409, { error: 'รายการนี้ไม่ได้อยู่ระหว่างรอตรวจสอบ' });

  const { data: rejected, error: rejectErr } = await admin
    .from('payments')
    .update({ status: 'rejected', reject_reason: rejectReason })
    .eq('id', payment.id)
    .eq('status', 'submitted')
    .select('id, ref_code, amount, status, reject_reason')
    .maybeSingle();
  if (rejectErr) return json(500, { error: rejectErr.message });
  if (!rejected) return json(409, { error: 'รายการนี้ถูกจัดการไปแล้ว กรุณารีเฟรชหน้า' });

  await admin.from('activity_log').insert({
    user_id: payment.user_id,
    event_type: 'premium_submit',
    metadata: {
      payment_id: payment.id,
      ref_code: payment.ref_code,
      amount: payment.amount,
      action: 'reject',
      reject_reason: rejectReason,
      verified_by: user.id,
    },
  });

  return json(200, rejected);
};
