import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Address } from '../src/models/user';
import { hasUsableCoordinates, pickDeliveryAddress } from '../src/utils/deliveryLocation';

const address = (overrides: Partial<Address> = {}): Address => ({
  id: 'a',
  userId: 'u',
  label: 'Home',
  streetAddress: '1 Main Road',
  city: 'Cape Town',
  province: 'WC',
  postalCode: '8000',
  latitude: -33.9,
  longitude: 18.4,
  isDefault: false,
  ...overrides,
});

test('prefers the default saved address, then the first one', () => {
  const second = address({ id: 'second', isDefault: true });
  assert.equal(pickDeliveryAddress([address({ id: 'first' }), second])?.id, 'second');
  assert.equal(pickDeliveryAddress([address({ id: 'first' }), address({ id: 'second' })])?.id, 'first');
  assert.equal(pickDeliveryAddress([]), null);
});

test('rejects placeholder coordinates from legacy addresses', () => {
  assert.equal(hasUsableCoordinates(address()), true);
  assert.equal(hasUsableCoordinates(address({ latitude: 0, longitude: 0 })), false);
  assert.equal(hasUsableCoordinates(address({ latitude: NaN })), false);
  assert.equal(hasUsableCoordinates(null), false);
});
