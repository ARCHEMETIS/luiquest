// POST /.netlify/functions/submit-slip — ผูกสลิปกับ payment ของผู้ใช้
// ตรวจ prefix ฝั่ง server เพราะ service role ข้าม RLS และ path จาก client เชื่อถือไม่ได้
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';

export function ownsSlipPath(slipPath, userId) {
  return typeof slipPath === 'string' && typeof userId === 'string' && slipPath.startsWith(`${userId}/`);
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

  return json(200, submitted);
};
