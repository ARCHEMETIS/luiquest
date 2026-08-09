// ตรวจสลิปกับ SlipOK ฝั่ง server เท่านั้น — API key ห้ามหลุดไป client
// จำกัดเวลารวมให้เหลือช่วงสำหรับบันทึกผลลงฐานข้อมูลก่อน Netlify ตัด request ที่ 10 วินาที
import { getAdminClient } from './supabaseAdmin.js';

const SLIP_BUCKET = 'payment-slips';
const SLIPOK_BASE_URL = 'https://api.slipok.com/api/line/apikey';
const VERIFY_TIMEOUT_MS = 6000;

function env(name) {
  return typeof Netlify !== 'undefined' ? Netlify.env.get(name) : process.env[name];
}

export class SlipVerifyError extends Error {
  constructor(code, message, { cause, raw } = {}) {
    super(message, { cause });
    this.name = 'SlipVerifyError';
    this.code = code;
    this.raw = raw;
  }
}

export function isSlipVerificationEnabled() {
  return Boolean(env('SLIPOK_API_KEY')?.trim());
}

function firstValue(values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export function normaliseTransactionRef(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, '').toUpperCase() : '';
}

export function normalisePromptPayAccount(value) {
  if (typeof value !== 'string') return '';
  const compact = value.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (/^66\d{9}$/.test(compact)) return `0${compact.slice(2)}`;
  return compact;
}

function normaliseAmount(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function normaliseResponse(raw) {
  const root = asObject(raw) || {};
  const levelOne = asObject(root.data) || {};
  const levelTwo = asObject(levelOne.data) || {};
  const payload = [levelTwo, levelOne, root].find((candidate) => (
    candidate.transRef !== undefined
    || candidate.trans_ref !== undefined
    || candidate.amount !== undefined
    || candidate.receiver !== undefined
  )) || {};

  const successFlags = [root.success, levelOne.success, levelTwo.success]
    .filter((value) => typeof value === 'boolean');
  // HTTP 200 อย่างเดียวไม่พอ — ต้องมี success=true จาก SlipOK และห้ามมีชั้นใดตอบ false
  const ok = successFlags.includes(true) && !successFlags.includes(false);
  const receiver = asObject(payload.receiver) || asObject(payload.receiverInfo) || {};
  const proxy = asObject(receiver.proxy) || {};
  const account = asObject(receiver.account) || {};
  const receiverAccount = firstValue([
    proxy.value,
    receiver.proxyValue,
    receiver.proxy_value,
    account.value,
    receiver.accountValue,
    receiver.account_value,
    payload.receiverAccount,
    payload.receiver_account,
  ]);

  return {
    ok,
    amount: normaliseAmount(firstValue([payload.amount, payload.transferAmount, payload.transfer_amount])),
    transRef: normaliseTransactionRef(firstValue([
      payload.transRef,
      payload.trans_ref,
      payload.transactionRef,
      payload.transaction_ref,
    ])),
    receiverAccount: normalisePromptPayAccount(
      typeof receiverAccount === 'string' ? receiverAccount : '',
    ),
    raw,
  };
}

function waitForAbort(signal) {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

async function withinDeadline(promise, signal) {
  return Promise.race([promise, waitForAbort(signal)]);
}

async function slipBlob(imageOrPath, signal) {
  if (typeof imageOrPath === 'string') {
    const path = imageOrPath.trim();
    if (!path) throw new SlipVerifyError('INVALID_IMAGE', 'ไม่ได้ระบุ path ของสลิป');

    const download = getAdminClient().storage.from(SLIP_BUCKET).download(path);
    const { data, error } = await withinDeadline(download, signal);
    if (error || !data) {
      throw new SlipVerifyError('DOWNLOAD_FAILED', 'ดาวน์โหลดสลิปเพื่อตรวจสอบไม่สำเร็จ', {
        cause: error,
      });
    }
    return { blob: data, filename: path.split('/').pop() || 'slip' };
  }

  if (typeof Blob !== 'undefined' && imageOrPath instanceof Blob) {
    return { blob: imageOrPath, filename: imageOrPath.name || 'slip' };
  }
  if (imageOrPath instanceof ArrayBuffer || ArrayBuffer.isView(imageOrPath)) {
    return { blob: new Blob([imageOrPath]), filename: 'slip' };
  }
  throw new SlipVerifyError('INVALID_IMAGE', 'ชนิดข้อมูลสลิปไม่รองรับ');
}

export async function verifySlip(imageOrPath) {
  const apiKey = env('SLIPOK_API_KEY')?.trim();
  const branchId = env('SLIPOK_BRANCH_ID')?.trim();
  if (!apiKey) throw new SlipVerifyError('NOT_CONFIGURED', 'ยังไม่ได้ตั้ง SLIPOK_API_KEY');
  if (!branchId) throw new SlipVerifyError('NOT_CONFIGURED', 'ยังไม่ได้ตั้ง SLIPOK_BRANCH_ID');

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    const timeoutError = new Error('SlipOK verification timed out');
    timeoutError.name = 'TimeoutError';
    controller.abort(timeoutError);
  }, VERIFY_TIMEOUT_MS);

  try {
    const { blob, filename } = await slipBlob(imageOrPath, controller.signal);
    const form = new FormData();
    form.append('files', blob, filename);

    const response = await withinDeadline(fetch(
      `${SLIPOK_BASE_URL}/${encodeURIComponent(branchId)}`,
      {
        method: 'POST',
        headers: { 'x-authorization': apiKey },
        body: form,
        signal: controller.signal,
      },
    ), controller.signal);

    const text = await withinDeadline(response.text(), controller.signal);
    let raw;
    try {
      raw = text ? JSON.parse(text) : null;
    } catch (error) {
      throw new SlipVerifyError('INVALID_RESPONSE', 'SlipOK ตอบกลับไม่ใช่ JSON', {
        cause: error,
        raw: text.slice(0, 1000),
      });
    }

    if (!response.ok) {
      throw new SlipVerifyError('API_ERROR', `SlipOK ตอบ HTTP ${response.status}`, { raw });
    }
    return normaliseResponse(raw);
  } catch (error) {
    if (error instanceof SlipVerifyError) throw error;
    if (controller.signal.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      throw new SlipVerifyError('TIMEOUT', 'SlipOK ใช้เวลาตรวจสอบนานเกินกำหนด', { cause: error });
    }
    throw new SlipVerifyError('API_ERROR', 'เรียก SlipOK ไม่สำเร็จ', { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
