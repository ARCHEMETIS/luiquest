// GET/POST /.netlify/functions/admin-payments — คิวตรวจสลิปและตัวเลขรายได้
// ยอดรวมอยู่ใน SQL view เพื่อไม่ดึง payment history ทั้งหมดขึ้นมา aggregate ใน JS
import { requireUser, unauthorized, json } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabaseAdmin.js';

export default async (req) => {
  if (!['GET', 'POST'].includes(req.method)) return json(405, { error: 'Method Not Allowed' });

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

  const [{ data: queue, error: queueErr }, { data: stats, error: statsErr }] = await Promise.all([
    admin
      .from('payments')
      .select('id, user_id, ref_code, amount, status, slip_url, created_at, submitted_at, profiles(display_name)')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true })
      .order('created_at', { ascending: true }),
    admin
      .from('payment_admin_stats')
      .select('revenue_total, revenue_by_month, payers_total, pending_count, submitted_count')
      .single(),
  ]);
  if (queueErr) return json(500, { error: queueErr.message });
  if (statsErr) return json(500, { error: statsErr.message });

  return json(200, {
    payments: (queue ?? []).map((payment) => ({
      id: payment.id,
      user_id: payment.user_id,
      ref_code: payment.ref_code,
      amount: payment.amount,
      status: payment.status,
      slip_path: payment.slip_url,
      display_name: payment.profiles?.display_name ?? null,
      created_at: payment.created_at,
      submitted_at: payment.submitted_at,
    })),
    revenue_total: stats.revenue_total,
    revenue_by_month: stats.revenue_by_month ?? [],
    payers_total: stats.payers_total,
    pending_count: stats.pending_count,
    submitted_count: stats.submitted_count,
  });
};
