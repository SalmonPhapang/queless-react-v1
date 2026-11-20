import assert from 'node:assert/strict';
import test from 'node:test';
import { settlementCalculator } from '../src/utils/settlementCalculator';

test('store share is the base subtotal when there is no discount', () => {
  const result = settlementCalculator.calculate({
    total: 172,
    baseSubtotal: 133.33,
    customerSubtotal: 150,
    deliveryFee: 15,
    discount: 0,
    serviceFee: 7,
  });

  assert.equal(result.storeShare, 133.33);
  assert.equal(result.quelessShare, 38.67);
  assert.equal(result.platformMargin, 16.67);
});

test('discounts beyond the platform share are absorbed by the vendor', () => {
  const result = settlementCalculator.calculate({
    total: 100,
    baseSubtotal: 120,
    customerSubtotal: 130,
    deliveryFee: 10,
    discount: 50,
    serviceFee: 7,
  });

  // Platform gross = margin(10) + delivery(10) + service(7) = 27
  assert.equal(result.platformDiscountAbsorbed, 27);
  assert.equal(result.vendorDiscountAbsorbed, 23);
  assert.equal(result.storeShare, 97);
  assert.equal(result.quelessShare, 3);
});

test('store share never exceeds the order total', () => {
  const result = settlementCalculator.calculate({
    total: 50,
    baseSubtotal: 200,
    customerSubtotal: 200,
    deliveryFee: 0,
    discount: 0,
    serviceFee: 0,
  });

  assert.equal(result.storeShare, 50);
  assert.equal(result.quelessShare, 0);
});
