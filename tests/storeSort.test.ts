import assert from 'node:assert/strict';
import test from 'node:test';
import { sortStoresByAvailabilityAndDistance } from '../src/utils/storeSort';

const store = (name: string, isOpen: boolean, distance: number) => ({
  name,
  isOpen,
  distance,
});

test('open stores are grouped ahead of closed stores', () => {
  const sorted = sortStoresByAvailabilityAndDistance([
    store('Far Open', true, 9),
    store('Near Closed', false, 1),
    store('Near Open', true, 2),
    store('Middle Closed', false, 5),
  ]);

  assert.deepEqual(
    sorted.map((item) => item.name),
    ['Near Open', 'Far Open', 'Near Closed', 'Middle Closed']
  );
});

test('distance is the tie-breaker within the same availability group', () => {
  const sorted = sortStoresByAvailabilityAndDistance([
    store('C', true, 8),
    store('A', true, 3),
    store('B', true, 3),
  ]);

  assert.deepEqual(
    sorted.map((item) => item.name),
    ['A', 'B', 'C']
  );
});

test('stores without a known distance sort after located stores', () => {
  const sorted = sortStoresByAvailabilityAndDistance([
    { name: 'Unknown', isOpen: true },
    store('Known', true, 4),
  ]);

  assert.deepEqual(
    sorted.map((item) => item.name),
    ['Known', 'Unknown']
  );
});
