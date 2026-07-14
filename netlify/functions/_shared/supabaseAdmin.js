// Supabase client ฝั่ง server — ใช้ SERVICE_ROLE_KEY (ข้าม RLS) ห้ามหลุดไป client เด็ดขาด
// ใช้ใน pre-generate/เขียน cache. โมดูลใน _shared/ ไม่ถูก deploy เป็น endpoint (ขึ้นต้น _)
import { createClient } from '@supabase/supabase-js';

function env(name) {
  return typeof Netlify !== 'undefined' ? Netlify.env.get(name) : process.env[name];
}

let cached = null;

function getAdminClient() {
  if (cached) return cached;
  const url = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('ยังไม่ได้ตั้ง SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }
  cached = createClient(url, serviceKey, { auth: { persistSession: false } });
  return cached;
}

export { getAdminClient };
