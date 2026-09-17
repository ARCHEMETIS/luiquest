// เกตเวย์ LLM ของ มข. (KKU IntelSphere — https://gen.ai.kku.ac.th) เป็น provider สำรองกำลังผลิต
//
// ทำไมต้องมี: Gemini free tier ของ Google จำกัดที่ "จำนวนครั้ง" — ตัวที่ดีที่สุดใน chain คือ
// 3.1-flash-lite ที่ได้ 15 RPM / 500 RPD ทั้งแอพ. วันเปิดให้ทั้งห้องลองพร้อมกัน คนที่ 16 ในนาทีนั้น
// ต้องไล่ chain จน timeout. เกตเวย์ มข. จำกัดที่ "จำนวนโทเคน/วัน" แทน และแยกสระตามค่าย
// (Gemini 350k, Meta AI 200k, Deepseek 1M) ⇒ เอามานำหน้า chain แล้วให้ของ Google เป็นก้นถัง
//
// โปรโตคอล: OpenAI-compatible `/chat/completions` — **รับแค่ `Authorization: Bearer`**
// (ส่ง x-api-key จะได้ 401) ส่วน `/messages` แบบ Anthropic ก็มี แต่ไม่ได้ใช้ที่นี่
//
// ⚠️ คีย์เป็นของเจ้าของแอพคนเดียว และสระโควตา **แชร์กับเว็บแชท + Claude Code + แอพอื่นที่ใช้คีย์เดียวกัน**
//    ถ้าวันไหนแอพกินหนัก ฝั่งนั้นจะรู้สึกด้วย — ดู README ของ kku-api ประกอบ

function env(name) {
  return typeof Netlify !== 'undefined' ? Netlify.env.get(name) : process.env[name];
}

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

// ⚠️ วัดจริง 18 ก.ย. 2026: ถึงจะสั่ง response_format: json_object แล้ว เกตเวย์ก็ยังคืนคำตอบที่ห่อด้วย
// markdown fence (```json ... ```) ประมาณ **4 ใน 10 ครั้ง** — finish_reason เป็น 'stop' เนื้อครบทุกตัวอักษร
// แค่มีรั้วครอบ. ไม่ปอกให้ = JSON.parse พังแล้วไหลไปโมเดลถัดไปทั้งที่คำตอบดีอยู่แล้ว (เสียเวลา+โควตาฟรี ๆ)
// ฝั่ง Google ไม่มีปัญหานี้เพราะ responseSchema บังคับรูปได้จริง จึงปอกเฉพาะทางนี้
function unwrapJsonText(raw) {
  let text = String(raw).trim();

  const fenced = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/i);
  if (fenced) text = fenced[1].trim();

  // เผื่อกรณีมีคำอธิบายโปรยหน้า/ต่อท้าย — ตัดเอาเฉพาะช่วงวงเล็บนอกสุด
  if (!/^[{[]/.test(text)) {
    const start = text.search(/[{[]/);
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }
  return text;
}

// ---------- ยิงจริง ----------
// คืน response "ทรง Gemini" กลับไป เพื่อให้ extractFn เดิมใน gemini.js ใช้ต่อได้โดยไม่ต้องแก้
export async function callKkuOnce(model, { contents, systemInstruction, generationConfig = {} }) {
  const apiKey = kkuApiKey();
  if (!apiKey) throw new Error('ยังไม่ได้ตั้ง KKU_API_KEY');

  const realModel = stripKkuPrefix(model);
  const wantsJson = generationConfig.responseMimeType === 'application/json';

  let messages = toOpenAiMessages({ contents, systemInstruction });
  if (wantsJson) messages = appendSchemaInstruction(messages, generationConfig.responseSchema);

  const res = await fetch(`${KKU_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: realModel,
      messages,
      ...(typeof generationConfig.temperature === 'number' ? { temperature: generationConfig.temperature } : {}),
      max_tokens: generationConfig.maxOutputTokens ?? (wantsJson ? DEFAULT_MAX_TOKENS_JSON : 1000),
      ...(wantsJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    const reason = classifyKkuError(res.status, bodyText);
    const err = new Error(`kku ${realModel} -> ${res.status} (${reason}): ${bodyText.slice(0, 200)}`);
    err.status = res.status;
    err.kkuReason = reason;
    throw err;
  }

  const data = await res.json();

  // โควตาคงเหลือติดมากับทุก response แบบ non-stream — log ไว้ให้ดูย้อนหลังได้ว่าวันนั้นเหลือเท่าไหร่
  const quota = data?.model_quota;
  if (quota) {
    console.log(
      `[kku] ${realModel} (${data.provider ?? '-'}) เหลือ ${quota.daily_remaining_tokens}/${quota.daily_quota_tokens} โทเคนวันนี้`
    );
  }

  const choice = data?.choices?.[0];
  const text = choice?.message?.content;

  // โมเดลสาย reasoning (deepseek/qwen) เทโทเคนลง field `reasoning` จน content ว่างได้
  // ถือเป็นความล้มเหลวของโมเดลนี้ไปเลย ให้ chain ไหลต่อ ดีกว่าส่งข้อความว่างให้ผู้ใช้
  if (!text || !String(text).trim()) {
    const err = new Error(
      `kku ${realModel} ตอบ content ว่าง (finish_reason=${choice?.finish_reason ?? '-'}${
        choice?.message?.reasoning ? ', มีแต่ reasoning' : ''
      })`
    );
    err.kkuReason = 'empty_content';
    throw err;
  }

  // แปลงกลับเป็นทรง Gemini: candidates[0].content.parts[].text
  const out = wantsJson ? unwrapJsonText(text) : String(text);
  return { candidates: [{ content: { parts: [{ text: out }] } }] };
}
