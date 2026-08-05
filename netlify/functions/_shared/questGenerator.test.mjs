// เทสตรรกะ "พรีเมียมที่ยังไม่หมดอายุ" — ต้องให้ผลตรงกับ isPremiumActive ใน create-payment.js
// และกับ public.is_premium_active() ใน SQL (migration 2026-08-05) ทั้งสามที่ต้องตัดสินเหมือนกัน
import assert from 'node:assert/strict';
import test from 'node:test';
import { isPremiumActive } from './questGenerator.js';

const NOW = new Date('2026-08-05T12:00:00.000Z');

test('พรีเมียมที่ยังไม่หมดอายุ = ใช้สิทธิ์ได้', () => {
  assert.equal(
    isPremiumActive({ is_premium: true, premium_until: '2026-09-05T12:00:00.000Z' }, NOW),
    true
  );
});

test('พรีเมียมหมดอายุแล้ว = หมดสิทธิ์ (ไม่มีอะไรเซ็ต is_premium กลับเป็น false)', () => {
  assert.equal(
    isPremiumActive({ is_premium: true, premium_until: '2026-07-05T12:00:00.000Z' }, NOW),
    false
  );
});

test('premium_until เป็น null = ไม่นับว่าใช้งานอยู่', () => {
  assert.equal(isPremiumActive({ is_premium: true, premium_until: null }, NOW), false);
});

test('is_premium เป็น false = หมดสิทธิ์ แม้ premium_until ยังอยู่ในอนาคต', () => {
  assert.equal(
    isPremiumActive({ is_premium: false, premium_until: '2026-09-05T12:00:00.000Z' }, NOW),
    false
  );
});

test('หมดอายุพอดีวินาทีนี้ = หมดสิทธิ์ (เทียบแบบ strict >)', () => {
  assert.equal(
    isPremiumActive({ is_premium: true, premium_until: NOW.toISOString() }, NOW),
    false
  );
});

test('profile เป็น null/undefined ไม่ทำให้พัง', () => {
  assert.equal(isPremiumActive(null, NOW), false);
  assert.equal(isPremiumActive(undefined, NOW), false);
});
