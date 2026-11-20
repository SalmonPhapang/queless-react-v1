import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
