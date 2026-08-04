import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extendPremiumUntil,
  generateRefCode,
  insertPaymentWithRetry,
} from '../create-payment.js';
import { ownsSlipPath } from '../submit-slip.js';

test('generates LQ-XXXX codes without ambiguous characters', () => {
  const refCode = generateRefCode(() => 0);
  assert.match(refCode, /^LQ-[A-Z2-9]{4}$/);
  assert.ok(!/[01OI]/.test(refCode));
});

test('retries a unique collision and returns the successful payment', async () => {
  const attempts = [];
  let codeNumber = 0;
  const result = await insertPaymentWithRetry({
    insertAttempt: async (refCode) => {
      attempts.push(refCode);
      if (attempts.length === 1) return { data: null, error: { code: '23505', message: 'duplicate key' } };
      return { data: { id: 'payment-2', ref_code: refCode, status: 'pending' }, error: null };
    },
    findOpenPayment: async () => ({ data: null, error: null }),
    generate: () => `LQ-${String.fromCharCode(65 + codeNumber++)}BCD`,
  });

  assert.equal(result.data.id, 'payment-2');
  assert.equal(result.reused, false);
  assert.equal(attempts.length, 2);
  assert.notEqual(attempts[0], attempts[1]);
});

test('reuses an open payment when the insert loses the race on the partial unique index', async () => {
  const existing = { id: 'payment-1', ref_code: 'LQ-ABCD', status: 'submitted' };
  const result = await insertPaymentWithRetry({
    insertAttempt: async () => ({ data: null, error: { code: '23505' } }),
    findOpenPayment: async () => ({ data: existing, error: null }),
  });

  assert.deepEqual(result.data, existing);
  assert.equal(result.reused, true);
});

test('accepts only a slip path inside the caller folder', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  assert.equal(ownsSlipPath(`${userId}/receipt.png`, userId), true);
  assert.equal(ownsSlipPath(`${userId}-other/receipt.png`, userId), false);
  assert.equal(ownsSlipPath(`other/${userId}/receipt.png`, userId), false);
});

test('extends from the later of now and the existing premium expiry', () => {
  const now = '2026-08-04T10:00:00.000Z';
  assert.equal(
    extendPremiumUntil('2026-09-15T10:00:00.000Z', now),
    '2026-10-15T10:00:00.000Z',
  );
  assert.equal(
    extendPremiumUntil('2026-07-15T10:00:00.000Z', now),
    '2026-09-04T10:00:00.000Z',
  );
});
