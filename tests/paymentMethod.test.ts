import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkoutPaymentMethodFromOrderLabel,
  getPaymentPollingPlan,
  needsApprovalPolling,
  toOrderPaymentMethod,
  toPaymentMethodCode,
} from '../src/utils/paymentMethod';

test('checkout methods map to the stored order and payment values', () => {
  assert.equal(toOrderPaymentMethod('card'), 'Card');
  assert.equal(toOrderPaymentMethod('instantEft'), 'Instant EFT');
  assert.equal(toOrderPaymentMethod('capitecPay'), 'Capitec Pay');
  assert.equal(toOrderPaymentMethod('cashOnDelivery'), 'Cash on Delivery');

  assert.equal(toPaymentMethodCode('card'), 'card');
  assert.equal(toPaymentMethodCode('instantEft'), 'instantEft');
  assert.equal(toPaymentMethodCode('capitecPay'), 'capitecPay');
  assert.equal(toPaymentMethodCode('cashOnDelivery'), 'cashOnDelivery');
});

test('an unpaid order reuses the payment method chosen at checkout', () => {
  assert.equal(checkoutPaymentMethodFromOrderLabel('Card'), 'card');
  assert.equal(checkoutPaymentMethodFromOrderLabel('Instant EFT'), 'instantEft');
  assert.equal(checkoutPaymentMethodFromOrderLabel('EFT'), 'instantEft');
  assert.equal(checkoutPaymentMethodFromOrderLabel('Capitec Pay'), 'capitecPay');
  assert.equal(checkoutPaymentMethodFromOrderLabel('Cash on Delivery'), 'cashOnDelivery');
  assert.equal(checkoutPaymentMethodFromOrderLabel(undefined), null);
});

test('only Capitec Pay needs approval polling', () => {
  assert.equal(needsApprovalPolling('capitecPay'), true);
  assert.equal(needsApprovalPolling('card'), false);
  assert.equal(needsApprovalPolling('instantEft'), false);
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
  for (const method of ['card', 'instantEft'] as const) {
    assert.deepEqual(getPaymentPollingPlan(method, 0), {
      firstDelayMs: 3_000,
      intervalMs: 5_000,
      maxAttempts: 60,
    });
  }
});
