import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '../src/models/order';
import { activeDeliveryNavigation, partitionOrders } from '../src/utils/deliveryFlow';

function makeOrder(id: string, status: string, updatedAt: string): Order {
  return {
    id,
    status,
    paymentStatus: 'completed',
    createdAt: updatedAt,
    updatedAt,
  } as Order;
}

test('single active delivery opens its tracking screen', () => {
  const target = activeDeliveryNavigation([makeOrder('order-1', 'out_for_delivery', '2026-11-27T10:00:00Z')]);
  assert.deepEqual(target, { kind: 'order', orderId: 'order-1' });
});

test('multiple or zero active deliveries go to the Orders screen', () => {
  assert.deepEqual(activeDeliveryNavigation([]), { kind: 'orders' });
  assert.deepEqual(
    activeDeliveryNavigation([
      makeOrder('order-1', 'out_for_delivery', '2026-11-27T10:00:00Z'),
      makeOrder('order-2', 'arrived', '2026-11-27T09:00:00Z'),
    ]),
    { kind: 'orders' },
  );
});

test('delivered orders remain in the history list', () => {
  const active = makeOrder('order-1', 'out_for_delivery', '2026-11-27T10:00:00Z');
  const delivered = makeOrder('order-2', 'delivered', '2026-11-27T09:00:00Z');
  const result = partitionOrders([delivered, active]);

  assert.deepEqual(result.activeOrders.map((order) => order.id), ['order-1']);
  assert.deepEqual(result.pastOrders.map((order) => order.id), ['order-2']);
  assert.deepEqual(result.listOrders.map((order) => order.id), ['order-1', 'order-2']);
});
