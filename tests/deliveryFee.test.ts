import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveryFeeHelper } from '../src/utils/deliveryFeeHelper';

test('fee tiers match the server function', () => {
  assert.equal(deliveryFeeHelper.calculateFee(0), 15);
  assert.equal(deliveryFeeHelper.calculateFee(999), 15);
  assert.equal(deliveryFeeHelper.calculateFee(1000), 23);
  assert.equal(deliveryFeeHelper.calculateFee(3000), 23);
  assert.equal(deliveryFeeHelper.calculateFee(3001), 30);
  assert.equal(deliveryFeeHelper.calculateFee(5000), 30);
  assert.equal(deliveryFeeHelper.calculateFee(8000), 45);
  assert.equal(deliveryFeeHelper.calculateFee(10000), 60);
  assert.equal(deliveryFeeHelper.calculateFee(14000), 80);
  assert.equal(deliveryFeeHelper.calculateFee(20000), 100);
});

test('beyond 20km delivery is unavailable', () => {
  assert.equal(deliveryFeeHelper.calculateFee(20001), -1);
});
