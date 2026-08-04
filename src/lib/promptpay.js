// สร้าง payload ของ QR พร้อมเพย์เอง ฝั่งเบราว์เซอร์ — ไม่มี dependency ไม่มี API เสียเงิน (spec §6.3 ข้อ 3)
//
// รูปแบบคือ EMVCo QRCPS (Merchant-Presented Mode) ซึ่งเป็น TLV ล้วน ๆ:
//   [tag 2 หลัก][length 2 หลัก][value ยาวเท่า length] ต่อกันไปเรื่อย ๆ แล้วปิดท้ายด้วย checksum
// ลำดับ tag ยึดตามที่ไลบรารี promptpay-qr ใช้ (00,01,29,58,53,54,63) เพราะเป็นชุดที่แอพธนาคารไทยสแกนผ่านจริง
//
// tag ที่ใช้:
//   00 = Payload Format Indicator ("01")
//   01 = Point of Initiation — "11" static (ไม่ระบุยอด) / "12" dynamic (ระบุยอด) ★ เราใส่ยอดเสมอ = 12
//   29 = Merchant Account Information ของพร้อมเพย์ (ข้างในมี TLV ซ้อน: 00=AID, 01=เบอร์ / 02=เลขบัตร ปชช. / 03=e-wallet)
//   58 = Country Code ("TH")
//   53 = Transaction Currency ("764" = THB ตาม ISO 4217)
//   54 = Transaction Amount (ทศนิยม 2 ตำแหน่ง เช่น "39.00") — ใส่ไว้ผู้จ่ายจะไม่ต้องพิมพ์ยอดเอง = โอนผิดยอดไม่ได้
//   63 = CRC (CRC-16/CCITT-FALSE ของทุกอย่างก่อนหน้า + "6304")

const AID_PROMPTPAY = 'A000000677010111';

const TAG = {
  PAYLOAD_FORMAT: '00',
  POI_METHOD: '01',
  MERCHANT_PROMPTPAY: '29',
  COUNTRY: '58',
  CURRENCY: '53',
  AMOUNT: '54',
  CRC: '63',
};

// TLV 1 ก้อน — length เป็นเลข 2 หลักเสมอ (ค่าที่ยาวเกิน 99 ตัวอักษรไม่มีในเคสพร้อมเพย์)
function tlv(tag, value) {
  const v = String(value);
  return tag + String(v.length).padStart(2, '0') + v;
}

/**
 * CRC-16/CCITT-FALSE — poly 0x1021, init 0xFFFF, ไม่กลับบิต, ไม่ XOR ตอนออก
 * (มาตรฐาน EMVCo ระบุตัวนี้ตรง ๆ — อย่าไปใช้ CRC-16 ตัวอื่นเด็ดขาด แอพธนาคารจะฟ้อง QR ไม่ถูกต้อง)
 */
export function crc16ccittFalse(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i += 1) {
    crc ^= (str.charCodeAt(i) & 0xff) << 8;
    for (let b = 0; b < 8; b += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

/**
 * จัดรูปเลขพร้อมเพย์ให้ตรงสเปก
 * - เบอร์มือถือ 10 หลัก -> ตัด 0 หน้าออก เติม 66 แล้ว pad ซ้ายด้วย 0 ให้ครบ 13 หลัก (0812345678 -> 0066812345678)
 * - เลขบัตรประชาชน/เลขผู้เสียภาษี 13 หลัก -> ใช้ตามนั้น
 * - e-wallet 15 หลัก -> ใช้ตามนั้น
 */
export function formatPromptPayTarget(rawTarget) {
  const digits = String(rawTarget ?? '').replace(/\D/g, '');
  if (digits.length === 15) return { subTag: '03', value: digits }; // e-wallet id
  if (digits.length === 13) return { subTag: '02', value: digits }; // เลขบัตรประชาชน / เลขผู้เสียภาษี

  let mobile = null;
  if (digits.length === 11 && digits.startsWith('66')) mobile = digits.slice(2); // 66812345678
  else if (digits.length === 10 && digits.startsWith('0')) mobile = digits.slice(1); // 0812345678
  else if (digits.length === 9) mobile = digits; // 812345678
  if (mobile) return { subTag: '01', value: ('0000000000000' + '66' + mobile).slice(-13) };

  return null; // รูปแบบที่เราไม่รู้จัก — ผู้เรียกต้องจัดการเอง (อย่าเดา เดี๋ยวเงินไปผิดบัญชี)
}

/**
 * สร้าง payload สำหรับ QR พร้อมเพย์
 * @param {string} target เบอร์มือถือ / เลขบัตรประชาชน / e-wallet id ของผู้รับเงิน
 * @param {{ amount?: number }} opts amount = จำนวนเงินบาท (ใส่แล้วผู้จ่ายไม่ต้องพิมพ์ยอดเอง)
 * @returns {string|null} payload พร้อมเอาไปเข้ารหัสเป็น QR (null = target ไม่ถูกรูปแบบ)
 */
export function buildPromptPayPayload(target, { amount } = {}) {
  const formatted = formatPromptPayTarget(target);
  if (!formatted) return null;

  const hasAmount = Number.isFinite(amount) && amount > 0;
  const merchant = tlv('00', AID_PROMPTPAY) + tlv(formatted.subTag, formatted.value);

  let payload =
    tlv(TAG.PAYLOAD_FORMAT, '01') +
    tlv(TAG.POI_METHOD, hasAmount ? '12' : '11') +
    tlv(TAG.MERCHANT_PROMPTPAY, merchant) +
    tlv(TAG.COUNTRY, 'TH') +
    tlv(TAG.CURRENCY, '764');
  if (hasAmount) payload += tlv(TAG.AMOUNT, amount.toFixed(2));

  // checksum คิดจาก "ทุกอย่างก่อนหน้า + tag 63 + length 04" แล้วค่อยเอาผลลัพธ์ต่อท้าย
  const crcInput = payload + TAG.CRC + '04';
  const crc = crc16ccittFalse(crcInput).toString(16).toUpperCase().padStart(4, '0');
  return crcInput + crc;
}
