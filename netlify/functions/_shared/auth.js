// ตรวจ session ผู้ใช้จาก Authorization: Bearer <access_token> (Supabase Auth, Google sign-in)
// ทุก function ที่แตะข้อมูลผู้ใช้ต้องเรียก requireUser() ก่อนเสมอ — กันเรียกตรงโดยไม่ล็อกอิน
import { getAdminClient } from './supabaseAdmin.js';

export async function requireUser(req) {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { user: null };

  const { data, error } = await getAdminClient().auth.getUser(token);
  if (error || !data?.user) return { user: null };
  return { user: data.user };
}

export function unauthorized() {
  return json(401, { error: 'ยังไม่ได้ล็อกอิน หรือ session หมดอายุ' });
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
