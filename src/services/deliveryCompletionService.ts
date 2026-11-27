import { supabase } from '../config/supabaseClient';
import type { Order } from '../models/order';
import { orderService } from './orderService';

export interface DeliveryCompletion {
  orderId: string;
  orderNumber?: string;
  storeName?: string;
}

type Listener = (completion: DeliveryCompletion) => void;

const listeners = new Set<Listener>();
// One order can produce several events (status, assignment, payment updates).
// Remember which ones have already been celebrated so the modal never repeats.
const announcedOrders = new Set<string>();

/** Emits once per order, from either the tracking screen or the app-wide watcher. */
export function emitDeliveryCompleted(order: Order): void {
  if (!order?.id || order.status !== 'delivered') return;
  if (announcedOrders.has(order.id)) return;
  announcedOrders.add(order.id);

  const completion: DeliveryCompletion = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    storeName: order.storeName,
  };

  listeners.forEach((listener) => {
    try {
      listener(completion);
    } catch (error) {
      console.warn('Delivery completion listener failed:', error);
    }
  });
}

export function onDeliveryCompleted(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * App-wide watcher. The customer may leave the tracking screen before the
 * driver marks the order delivered, so this listens to every update for the
 * signed-in customer and surfaces the same gratitude moment wherever they are.
 */
export function startDeliveryCompletionWatch(userId: string): () => void {
  const channel = supabase
    .channel(`delivery_completion_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown> | null;
        const orderId = typeof row?.id === 'string' ? row.id : null;
        if (!orderId) return;

        // Reload through the canonical mapper: replica identity only guarantees
        // the primary key, and the user-scoped read also rechecks RLS.
        void orderService.getOrderById(orderId).then((order) => {
          if (order?.userId === userId && order.status === 'delivered') {
            emitDeliveryCompleted(order);
          }
        }).catch((error) => {
          console.warn('Delivery completion refresh failed:', error);
        });
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
