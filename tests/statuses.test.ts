import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ORDER_STATUS_TRANSITIONS,
  isValidStatusTransition,
  orderStatusFromDatabaseValue,
  orderStatusHelpers,
  paymentStatusFromDatabaseValue,
} from '../src/models/core/statuses';

test('canonical and legacy order statuses parse', () => {
  assert.equal(orderStatusFromDatabaseValue('awaiting_payment'), 'awaiting_payment');
  assert.equal(orderStatusFromDatabaseValue('awaitingStoreAcceptance'), 'awaiting_store_acceptance');
  assert.equal(orderStatusFromDatabaseValue('confirmed'), 'awaiting_store_acceptance');
  assert.equal(orderStatusFromDatabaseValue('picked_up'), 'out_for_delivery');
  assert.equal(orderStatusFromDatabaseValue('on_the_way'), 'out_for_delivery');
  assert.equal(orderStatusFromDatabaseValue('in_progress'), 'preparing');
  assert.equal(orderStatusFromDatabaseValue('customer_location'), 'arrived');
  assert.equal(orderStatusFromDatabaseValue('completed'), 'delivered');
  assert.equal(orderStatusFromDatabaseValue(undefined), 'pending');
});

test('payment statuses map Paystack and order values', () => {
  assert.equal(paymentStatusFromDatabaseValue('paid'), 'completed');
  assert.equal(paymentStatusFromDatabaseValue('awaitingPayment'), 'awaiting_payment');
  assert.equal(paymentStatusFromDatabaseValue('success'), 'completed');
  assert.equal(paymentStatusFromDatabaseValue('partially_refunded'), 'partially_refunded');
});

test('order transitions follow the shared state machine', () => {
  assert.equal(
    isValidStatusTransition(ORDER_STATUS_TRANSITIONS, 'pending', 'awaiting_store_acceptance'),
    true
  );
  assert.equal(isValidStatusTransition(ORDER_STATUS_TRANSITIONS, 'delivered', 'cancelled'), false);
  assert.equal(
    isValidStatusTransition(ORDER_STATUS_TRANSITIONS, 'out_for_delivery', 'arrived'),
    true
  );
});

test('terminal order statuses match the shared set', () => {
  assert.equal(orderStatusHelpers.isTerminal('delivered'), true);
  assert.equal(orderStatusHelpers.isTerminal('cancelled'), true);
  assert.equal(orderStatusHelpers.isTerminal('out_for_delivery'), false);
});
