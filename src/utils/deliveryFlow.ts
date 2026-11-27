import type { Order } from '../models/order';
import { canTrackOrder } from '../models/statuses';

export type DeliveryNavigationTarget =
  | { kind: 'order'; orderId: string }
  | { kind: 'orders' };

function recency(order: Order): number {
  const raw = order.updatedAt || order.createdAt;
  const parsed = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * The active-delivery banner has one job: get the customer to the right place.
 * With a single delivery that is its tracking screen. With two or more, sending
 * them to the "most recent" one hides the others, so the Orders list is the
 * correct destination.
 */
export function activeDeliveryNavigation(activeOrders: Order[]): DeliveryNavigationTarget {
  if (activeOrders.length === 1) {
    return { kind: 'order', orderId: activeOrders[0].id };
  }
  return { kind: 'orders' };
}

/** Active deliveries first; every historical order (including delivered) stays visible. */
export function partitionOrders(orders: Order[]): {
  activeOrders: Order[];
  pastOrders: Order[];
  listOrders: Order[];
} {
  const activeOrders = orders.filter(canTrackOrder).sort((a, b) => recency(b) - recency(a));
  const pastOrders = orders.filter((order) => !canTrackOrder(order)).sort((a, b) => recency(b) - recency(a));
  return { activeOrders, pastOrders, listOrders: [...activeOrders, ...pastOrders] };
}
