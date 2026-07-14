// Gemini caller + fallback chain (#07 ai-pipeline) — โครงเดิมจาก deploy-plan.md sec.2 / ml-quest ใช้อ้างอิง
// ยิงด้วย raw fetch ตรงไป REST API (ไม่มี @google/genai SDK ในโปรเจกต์นี้ ไม่เพิ่ม dependency ใหม่)
// กลยุทธ์โควต้าเต็ม: .scratch/app-v2-spec/assets/gemini-quota-research.md (#03)
//
// Export หลัก:
//   QUEST_MODEL_CHAIN / CHAT_MODEL_CHAIN — ลำดับโมเดลต่อประเภทงาน (ถังโควต้าแยกกัน)
//   generateText({ prompt, systemInstruction, chain, temperature, history }) -> string
//   generateJSON({ prompt, systemInstruction, chain, schema, temperature })  -> object (parsed JSON)
//   QUEST_JSON_SCHEMA / ROADMAP_JSON_SCHEMA / QUEST_CONTINUATION_JSON_SCHEMA — schema เควส/roadmap ใช้ร่วมกันทั้งสร้างใหม่และต่อยอด

function env(name) {
  return typeof Netlify !== 'undefined' ? Netlify.env.get(name) : process.env[name];
}

const GEMINI_API_KEY = env('GEMINI_API_KEY');

// แบ่งงานตามโมเดล (#03/#07): งานหนัก (roadmap/เควส) ใช้ 3-flash เป็นหลัก, แชทใช้ flash-lite เป็นหลัก (ถังโควต้าแยกกัน)
// 2.5-flash เป็น last-resort fallback ท้ายสุดของทั้งสอง chain (spec เรียก "เลิกใช้เป็นตัวหลัก" — RPD ต่ำสุด)
export const QUEST_MODEL_CHAIN = ['gemini-3-flash-preview', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
export const CHAT_MODEL_CHAIN = ['gemini-2.5-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-flash'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// exponential backoff + jitter ฐาน ~1.5s (ห้าม retry ทันที ตามสเปก #03) — retry ครั้งเดียวต่อโมเดล ห้าม sleep ยาวใน function ที่มี timeout 60s
function jitteredBackoffMs(baseMs = 1500) {
  return baseMs + Math.random() * baseMs;
}

// แยกว่า 429 เป็น per-day (RPD) หรือ per-minute (RPM) จาก error.details[].violations[].quotaId (พอร์ตจาก ml-quest reference)
function parseRateLimit(bodyText) {
  let detail = null;
  try {
    detail = JSON.parse(bodyText);
  } catch {
    // เนื้อ error ไม่ใช่ JSON — ถือเป็น per-minute (ระวังไว้ก่อน ปลอดภัยกว่าข้ามไปโมเดลถัดไปทันที)
  }
  const details = detail?.error?.details || [];
  const violations = details.find((d) => String(d['@type']).includes('QuotaFailure'))?.violations || [];
  const ids = violations.map((v) => v.quotaId || '').join(' ');
  const isDay = /PerDay/i.test(ids);
  return { quotaType: isDay ? 'day' : 'minute' };
}

async function callGeminiOnce(model, { contents, systemInstruction, generationConfig }) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
        contents,
        generationConfig,
      }),
    }
  );
  if (!res.ok) {
    const bodyText = await res.text();
    const err = new Error(`gemini ${model} -> ${res.status}: ${bodyText.slice(0, 300)}`);
    err.status = res.status;
    if (res.status === 429) err.rateLimited = parseRateLimit(bodyText);
    throw err;
  }
  return res.json();
}

// ไล่ chain ทีละโมเดล: 429 per-minute (RPM) retry โมเดลเดิม 1 ครั้งด้วย backoff+jitter ก่อนไปโมเดลถัดไป;
// 429 per-day (RPD) หรือ non-2xx อื่น ๆ ข้ามไปโมเดลถัดไปทันที ไม่ retry; extractFn ล้มเหลว (เช่น parse JSON พัง)
// ก็ถือเป็นความล้มเหลวของโมเดลนั้น ข้ามไปโมเดลถัดไปเช่นกัน (ไม่ retry โมเดลเดิมซ้ำ)
// ถ้าลอง "ทุกโมเดลในchain" หมดแล้วยังไม่สำเร็จ -> throw error ที่มี .exhausted = true ให้ caller ไป trigger fallback เอง
async function tryChain(chain, requestBody, extractFn) {
  let lastErr;
  for (const model of chain) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const data = await callGeminiOnce(model, requestBody);
        try {
          return extractFn(data);
        } catch (parseErr) {
          lastErr = parseErr;
          break; // parse/validate ล้มเหลว -> ไปโมเดลถัดไป (ไม่ใช่ 429 เลยไม่ retry โมเดลเดิม)
        }
      } catch (err) {
        lastErr = err;
        const isRpmRetryable = err.status === 429 && err.rateLimited?.quotaType === 'minute' && attempt === 1;
        if (isRpmRetryable) {
          console.warn(`[gemini] ${model} RPM 429 — retry เดิม 1 ครั้งหลัง backoff`);
          await sleep(jitteredBackoffMs());
          continue; // retry โมเดลเดิมอีก 1 ครั้งเท่านั้น
        }
        console.warn(`[gemini] ${model} ล้มเหลว (${err.status ?? 'no-status'}) — ไปโมเดลถัดไป: ${err.message}`);
        break; // RPD / non-429 / retry ครั้งที่ 2 ก็ยังพัง -> ไปโมเดลถัดไป
      }
    }
  }
  console.error(`[gemini] chain หมดทุกโมเดล (${chain.join(' -> ')}): ${String(lastErr?.message || lastErr)}`);
  const exhausted = new Error(`Gemini chain หมดทุกโมเดลแล้ว: ${String(lastErr?.message || lastErr)}`);
  exhausted.exhausted = true;
  exhausted.cause = lastErr;
  throw exhausted;
}

// ---------- generateText: ข้อความล้วน (ใช้กับแชท) ----------
// history (ถ้ามี) = [{ role: 'user' | 'model', text }] เรียงเก่า -> ใหม่ ต่อท้ายด้วย prompt เป็นข้อความล่าสุด
export async function generateText({ prompt, systemInstruction, chain = CHAT_MODEL_CHAIN, temperature = 0.7, history = [] }) {
  if (!GEMINI_API_KEY) throw new Error('ยังไม่ได้ตั้ง GEMINI_API_KEY');

  const contents = [
    ...history.map((h) => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: String(h.text ?? '') }] })),
    { role: 'user', parts: [{ text: String(prompt ?? '') }] },
  ];

  return tryChain(
    chain,
    { contents, systemInstruction, generationConfig: { temperature, maxOutputTokens: 800 } },
    (data) => {
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .join('')
        .trim();
      if (!text) throw new Error('Gemini ตอบข้อความว่างเปล่า');
      return text;
    }
  );
}

// ---------- generateJSON: structured output (ใช้กับ roadmap/เควส) ----------
export async function generateJSON({ prompt, systemInstruction, chain = QUEST_MODEL_CHAIN, schema, temperature = 0.9 }) {
  if (!GEMINI_API_KEY) throw new Error('ยังไม่ได้ตั้ง GEMINI_API_KEY');

  const contents = [{ role: 'user', parts: [{ text: String(prompt ?? '') }] }];

  return tryChain(
    chain,
    {
      contents,
      systemInstruction,
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    },
    (data) => {
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
      if (!text.trim()) throw new Error('Gemini ตอบ JSON ว่างเปล่า');
      return JSON.parse(text); // parse พังก็ throw ในนี้ -> tryChain ถือเป็นความล้มเหลวของโมเดลนี้ ไปตัวถัดไป
    }
  );
}

// ---------- Schema: quest เดี่ยว (ใช้ทั้งใน roadmap.first_quest และเควสต่อเนื่อง) ----------
const CHECKLIST_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    label: { type: 'STRING' },
    link_url: { type: 'STRING', nullable: true },
  },
  required: ['label'],
};

const QUEST_SHAPE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    xp_reward: { type: 'INTEGER' },
    checklist: {
      type: 'ARRAY',
      items: CHECKLIST_ITEM_SCHEMA,
      minItems: 2,
      maxItems: 4,
    },
  },
  required: ['title', 'description', 'xp_reward', 'checklist'],
};

// เควสเดี่ยว: { title, description, xp_reward, checklist: [{label, link_url}] }
export const QUEST_JSON_SCHEMA = QUEST_SHAPE_SCHEMA;

// roadmap เต็ม (สร้างใหม่): { phases: [{phase_number, title, description}], first_quest: <QUEST_JSON_SCHEMA> }
export const ROADMAP_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    phases: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          phase_number: { type: 'INTEGER' },
          title: { type: 'STRING' },
          description: { type: 'STRING' },
        },
        required: ['phase_number', 'title', 'description'],
      },
      minItems: 3,
      maxItems: 6,
    },
    first_quest: QUEST_SHAPE_SCHEMA,
  },
  required: ['phases', 'first_quest'],
};

// เควสต่อเนื่อง (nightly pre-generate, ticket 08): เหมือน QUEST_JSON_SCHEMA + สัญญาณ phase ปัจจุบัน/ใหม่
// phase_number ตัดสินใจ deterministic ฝั่งโค้ด (ไม่ใช้ Gemini ตัดสิน) — ให้ Gemini แค่ตั้งชื่อ/คำอธิบายเฟสเมื่อเป็นเฟสใหม่
export const QUEST_CONTINUATION_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    xp_reward: { type: 'INTEGER' },
    checklist: {
      type: 'ARRAY',
      items: CHECKLIST_ITEM_SCHEMA,
      minItems: 2,
      maxItems: 4,
    },
    phase_title: { type: 'STRING' },
    phase_description: { type: 'STRING' },
  },
  required: ['title', 'description', 'xp_reward', 'checklist', 'phase_title', 'phase_description'],
};
