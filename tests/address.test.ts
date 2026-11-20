import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatAddress,
  mapAddressRecord,
  mapAddresses,
} from '../src/utils/address';

test('maps snake_case addresses from Supabase jsonb', () => {
  const address = mapAddressRecord(
    {
      id: 'addr_1',
      user_id: 'user_1',
      label: 'Home',
      street_address: '11741 Sekwati St',
      city: 'Johannesburg',
      province: 'Gauteng',
      postal_code: '1983',
      latitude: -26.55,
      longitude: 27.86,
      is_default: true,
    },
    'fallback_user'
  );

  assert.ok(address);
  assert.equal(address.userId, 'user_1');
  assert.equal(address.streetAddress, '11741 Sekwati St');
  assert.equal(address.postalCode, '1983');
  assert.equal(address.isDefault, true);
  assert.equal(
    formatAddress(address),
    '11741 Sekwati St, Johannesburg, Gauteng, 1983'
  );
});

test('drops undefined address fragments', () => {
  const address = mapAddressRecord({
    label: 'Work',
    streetAddress: undefined,
    street_address: 'undefined',
    city: '',
    postal_code: null,
  });

  assert.ok(address);
  assert.equal(address.streetAddress, '');
  assert.equal(formatAddress(address), 'Work');
});

test('maps a list of camelCase and snake_case addresses', () => {
  const addresses = mapAddresses(
    [
      { id: 'a', label: 'A', streetAddress: '1 Main Rd', city: 'Cape Town', isDefault: false },
      { id: 'b', label: 'B', street_address: '2 Main Rd', city: 'Durban', is_default: true },
    ],
    'user_1'
  );

  assert.equal(addresses.length, 2);
  assert.equal(addresses[0].userId, 'user_1');
  assert.equal(addresses[1].isDefault, true);
});
