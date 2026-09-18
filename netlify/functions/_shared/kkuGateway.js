// เกตเวย์ LLM ของ มข. (KKU IntelSphere — https://gen.ai.kku.ac.th) เป็น provider สำรองกำลังผลิต
//
// ทำไมต้องมี: Gemini free tier ของ Google จำกัดที่ "จำนวนครั้ง" — ตัวที่ดีที่สุดใน chain คือ
// 3.1-flash-lite ที่ได้ 15 RPM / 500 RPD ทั้งแอพ. วันเปิดให้ทั้งห้องลองพร้อมกัน คนที่ 16 ในนาทีนั้น
// ต้องไล่ chain แล้วรอ backoff. เกตเวย์ มข. จำกัดที่ "จำนวนโทเคน/วัน" แทน และ**แยกสระตามค่าย**
// ⇒ เอาหลายค่ายมาต่อกันได้กำลังสำรองเป็นล้านโทเคน/วัน โดยไม่ชนเพดานต่อนาทีของใครเลย
//
// โปรโตคอล: OpenAI-compatible `/chat/completions` — **รับแค่ `Authorization: Bearer`**
// (ส่ง x-api-key จะได้ 401) ส่วน `/messages` แบบ Anthropic ก็มี แต่ไม่ได้ใช้ที่นี่
//
// ⚠️ คีย์เป็นของเจ้าของแอพคนเดียว และสระโควตา **แชร์กับเว็บแชท + Claude Code + แอพอื่นที่ใช้คีย์เดียวกัน**
//    ถ้าวันไหนแอพกินหนัก ฝั่งนั้นจะรู้สึกด้วย — ดู README ของ kku-api ประกอบ

import { env } from './env.js';

const KKU_BASE_URL = env('KKU_BASE_URL') || 'https://gen.ai.kku.ac.th/api/v1';

export function kkuApiKey() {
  return env('KKU_API_KEY');
}

// ชื่อโมเดลในโปรเจกต์นี้ติด prefix `kku:` ไว้เสมอ เพื่อให้ log อ่านออกว่าวิ่งทางไหน
// และกันชนกับชื่อโมเดลของ Google ที่บังเอิญซ้ำกัน (เกตเวย์ก็มี gemini-3.5-flash-lite เหมือนกัน แต่คนละสระโควตา)
export const KKU_PREFIX = 'kku:';

export function isKkuModel(model) {
  return String(model).startsWith(KKU_PREFIX);
}

export function stripKkuPrefix(model) {
  return String(model).slice(KKU_PREFIX.length);
}

// โมเดลไหนอยู่สระไหน — ต้องรู้เพื่อ "พักทั้งสระ" ตอนโควตาค่ายนั้นหมด ไม่ใช่พักแค่โมเดลเดียว
// (ยิงโมเดลอื่นในค่ายเดียวกันต่อก็ได้ 401 เหมือนเดิม เสียเวลาฟรี)
const MODEL_POOL = {
  'gemini-3.5-flash-lite': 'Gemini',
  'gemini-3.7-flash': 'Gemini',
  'llama-4-maverick': 'Meta',
  'llama-4-scout': 'Meta',
  'gpt-5.6-luna': 'OpenAI',
  'gpt-5.6-terra': 'OpenAI',
  'mistral-small-2603': 'Mistral',
  'nova-2-lite-v1': 'Nova',
  'deepseek-v4-flash': 'Deepseek',
};
const poolOf = (realModel) => MODEL_POOL[realModel] || realModel;

// ── พักสระที่โควตาหมด ───────────────────────────────────────────────────────
// ไม่มีตัวนี้ = พอสระหมด ทุก request ที่เหลือของวันยังเสียเวลายิงไปโดนปฏิเสธซ้ำ ๆ ก่อนตกไปตัวถัดไป
// สถานะเก็บใน memory ของ instance ⇒ อยู่ได้เท่าที่ Lambda ตัวนั้นยังอุ่น ซึ่งพอสำหรับช่วง burst
// (ไม่ใช้ที่เก็บถาวรโดยตั้งใจ — ไม่คุ้มที่จะยิง DB ทุกครั้งเพื่อกันเคสนี้)
const poolCooldownUntil = new Map();
const COOLDOWN_MS = {
  quota_exhausted: 30 * 60 * 1000, // โควตารายวันหมด — รีเซ็ตตอนไหนไม่แน่นอน เช็กใหม่ทุกครึ่งชั่วโมง
  bad_key: 10 * 60 * 1000,         // คีย์ผิด/หมดอายุ: แก้ได้ด้วยคนเท่านั้น พักยาวหน่อยแต่ไม่ถาวร
};

export function isPoolCoolingDown(model) {
  const until = poolCooldownUntil.get(poolOf(stripKkuPrefix(model)));
  return typeof until === 'number' && Date.now() < until;
}

function startCooldown(realModel, reason) {
  const ms = COOLDOWN_MS[reason];
  if (!ms) return;
  const pool = poolOf(realModel);
  poolCooldownUntil.set(pool, Date.now() + ms);
  console.warn(`[kku] พักสระ ${pool} ${ms / 60000} นาที (เหตุ: ${reason})`);
}

// เกตเวย์ตอบ 401 กับเรื่องคนละเรื่องกันสามแบบ — แยกด้วย body เท่านั้น ห้ามอ่านแค่ status
// (พอร์ตจาก kku-api/client.py classify_error)
export function classifyKkuError(status, bodyText) {
  const body = String(bodyText || '');
  if (/daily limit/i.test(body)) return 'quota_exhausted';
  if (/Invalid model/i.test(body)) return 'unknown_model';
  if (/Invalid API key/i.test(body)) return 'bad_key';
  return status === 401 ? 'unauthorized' : 'http_error';
}

// ---------- แปลง request ทรง Gemini -> ทรง OpenAI ----------
// รับ body ชุดเดียวกับที่ callGeminiOnce รับ เพื่อให้ tryChain เรียกได้โดยไม่ต้องรู้ว่าปลายทางเป็นใคร
function toOpenAiMessages({ contents, systemInstruction }) {
  const messages = [];
  if (systemInstruction) messages.push({ role: 'system', content: String(systemInstruction) });

  for (const turn of contents || []) {
    const text = (turn.parts || []).map((p) => p.text ?? '').join('');
    messages.push({ role: turn.role === 'model' ? 'assistant' : 'user', content: text });
  }
  return messages;
}

// responseSchema ของ Gemini บังคับรูปได้จริงฝั่ง Google แต่เกตเวย์ไม่มีของแบบนั้น
// ⇒ แปลง schema เป็นคำสั่งในข้อความแทน แล้วเปิด json_object mode ประกบ
// ถ้าโมเดลยังตอบไม่ตรงรูป -> JSON.parse หรือ validate ฝั่ง caller จะพัง -> tryChain ข้ามไปโมเดลถัดไปเอง
function appendSchemaInstruction(messages, schema) {
  if (!schema) return messages;
  const instruction = [
    'ตอบเป็น JSON ล้วนเท่านั้น ห้ามมีข้อความอื่นนอก JSON ห้ามครอบด้วย markdown code fence',
    'ต้องตรงกับ JSON schema นี้ทุกฟิลด์:',
    JSON.stringify(schema),
  ].join('\n');

  const copy = [...messages];
  const lastUser = copy.map((m) => m.role).lastIndexOf('user');
  if (lastUser === -1) {
    copy.push({ role: 'user', content: instruction });
  } else {
    copy[lastUser] = { ...copy[lastUser], content: `${copy[lastUser].content}\n\n${instruction}` };
  }
  return copy;
}

// JSON ของเควส/roadmap ยาวกว่าที่คิด (บทเรียน + checklist) — ให้เพดานกว้างไว้
// ถ้าตันที่ finish_reason: 'length' JSON จะขาดกลางคัน parse พัง แล้วไหลไปโมเดลถัดไปฟรี ๆ
const DEFAULT_MAX_TOKENS_JSON = 4000;

// ⚠️ เกตเวย์ไม่มีปุ่มปิด thinking แบบ thinkingConfig ของ Google — โมเดลบางตัวเทโทเคนลง `reasoning`
//    ก่อนเริ่มเขียนคำตอบ (วัด 18 ก.ย.: gpt-5.6-luna 441 ตัวอักษร, minimax 1695, deepseek 1870)
//    ถ้าให้เพดานเท่า maxOutputTokens ที่ฝั่งแชทตั้งไว้ (800) โทเคนอาจหมดไปกับ reasoning จน content ว่าง
//    ⇒ บวกส่วนเผื่อให้เฉพาะทางนี้ ไม่ไปแตะค่าที่ฝั่ง Google ใช้
const REASONING_HEADROOM_TOKENS = 700;

// ⚠️ วัดจริง 18 ก.ย. 2026: ถึงจะสั่ง response_format: json_object แล้ว เกตเวย์ก็ยังคืนคำตอบที่ห่อด้วย
// markdown fence (```json ... ```) ประมาณ **4 ใน 10 ครั้ง** — finish_reason เป็น 'stop' เนื้อครบทุกตัวอักษร
// แค่มีรั้วครอบ. ไม่ปอกให้ = JSON.parse พังแล้วไหลไปโมเดลถัดไปทั้งที่คำตอบดีอยู่แล้ว (เสียเวลา+โควตาฟรี ๆ)
// ฝั่ง Google ไม่มีปัญหานี้เพราะ responseSchema บังคับรูปได้จริง จึงปอกเฉพาะทางนี้
function unwrapJsonText(raw) {
  let text = String(raw).trim();

  const fenced = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/i);
  if (fenced) text = fenced[1].trim();

  // ตัดเอาเฉพาะช่วงวงเล็บนอกสุด — ต้องทำ **เสมอ** ไม่ใช่เฉพาะตอนขึ้นต้นด้วยตัวอักษร
  // เคสที่เคยพลาด: ตอบ JSON ถูกแล้วต่อท้ายว่า "หวังว่าจะช่วยได้นะครับ" ⇒ ขึ้นต้นด้วย { จึงถูกข้าม แล้ว parse พัง
  // ปิดท้ายด้วยวงเล็บที่ "คู่กับตัวเปิด" ไม่ใช่ตัวปิดตัวสุดท้ายในสตริง มิฉะนั้นข้อความต่อท้ายที่มี ] จะถูกลากมาด้วย
  const start = text.search(/[{[]/);
  if (start !== -1) {
    const open = text[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === open) depth += 1;
      else if (ch === close) {
        depth -= 1;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    // วงเล็บไม่ครบ (โดนตัดกลางคัน) — คืนตั้งแต่ตัวเปิดไป ให้ JSON.parse เป็นคนตัดสินว่าใช้ไม่ได้
    return text.slice(start);
  }
  return text;
}

// ---------- ยิงจริง ----------
// คืน response "ทรง Gemini" กลับไป เพื่อให้ extractFn เดิมใน gemini.js ใช้ต่อได้โดยไม่ต้องแก้
export async function callKkuOnce(model, { contents, systemInstruction, generationConfig = {} }, { timeoutMs } = {}) {
  const apiKey = kkuApiKey();
  if (!apiKey) throw new Error('ยังไม่ได้ตั้ง KKU_API_KEY');

  const realModel = stripKkuPrefix(model);
  const wantsJson = generationConfig.responseMimeType === 'application/json';

  let messages = toOpenAiMessages({ contents, systemInstruction });
  if (wantsJson) messages = appendSchemaInstruction(messages, generationConfig.responseSchema);

  const maxTokens = generationConfig.maxOutputTokens
    ? generationConfig.maxOutputTokens + REASONING_HEADROOM_TOKENS
    : (wantsJson ? DEFAULT_MAX_TOKENS_JSON : 1000 + REASONING_HEADROOM_TOKENS);

  let res;
  try {
    res = await fetch(`${KKU_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: realModel,
        messages,
        ...(typeof generationConfig.temperature === 'number' ? { temperature: generationConfig.temperature } : {}),
        max_tokens: maxTokens,
        ...(wantsJson ? { response_format: { type: 'json_object' } } : {}),
      }),
      // ห้ามยิงแบบไม่มีเพดานเวลา: เกตเวย์เป็นของมหาลัย ไม่เคยวัดตอนโหลดหนัก ถ้าค้างขึ้นมา
      // จะกินเวลาทั้งก้อนของฟังก์ชันจนไม่เหลือให้ตัวสำรองใน chain ได้ทำงานเลย
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    const wrapped = new Error(`kku ${realModel} ${timedOut ? `ไม่ตอบใน ${timeoutMs}ms` : `ยิงไม่ออก: ${err.message}`}`);
    wrapped.kkuReason = timedOut ? 'timeout' : 'network';
    throw wrapped;
  }

  if (!res.ok) {
    const bodyText = await res.text();
    const reason = classifyKkuError(res.status, bodyText);
    startCooldown(realModel, reason);
    const err = new Error(`kku ${realModel} -> ${res.status} (${reason}): ${bodyText.slice(0, 200)}`);
    err.status = res.status;
    err.kkuReason = reason;
    throw err;
  }

  const data = await res.json();

  // โควตาคงเหลือติดมากับทุก response แบบ non-stream — log ไว้ให้ดูย้อนหลังได้ว่าวันนั้นเหลือเท่าไหร่
  // (ตัวเลขนี้เพี้ยนตอนยิงรัวพร้อมกัน เพราะเกตเวย์นับไม่ทัน — ใช้ดูแนวโน้ม อย่าเอาไปตัดสินใจอัตโนมัติ)
  const quota = data?.model_quota;
  if (quota) {
    console.log(
      `[kku] ${realModel} (${data.provider ?? '-'}) เหลือ ${quota.daily_remaining_tokens}/${quota.daily_quota_tokens} โทเคนวันนี้`
    );
  }

  const choice = data?.choices?.[0];
  const text = choice?.message?.content;

  // โมเดลสาย reasoning เทโทเคนลง field `reasoning` จน content ว่างได้ ถือเป็นความล้มเหลวของโมเดลนี้ไปเลย
  // ให้ chain ไหลต่อ ดีกว่าส่งข้อความว่างให้ผู้ใช้ — log แยกให้ชัดว่าเป็นคนละเรื่องกับโควตาหมด
  if (!text || !String(text).trim()) {
    const reasoningLen = String(choice?.message?.reasoning ?? '').length;
    console.warn(
      `[kku] ${realModel} content ว่าง (finish_reason=${choice?.finish_reason ?? '-'}, reasoning ${reasoningLen} ตัวอักษร) — ไม่ใช่ปัญหาโควตา`
    );
    const err = new Error(`kku ${realModel} ตอบ content ว่าง`);
    err.kkuReason = 'empty_content';
    throw err;
  }

  // แปลงกลับเป็นทรง Gemini: candidates[0].content.parts[].text
  const out = wantsJson ? unwrapJsonText(text) : String(text);
  return { candidates: [{ content: { parts: [{ text: out }] } }] };
}
