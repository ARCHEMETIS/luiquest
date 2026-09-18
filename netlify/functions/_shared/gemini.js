// Gemini caller + fallback chain (#07 ai-pipeline) — โครงเดิมจาก deploy-plan.md sec.2 / ml-quest ใช้อ้างอิง
// ยิงด้วย raw fetch ตรงไป REST API (ไม่มี @google/genai SDK ในโปรเจกต์นี้ ไม่เพิ่ม dependency ใหม่)
// กลยุทธ์โควต้าเต็ม: .scratch/app-v2-spec/assets/gemini-quota-research.md (#03)
//
// Export หลัก:
//   QUEST_MODEL_CHAIN / CHAT_MODEL_CHAIN — ลำดับโมเดลต่อประเภทงาน (ถังโควต้าแยกกัน)
//   generateText({ prompt, systemInstruction, chain, temperature, history }) -> string
//   generateJSON({ prompt, systemInstruction, chain, schema, temperature })  -> object (parsed JSON)
//   QUEST_JSON_SCHEMA / ROADMAP_JSON_SCHEMA / QUEST_CONTINUATION_JSON_SCHEMA — schema เควส/roadmap ใช้ร่วมกันทั้งสร้างใหม่และต่อยอด

import { env } from './env.js';
import { callKkuOnce, isKkuModel, isPoolCoolingDown, kkuApiKey } from './kkuGateway.js';

const GEMINI_API_KEY = env('GEMINI_API_KEY');

// แบ่งงานตามโมเดล (#03/#07): งานหนัก (roadmap/เควส) กับแชท ใช้คนละตัวหลัก (ถังโควต้าแยกกัน)
// อัพเดต 21 ก.ค. 2026: gemini-3-flash-preview (preview) ตอบช้า/hang เป็นบางครั้ง ชนกับ netlify timeout
//   → generate เควส on-demand ล้ม (หน้าเควสขึ้น "ไม่พร้อม"). สลับมาใช้โมเดล GA ที่ verify แล้ว 200 + เร็ว (<3s)
//
// อัพเดต 23 ก.ค. 2026 — **เช็คโควต้าจริงกับ AI Studio dashboard แล้ว (ปิด pending item #11.A.4)**
//   free tier ต่อโมเดล: 2.5-flash = 5 RPM / **20 RPD**, 2.5-flash-lite = 10 RPM / **20 RPD**,
//                       3.5-flash = 5 RPM / 20 RPD, **3.1-flash-lite = 15 RPM / 500 RPD**
//   chain เดิมใช้แต่โมเดล 20 RPD ทั้งคู่ = ทั้งแอพยิงได้ 40 ครั้ง/วัน — แชทอย่างเดียวสเปกให้ 10 ข้อความ/คน/วัน
//   แปลว่า **ผู้ใช้คนเดียวกินโควตาหมดทั้งแอพ** (dashboard ขึ้นเตือน RPM ชนแล้วจริง 6/5 ตอนเทส 23 ก.ค.)
//   → เอา 3.1-flash-lite (500 RPD) เข้ามาเป็นก้นถังของทั้งสอง chain: quest ~540 RPD, chat ~520 RPD
//   เรียงลำดับตามเจตนา: quest เอาคุณภาพนำ (2.5-flash ก่อน) แล้วค่อยไหลลง lite ตอนโควตาตัวดีหมด;
//   chat เอา 3.1-flash-lite นำเลยเพราะเป็นตัวกินจำนวนครั้ง (10 ข้อความ/คน/วัน) ไม่ได้ต้องการคุณภาพสูงสุด
//
// อัพเดต 14 ส.ค. 2026 — **สลับ QUEST ให้เอา throughput นำแทนคุณภาพ (เตรียมเปิด QR ให้คนทั้งห้อง ~60 คนลองพร้อมกัน)**
//   ของเดิม 2.5-flash นำ = รับได้แค่ **5 คน/นาที** คนที่ 6 ขึ้นไปต้องไล่ chain: 429 → หน่วง 1.5-3 วิ → ลองซ้ำ →
//   429 → โมเดลถัดไป → หน่วงอีก ... รวม ~11-12 วิ **เกิน timeout 10 วิของ Netlify** = ผู้ใช้เห็น error ไม่ใช่แค่ช้า
//   (timeout ตั้งใน netlify.toml ไม่ได้ Netlify ไม่มีคีย์นี้ — แก้ที่ลำดับ chain ได้ทางเดียว)
//   → เอา 3.1-flash-lite (15 RPM) ขึ้นนำ: 15 คนแรก/นาที ได้ทันทีใน ~4 วิ (จับเวลาจริง 14 ส.ค. = 3.9 วิ)
//     เหลือคนที่ 16+ เท่านั้นที่ต้องไหลลง 2.5-flash/3.5-flash ซึ่งยังว่างอยู่
//   แลกมาด้วยคุณภาพ roadmap ที่ลดลงเล็กน้อย — **หลังงานนำเสนอ ถ้าอยากได้คุณภาพคืน สลับสองตัวแรกกลับ**
//
// อัพเดต 18 ก.ย. 2026 — **เอาเกตเวย์ มข. (KKU IntelSphere) ขึ้นนำ แล้วต่อสระสำรองให้ลึก**
//   ของ Google จำกัดที่ "จำนวนครั้ง" (ดีที่สุดคือ 15 RPM / 500 RPD ทั้งแอพ) ⇒ เป็นคอขวดตอนคนเข้าพร้อมกัน
//   เกตเวย์ มข. จำกัดที่ "โทเคน/วัน" และ**แยกสระตามค่าย** ⇒ ต่อหลายค่าย = กำลังสำรองเป็นล้านโทเคน/วัน
//
//   วัดจริงทุกตัวเมื่อ 18 ก.ย. 2026 (roadmap 3 เฟส, ดูสคริปต์ใน .scratch):
//     kku:gemini-3.5-flash-lite  Gemini 350k   2.2s  JSON 10/10  reasoning 0
//     kku:llama-4-maverick       Meta 200k     2.2s  JSON ok     reasoning 0
//     kku:gpt-5.6-luna           OpenAI 200k   3.3s  JSON ok     reasoning 441 ตัวอักษร
//     kku:mistral-small-2603     Mistral 100k  5.6s  JSON ok     reasoning 0
//     kku:deepseek-v4-flash      Deepseek 1M  13.3s  JSON ok     reasoning 1870  ← ช้าสุดแต่สระใหญ่สุด
//     kimi-k3 ไม่ตอบใน 25 วิ / qwen เทโทเคนลง reasoning จน content ว่าง ⇒ ทั้งคู่ไม่เอาเข้า chain
//
//   **เพดานเวลาของ Netlify คือ 60 วิ ไม่ใช่ 10 วิ** (เช็กเอกสารทางการ 18 ก.ย. 2026 — ค่าเก่าในคอมเมนต์
//   ด้านบนตกรุ่นแล้ว และปรับไม่ได้) จึงมีที่ว่างให้ตัวช้าอย่าง deepseek ได้ทำงานจริง
//   วางไว้ท้ายสุดเพื่อให้ปลอดภัยไม่ว่าเพดานจริงจะเป็นเท่าไหร่: กว่าจะถึงคิวมัน ตัวอื่นก็ล้มหมดแล้ว
//   ผู้ใช้กำลังจะเจอ error อยู่แล้ว ⇒ "ช้า" ยังไงก็ชนะ "ล่ม" ตรงนั้น
export const QUEST_MODEL_CHAIN = [
  'kku:gemini-3.5-flash-lite',
  'kku:llama-4-maverick',
  'kku:gpt-5.6-luna',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'kku:mistral-small-2603',
  'kku:deepseek-v4-flash',
];
export const CHAT_MODEL_CHAIN = [
  'kku:gemini-3.5-flash-lite',
  'kku:llama-4-maverick',
  'kku:gpt-5.6-luna',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'kku:mistral-small-2603',
];

// งานปั่นเควสกลางคืน (scheduled function เพดาน 30 วิ) — ไม่มีใครนั่งรอ ความช้าไม่สำคัญ
// จงใจเอาสระใหญ่-ช้าขึ้นก่อน เพื่อ**เก็บสระเร็วไว้ให้ผู้ใช้ตอนกลางวัน**
export const PREGEN_MODEL_CHAIN = [
  'kku:deepseek-v4-flash',
  'kku:nova-2-lite-v1',
  'kku:mistral-small-2603',
  'kku:gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

// งบเวลาต่อหนึ่งคำขอ: ต้องเผื่อให้ caller ได้ทำงาน DB ต่อและตอบกลับทัน
// 20 วิ ปลอดภัยใต้เพดาน 60 วิของ Netlify และยังพอให้ deepseek (13.3 วิ) ได้ลองจริง
export const LIVE_BUDGET_MS = 20_000;
export const PREGEN_BUDGET_MS = 25_000;
// เพดานต่อโมเดล: กันตัวเดียวกินงบทั้งก้อนจนตัวสำรองไม่ได้เกิด
const PER_CALL_CAP_MS = 16_000;
// เหลือน้อยกว่านี้ไม่ต้องเริ่มตัวใหม่ — เริ่มไปก็ไม่ทันจบ เสียโควตาเปล่า
const MIN_ATTEMPT_MS = 1_500;

// chain เดินได้ถ้ามีคีย์อย่างน้อยหนึ่งฝั่ง — ตัวที่ไม่มีคีย์จะล้มตอนถูกเรียกแล้ว tryChain ข้ามไปเอง
function assertSomeProviderKey() {
  if (!GEMINI_API_KEY && !kkuApiKey()) {
    throw new Error('ยังไม่ได้ตั้งคีย์ AI เลยสักตัว (ต้องมี KKU_API_KEY หรือ GEMINI_API_KEY อย่างน้อยหนึ่งอัน)');
  }
}

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

async function callGeminiOnce(model, { contents, systemInstruction, generationConfig }, { timeoutMs } = {}) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      // ส่ง key ผ่าน header แทน query string — กัน key หลุดไป log/URL history (nit จากรีวิว 15 ก.ค.)
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
        contents,
        generationConfig,
      }),
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
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

// ตัวสลับราง: ชื่อโมเดลขึ้นต้นด้วย `kku:` วิ่งเกตเวย์ มข. นอกนั้นวิ่ง Google ตรง
// ทั้งสองทางรับ body ทรงเดียวกันและคืน response ทรงเดียวกัน ⇒ tryChain/extractFn ไม่ต้องรู้เรื่องนี้เลย
async function callModelOnce(model, body, options) {
  return isKkuModel(model) ? callKkuOnce(model, body, options) : callGeminiOnce(model, body, options);
}

// ไล่ chain ทีละโมเดล: 429 per-minute (RPM) retry โมเดลเดิม 1 ครั้งด้วย backoff+jitter ก่อนไปโมเดลถัดไป;
// 429 per-day (RPD) หรือ non-2xx อื่น ๆ ข้ามไปโมเดลถัดไปทันที ไม่ retry; extractFn ล้มเหลว (เช่น parse JSON พัง)
// ก็ถือเป็นความล้มเหลวของโมเดลนั้น ข้ามไปโมเดลถัดไปเช่นกัน (ไม่ retry โมเดลเดิมซ้ำ)
// ถ้าลอง "ทุกโมเดลในchain" หมดแล้วยังไม่สำเร็จ -> throw error ที่มี .exhausted = true ให้ caller ไป trigger fallback เอง
// requestBody เป็น object ตรง ๆ หรือ function (model) => body สำหรับ config ที่ต่างกันตามรุ่นโมเดล (เช่น thinkingConfig)
async function tryChain(chain, requestBody, extractFn, { budgetMs = LIVE_BUDGET_MS } = {}) {
  let lastErr;
  const deadline = Date.now() + budgetMs;

  for (const model of chain) {
    // สระที่เพิ่งตอบว่าโควตาหมด/คีย์ผิด ข้ามไปเลย ไม่ต้องเสียเวลายิงไปโดนปฏิเสธซ้ำ
    if (isKkuModel(model) && isPoolCoolingDown(model)) {
      console.warn(`[ai] ข้าม ${model} — สระกำลังพักอยู่`);
      continue;
    }

    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) {
      console.warn(`[ai] เลิกไล่ chain ที่ ${model} — เหลืองบเวลา ${remaining}ms ไม่พอเริ่มตัวใหม่`);
      break;
    }
    const timeoutMs = Math.min(PER_CALL_CAP_MS, remaining);

    const body = typeof requestBody === 'function' ? requestBody(model) : requestBody;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const data = await callModelOnce(model, body, { timeoutMs });
        try {
          return extractFn(data);
        } catch (parseErr) {
          lastErr = parseErr;
          break; // parse/validate ล้มเหลว -> ไปโมเดลถัดไป (ไม่ใช่ 429 เลยไม่ retry โมเดลเดิม)
        }
      } catch (err) {
        lastErr = err;
        const backoffMs = jitteredBackoffMs();
        // retry ตัวเดิมได้เฉพาะตอนที่ยังมีงบพอทั้ง "นอนรอ" และ "ยิงใหม่" — ไม่งั้นเอางบไปให้ตัวถัดไปดีกว่า
        const isRpmRetryable = err.status === 429
          && err.rateLimited?.quotaType === 'minute'
          && attempt === 1
          && deadline - Date.now() > backoffMs + MIN_ATTEMPT_MS;
        if (isRpmRetryable) {
          console.warn(`[ai] ${model} RPM 429 — retry เดิม 1 ครั้งหลัง backoff`);
          await sleep(backoffMs);
          continue; // retry โมเดลเดิมอีก 1 ครั้งเท่านั้น
        }
        console.warn(`[ai] ${model} ล้มเหลว (${err.kkuReason ?? err.status ?? 'no-status'}) — ไปโมเดลถัดไป: ${err.message}`);
        break; // RPD / non-429 / retry ครั้งที่ 2 ก็ยังพัง -> ไปโมเดลถัดไป
      }
    }
  }
  // lastErr ว่างได้จริงเมื่องบเวลาหมดตั้งแต่ยังไม่ได้ยิงตัวไหนเลย — อย่าปล่อยให้ log เป็น "undefined"
  const why = lastErr?.message
    ? String(lastErr.message)
    : `งบเวลา ${budgetMs}ms หมดก่อนได้เริ่มยิงโมเดลไหนเลย`;
  console.error(`[ai] chain หมดทุกโมเดล (${chain.join(' -> ')}): ${why}`);
  const exhausted = new Error(`AI chain หมดทุกโมเดลแล้ว: ${why}`);
  exhausted.exhausted = true;
  exhausted.cause = lastErr;
  throw exhausted;
}

// ปิด/หรี่ thinking สำหรับงานแชท (Medium 6 รีวิว 15 ก.ค.): thinking token นับรวมใน maxOutputTokens
// ถ้าไม่ปิด budget 800 จะหมดไปกับ thinking ก่อนได้ text จริง -> response ว่าง -> tryChain ข้ามโมเดลทั้งที่โควต้าเหลือ
// syntax ต่างตามรุ่น (ห้ามส่งสอง field พร้อมกัน — API ตอบ 400):
//   Gemini 3  -> thinkingLevel: 'minimal' (Flash รองรับ; ปิดสนิทไม่ได้ แต่คิดน้อยสุด)
//   Gemini 2.5 -> thinkingBudget: 0 (ปิดสนิท; flash-lite ปิดอยู่แล้วโดย default แต่ระบุชัดไว้กันพลาด)
// หมายเหตุ: ใช้เฉพาะ chat chain เท่านั้น — quest/roadmap (generateJSON) ไม่จำกัด maxOutputTokens และต้องการ reasoning เต็ม ห้ามเอาไปใส่
function minimalThinkingConfig(model) {
  return model.startsWith('gemini-3') ? { thinkingLevel: 'minimal' } : { thinkingBudget: 0 };
}

// ---------- generateText: ข้อความล้วน (ใช้กับแชท) ----------
// history (ถ้ามี) = [{ role: 'user' | 'model', text }] เรียงเก่า -> ใหม่ ต่อท้ายด้วย prompt เป็นข้อความล่าสุด
export async function generateText({ prompt, systemInstruction, chain = CHAT_MODEL_CHAIN, temperature = 0.7, history = [], budgetMs }) {
  assertSomeProviderKey();

  const contents = [
    ...history.map((h) => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: String(h.text ?? '') }] })),
    { role: 'user', parts: [{ text: String(prompt ?? '') }] },
  ];

  return tryChain(
    chain,
    (model) => ({
      contents,
      systemInstruction,
      generationConfig: { temperature, maxOutputTokens: 800, thinkingConfig: minimalThinkingConfig(model) },
    }),
    (data) => {
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .join('')
        .trim();
      if (!text) throw new Error('โมเดลตอบข้อความว่างเปล่า');
      return text;
    },
    { budgetMs }
  );
}

// ---------- generateJSON: structured output (ใช้กับ roadmap/เควส) ----------
export async function generateJSON({ prompt, systemInstruction, chain = QUEST_MODEL_CHAIN, schema, temperature = 0.9, budgetMs }) {
  assertSomeProviderKey();

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
      if (!text.trim()) throw new Error('โมเดลตอบ JSON ว่างเปล่า');
      return JSON.parse(text); // parse พังก็ throw ในนี้ -> tryChain ถือเป็นความล้มเหลวของโมเดลนี้ ไปตัวถัดไป
    },
    { budgetMs }
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
    intro: { type: 'STRING' },
    objectives: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      minItems: 2,
      maxItems: 4,
    },
    xp_reward: { type: 'INTEGER' },
    checklist: {
      type: 'ARRAY',
      items: CHECKLIST_ITEM_SCHEMA,
      minItems: 2,
      maxItems: 4,
    },
  },
  required: ['title', 'description', 'intro', 'objectives', 'xp_reward', 'checklist'],
};

// เควสเดี่ยว: { title, description, intro, objectives, xp_reward, checklist: [{label, link_url}] }
export const QUEST_JSON_SCHEMA = QUEST_SHAPE_SCHEMA;

// roadmap เต็ม (สร้างใหม่): { topic_ok, phases: [{phase_number, title, description}], first_quest: <QUEST_JSON_SCHEMA> }
// topic_ok = ด่านกรองหัวข้อชั้นที่ 2 (ดู _shared/topicModeration.js) — ให้โมเดลตีกลับหัวข้อที่ไม่ใช่การเรียนรู้
// ในคอลเดียวกับที่ generate อยู่แล้ว ไม่เพิ่ม request/โควตา; phases+first_quest ยัง required อยู่ตาม schema
// (โมเดลจะกรอกมาแบบขอไปทีตอนปฏิเสธ) ฝั่งโค้ดเช็ค topic_ok ก่อนเสมอแล้วทิ้งเนื้อหาทั้งก้อนถ้าเป็น false
export const ROADMAP_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    topic_ok: { type: 'BOOLEAN' },
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
  required: ['topic_ok', 'phases', 'first_quest'],
};

// เควสต่อเนื่อง (nightly pre-generate, ticket 08): เหมือน QUEST_JSON_SCHEMA + สัญญาณ phase ปัจจุบัน/ใหม่
// phase_number ตัดสินใจ deterministic ฝั่งโค้ด (ไม่ใช้ Gemini ตัดสิน) — ให้ Gemini แค่ตั้งชื่อ/คำอธิบายเฟสเมื่อเป็นเฟสใหม่
export const QUEST_CONTINUATION_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    intro: { type: 'STRING' },
    objectives: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      minItems: 2,
      maxItems: 4,
    },
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
  required: ['title', 'description', 'intro', 'objectives', 'xp_reward', 'checklist', 'phase_title', 'phase_description'],
};
