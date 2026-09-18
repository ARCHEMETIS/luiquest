// เทสตรรกะล้วนของเกตเวย์ มข. — ไม่ยิงเน็ต ไม่กินโควตา
// ทุกเคสในนี้มาจากของที่เจอจริงตอนวัด 18 ก.ย. 2026 หรือจากผลรีวิวโค้ดวันเดียวกัน
import { test } from 'node:test';
import assert from 'node:assert/strict';

// คีย์หลอก — ต้องตั้งก่อน import เพราะ callKkuOnce เช็กคีย์ก่อนจะไปถึง fetch ที่เราปลอมไว้
// ห้ามใช้คีย์จริงในเทส: ไฟล์นี้อยู่ใน git และเทสทั้งไฟล์ไม่ยิงเน็ตสักครั้ง
process.env.KKU_API_KEY = 'test-key-not-real';

import {
  classifyKkuError,
  isKkuModel,
  stripKkuPrefix,
  callKkuOnce,
  isPoolCoolingDown,
} from './kkuGateway.js';

test('แยก prefix kku: ออกจากโมเดลของ Google ได้', () => {
  assert.equal(isKkuModel('kku:gemini-3.5-flash-lite'), true);
  assert.equal(isKkuModel('gemini-3.5-flash-lite'), false);
  assert.equal(stripKkuPrefix('kku:llama-4-maverick'), 'llama-4-maverick');
});

test('401 สามความหมาย แยกด้วย body ไม่ใช่ status', () => {
  assert.equal(classifyKkuError(401, 'This model reached daily limit.'), 'quota_exhausted');
  assert.equal(classifyKkuError(401, 'Invalid model'), 'unknown_model');
  assert.equal(classifyKkuError(401, 'Invalid API key'), 'bad_key');
  assert.equal(classifyKkuError(401, 'อย่างอื่น'), 'unauthorized');
  assert.equal(classifyKkuError(500, 'boom'), 'http_error');
});

// ---- ปอก JSON: เคสที่ทำให้คำตอบดี ๆ ถูกทิ้งถ้าไม่ปอก ----
// unwrapJsonText ไม่ได้ export ออกมา จึงเทสผ่านทางเข้าจริงคือ callKkuOnce โดยปลอม fetch
const JSON_BODY = {
  systemInstruction: 'sys',
  contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
  generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'object' } },
};

function fakeGatewayReturning(content) {
  return async () => ({
    ok: true,
    json: async () => ({
      provider: 'Test',
      choices: [{ finish_reason: 'stop', message: { content, reasoning: '' } }],
      model_quota: { daily_quota_tokens: 1, daily_usage_tokens: 0, daily_remaining_tokens: 1 },
    }),
  });
}

async function textFrom(content) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeGatewayReturning(content);
  try {
    const out = await callKkuOnce('kku:gemini-3.5-flash-lite', JSON_BODY);
    return out.candidates[0].content.parts[0].text;
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('ปอก markdown fence ที่เกตเวย์ห่อมาให้ (เจอจริง 4 ใน 10 ครั้ง)', async () => {
  const text = await textFrom('```json\n{"phases":[{"title":"ก"}]}\n```');
  assert.deepEqual(JSON.parse(text), { phases: [{ title: 'ก' }] });
});

test('ปอกได้แม้ fence ไม่ระบุภาษา', async () => {
  const text = await textFrom('```\n{"ok":true}\n```');
  assert.deepEqual(JSON.parse(text), { ok: true });
});

test('ตัดข้อความต่อท้าย JSON ที่ถูกต้อง (เคสที่รีวิวจับได้ — เดิมข้ามเพราะขึ้นต้นด้วย {)', async () => {
  const text = await textFrom('{"topic_ok":true,"phases":[]}\n\nหวังว่าจะช่วยได้นะครับ');
  assert.deepEqual(JSON.parse(text), { topic_ok: true, phases: [] });
});

test('ตัดข้อความโปรยหน้าและท้ายที่มีวงเล็บปิดหลอกอยู่ข้างใน', async () => {
  // เดิมใช้ lastIndexOf(']') ซึ่งจะลากข้อความท้ายมาด้วยแล้ว parse พัง
  const text = await textFrom('นี่คือแผน: {"a":1} ดูขั้นตอน [1] ประกอบ');
  assert.deepEqual(JSON.parse(text), { a: 1 });
});

test('ไม่ตัดวงเล็บปิดที่อยู่ในสตริงของ JSON เอง', async () => {
  const text = await textFrom('{"note":"ใช้ } กับ ] ในข้อความได้"}');
  assert.deepEqual(JSON.parse(text), { note: 'ใช้ } กับ ] ในข้อความได้' });
});

test('JSON ซ้อนหลายชั้นยังครบ', async () => {
  const payload = { phases: [{ title: 'ก', items: [{ n: 1 }] }], first_quest: { checklist: [{ t: 'x' }] } };
  const text = await textFrom('```json\n' + JSON.stringify(payload) + '\n```');
  assert.deepEqual(JSON.parse(text), payload);
});

test('ข้อความธรรมดา (ไม่ใช่ JSON) ไม่ถูกปอก', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeGatewayReturning('สวัสดีครับ วันนี้พักได้นะ');
  try {
    const out = await callKkuOnce('kku:gemini-3.5-flash-lite', {
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    });
    assert.equal(out.candidates[0].content.parts[0].text, 'สวัสดีครับ วันนี้พักได้นะ');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---- content ว่างเพราะโมเดลสาย reasoning ----
test('content ว่างถือเป็นความล้มเหลว ให้ chain ไหลต่อ (ไม่ส่งข้อความว่างให้ผู้ใช้)', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      provider: 'Deepseek',
      choices: [{ finish_reason: 'length', message: { content: null, reasoning: 'คิดไปเรื่อย'.repeat(50) } }],
    }),
  });
  try {
    await assert.rejects(
      () => callKkuOnce('kku:deepseek-v4-flash', JSON_BODY),
      (err) => err.kkuReason === 'empty_content'
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---- timeout ----
test('ยิงเกินเวลาที่ให้ ต้องล้มด้วย reason timeout ไม่ใช่ค้างรอ', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 5000);
      options?.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        const err = new Error('aborted');
        err.name = 'TimeoutError';
        reject(err);
      });
    });
    throw new Error('ไม่ควรมาถึงบรรทัดนี้');
  };
  try {
    await assert.rejects(
      () => callKkuOnce('kku:gemini-3.5-flash-lite', JSON_BODY, { timeoutMs: 60 }),
      (err) => err.kkuReason === 'timeout'
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---- cooldown: พักทั้งสระ ไม่ใช่แค่โมเดลเดียว ----
test('โควตาค่ายหมด แล้วโมเดลอื่นในค่ายเดียวกันถูกพักด้วย', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => 'This model reached daily limit.' });
  try {
    assert.equal(isPoolCoolingDown('kku:llama-4-scout'), false, 'ก่อนยิงต้องยังไม่พัก');
    await assert.rejects(
      () => callKkuOnce('kku:llama-4-maverick', JSON_BODY),
      (err) => err.kkuReason === 'quota_exhausted'
    );
    // maverick กับ scout อยู่สระ Meta เดียวกัน ⇒ ยิง scout ต่อก็ได้ 401 เหมือนกัน ต้องข้ามไปเลย
    assert.equal(isPoolCoolingDown('kku:llama-4-scout'), true, 'ต้องพักทั้งสระ Meta');
    assert.equal(isPoolCoolingDown('kku:gemini-3.5-flash-lite'), false, 'สระอื่นต้องไม่โดนพักไปด้วย');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('ชื่อโมเดลผิดไม่ทำให้สระถูกพัก (เป็นความผิดของเราเอง ไม่ใช่โควตาหมด)', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => 'Invalid model' });
  try {
    await assert.rejects(
      () => callKkuOnce('kku:mistral-small-2603', JSON_BODY),
      (err) => err.kkuReason === 'unknown_model'
    );
    assert.equal(isPoolCoolingDown('kku:mistral-small-2603'), false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('เผื่อโทเคนให้ reasoning เพิ่มจาก maxOutputTokens ที่ caller ตั้งมา', async () => {
  const realFetch = globalThis.fetch;
  let sentBody = null;
  globalThis.fetch = async (_url, options) => {
    sentBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'ok' } }] }),
    };
  };
  try {
    await callKkuOnce('kku:gpt-5.6-luna', {
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      generationConfig: { maxOutputTokens: 800 },
    });
    assert.ok(sentBody.max_tokens > 800, `ต้องมากกว่า 800 แต่ได้ ${sentBody.max_tokens}`);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('system instruction กลายเป็น message role system และลำดับบทสนทนาไม่สลับ', async () => {
  const realFetch = globalThis.fetch;
  let sentBody = null;
  globalThis.fetch = async (_url, options) => {
    sentBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'ok' } }] }) };
  };
  try {
    await callKkuOnce('kku:gemini-3.5-flash-lite', {
      systemInstruction: 'คุณคือโค้ช',
      contents: [
        { role: 'user', parts: [{ text: 'คำถามเก่า' }] },
        { role: 'model', parts: [{ text: 'คำตอบเก่า' }] },
        { role: 'user', parts: [{ text: 'คำถามใหม่' }] },
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    });
    assert.deepEqual(sentBody.messages, [
      { role: 'system', content: 'คุณคือโค้ช' },
      { role: 'user', content: 'คำถามเก่า' },
      { role: 'assistant', content: 'คำตอบเก่า' },
      { role: 'user', content: 'คำถามใหม่' },
    ]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
