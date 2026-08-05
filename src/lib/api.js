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
  // telemetry การเรียนรู้ (pilot "อ่าน + โจทย์") — best-effort เท่านั้น
  // ★ ห้ามให้ผลลัพธ์หรือ error ของตัวนี้ไปบล็อกการเคลม XP ผู้เรียนต้องได้ XP แม้ telemetry ล่ม
  learningSignal: (payload, token) =>
    callFn('learning-signal', { body: payload, token }).catch((err) => {
      console.warn('[learning-signal] บันทึกไม่สำเร็จ (ไม่กระทบ XP):', err?.message || err);
      return null;
    }),
  // สลับหัวข้อที่ active (progress หัวข้อเดิมเก็บไว้) — UI เรียกใช้ตอนหน้าโปรไฟล์/nav มาถึง (ticket 09)
  switchRoadmap: (roadmapId, token) => callFn('switch-roadmap', { body: { roadmap_id: roadmapId }, token }),
  // ลบหัวข้อทิ้งถาวร (คืนโควตาเพดานฟรี 3 หัวข้อ) — progress ของหัวข้อนั้นหายหมด แต่ XP/streak สะสมอยู่บน
  // profiles ไม่ถูกแตะ; ตอบ { deleted_id, roadmaps, active_roadmap_id } กลับมาให้ drawer อัพเดตตัวเองได้
  deleteRoadmap: (roadmapId, token) => callFn('delete-roadmap', { body: { roadmap_id: roadmapId }, token }),
  redeemReferral: (code, token) => callFn('redeem-referral', { body: { referral_code: code }, token }),
  chat: (payload, token) => callFn('chat', { body: payload, token }),
  // ---- พรีเมียม 39 บาท/เดือน ผ่านพร้อมเพย์ (spec §6.3) ----
  // createPayment: สร้าง/คืนรายการจ่ายที่ค้างอยู่ → { ref_code, amount, status, promptpay_id }
  //   อาจตอบ 503 ถ้าเจ้าของยังไม่ได้ตั้งเลขพร้อมเพย์ → หน้า /premium จับ err.status เองแล้วบอกผู้ใช้ดี ๆ
  // submitSlip: บอกว่าอัปสลิปขึ้น bucket payment-slips แล้ว (pending → submitted)
  createPayment: (token) => callFn('create-payment', { body: {}, token }),
  submitSlip: (payload, token) => callFn('submit-slip', { body: payload, token }),
};
