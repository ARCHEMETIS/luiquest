// Helper เรียก Netlify Functions — frontend เรียก /.netlify/functions/* ตรง ๆ (ดู deploy-plan.md sec.3)
const BASE = '/.netlify/functions';

async function callFn(name, body, token) {
  const res = await fetch(`${BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    let parsed = null;
    try {
      parsed = JSON.parse(detail);
    } catch {
      // ไม่ใช่ JSON — ปล่อย parsed เป็น null
    }
    const err = new Error(parsed?.error || `fn ${name} ล้มเหลว (${res.status}): ${detail}`);
    err.status = res.status;
    if (parsed?.code) err.code = parsed.code;
    throw err;
  }
  return res.json();
}

// ลอจิกจริงเสียบใน ticket #06/#07 — ตอนนี้เป็นแค่ทางเข้า
export const api = {
  chat: (payload, token) => callFn('chat', payload, token),
  generateQuest: (payload, token) => callFn('generate-quest', payload, token),
};
