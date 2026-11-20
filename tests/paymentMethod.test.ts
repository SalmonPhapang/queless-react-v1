import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPaymentPollingPlan,
  needsApprovalPolling,
  toOrderPaymentMethod,
  toPaymentMethodCode,
} from '../src/utils/paymentMethod';

test('checkout methods map to the stored order and payment values', () => {
  assert.equal(toOrderPaymentMethod('card'), 'Instant EFT');
  assert.equal(toOrderPaymentMethod('capitecPay'), 'Capitec Pay');
  assert.equal(toOrderPaymentMethod('cashOnDelivery'), 'Cash on Delivery');

  assert.equal(toPaymentMethodCode('card'), 'instantEft');
  assert.equal(toPaymentMethodCode('capitecPay'), 'capitecPay');
  assert.equal(toPaymentMethodCode('cashOnDelivery'), 'cashOnDelivery');
});

test('only Capitec Pay needs approval polling', () => {
  assert.equal(needsApprovalPolling('capitecPay'), true);
  assert.equal(needsApprovalPolling('card'), false);
  assert.equal(needsApprovalPolling('cashOnDelivery'), false);
  assert.equal(needsApprovalPolling(undefined), false);
});

test('Capitec Pay waits 90 seconds then polls at least 10 seconds apart', () => {
  assert.deepEqual(getPaymentPollingPlan('capitecPay', 0), {
    firstDelayMs: 90_000,
    intervalMs: 10_000,
    maxAttempts: 30,
  });

  assert.deepEqual(getPaymentPollingPlan('capitecPay', 120_000), {
    firstDelayMs: 1_000,
    intervalMs: 10_000,
    maxAttempts: 30,
  });
});

test('other payment methods confirm quickly without a long initial wait', () => {
  assert.deepEqual(getPaymentPollingPlan('card', 0), {
    firstDelayMs: 3_000,
    intervalMs: 5_000,
    maxAttempts: 60,
  });
});
