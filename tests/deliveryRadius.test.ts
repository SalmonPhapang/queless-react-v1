import assert from 'node:assert/strict';
import test from 'node:test';
import { getStoreDistanceKm, isBeyondDeliveryRadius } from '../src/utils/deliveryRadius';

const store = {
  id: 'store-1',
  name: 'Test Store',
  location: '-25.7479, 28.2293',
  coordinates: { latitude: -25.7479, longitude: 28.2293 },
  distance: undefined,
};

test('isBeyondDeliveryRadius only blocks over 20km', () => {
  assert.equal(isBeyondDeliveryRadius(undefined), false);
  assert.equal(isBeyondDeliveryRadius(20), false);
  assert.equal(isBeyondDeliveryRadius(20.1), true);
  assert.equal(isBeyondDeliveryRadius(25), true);
});

test('measures distance from the active delivery point', () => {
  const samePoint = getStoreDistanceKm(store, {
    latitude: -25.7479,
    longitude: 28.2293,
  });
  assert.equal(samePoint, 0);

  const farPoint = getStoreDistanceKm(store, {
    latitude: -26.8,
    longitude: 28.2,
  });
  assert.ok(typeof farPoint === 'number');
  assert.ok(farPoint! > 20);
  assert.equal(isBeyondDeliveryRadius(farPoint), true);
});

test('keeps an already measured distance', () => {
  assert.equal(
    getStoreDistanceKm({ ...store, distance: 12.3 }, { latitude: 0, longitude: 0 }),
    12.3
  );
});
