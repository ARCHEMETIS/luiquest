// Helper เรียก Netlify Functions — frontend เรียก /.netlify/functions/* ตรง ๆ (ดู deploy-plan.md sec.3)
const BASE = '/.netlify/functions';

async function callFn(name, { method = 'POST', body, token, query } = {}) {
  const qs = query
    ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null)).toString()
    : '';
  const res = await fetch(`${BASE}/${name}${qs}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

export const api = {
  me: (token) => callFn('me', { method: 'GET', token }),
  startRoadmap: (payload, token) => callFn('start-roadmap', { body: payload, token }),
  generateQuest: (payload, token) => callFn('generate-quest', { body: payload, token }),
  questToday: (token, roadmapId) =>
    callFn('quest-today', { method: 'GET', token, query: roadmapId ? { roadmap_id: roadmapId } : undefined }),
  completeQuest: (payload, token) => callFn('complete-quest', { body: payload, token }),
  // สลับหัวข้อที่ active (progress หัวข้อเดิมเก็บไว้) — UI เรียกใช้ตอนหน้าโปรไฟล์/nav มาถึง (ticket 09)
  switchRoadmap: (roadmapId, token) => callFn('switch-roadmap', { body: { roadmap_id: roadmapId }, token }),
  redeemReferral: (code, token) => callFn('redeem-referral', { body: { referral_code: code }, token }),
  chat: (payload, token) => callFn('chat', { body: payload, token }),
};
