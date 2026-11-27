import { supabase } from '../config/supabaseClient';
import { Order, OrderItem } from '../models/order';
import {
  OrderStatus,
  PaymentStatus,
  canTrackOrder,
  orderStatusFromDatabaseValue,
  paymentStatusFromDatabaseValue,
} from '../models/statuses';
import { DriverInfo, driverInfoFromJson, trackingUpdateFromJson } from '../models/core/orderCommon';
import { Address } from '../models/user';
import { emptyAddress, mapAddressRecord } from '../utils/address';
import {
  COD_UNLOCK_PAID_ORDER_COUNT,
  COD_UNLOCK_PAYMENT_METHOD_LABELS,
  getCodUnlockProgress,
  type CodUnlockProgress,
} from '../utils/paymentMethod';

export interface CreateOrderParams {
  userId: string;
  storeId: string;
  storeName?: string;
  /** Cart items, already priced by the cart service. */
  items: OrderItem[];
  subtotal: number;
  baseSubtotal: number;
  basePriceAdjustment?: number;
  deliveryFee: number;
  discount: number;
  total: number;
  serviceFee: number;
  storeShare: number;
  quelessShare: number;
  deliveryAddress: Address;
  /** Canonical label persisted on orders.payment_method, e.g. 'Card' or 'Instant EFT'. */
  paymentMethod: string;
  orderType: 'Food' | 'Liquor';
  promoCodeId?: string;
  scheduledDelivery?: string;
  aiAssisted?: boolean;
  aiConversationId?: string;
}

export class OrderCreationError extends Error {
  readonly statusCode: string;

  constructor(statusCode: string, message: string) {
    super(message);
    this.name = 'OrderCreationError';
    this.statusCode = statusCode;
  }
}

/** A single GPS fix from `driver_locations` (the driver app's live presence row). */
export interface DriverLocationFix {
  latitude: number;
  longitude: number;
  /** ISO-8601 time of the fix. */
  updatedAt?: string;
}

export const orderService = {
  /**
   * Server-authoritative order creation.
   *
   * Calls create_order_geo_guard, which re-checks delivery eligibility, derives
   * the order number, and inserts the order. The client never inserts into
   * `orders` directly and never invents an order id — if the server rejects the
   * order, checkout fails instead of continuing with a fake order.
   */
  async createOrder(params: CreateOrderParams): Promise<Order> {
    const rpcArgs: Record<string, unknown> = {
      p_user_id: params.userId,
      p_store_id: params.storeId,
      p_delivery_latitude: params.deliveryAddress.latitude,
      p_delivery_longitude: params.deliveryAddress.longitude,
      p_items: params.items.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        product_image_url: item.productImageUrl,
        quantity: item.quantity,
        price_per_unit: item.pricePerUnit,
        base_price_per_unit: item.basePricePerUnit,
        base_price_adjustment: item.basePriceAdjustment,
        total_price: item.totalPrice,
        selected_options: item.selectedOptions,
      })),
      p_subtotal: params.subtotal,
      p_delivery_fee: params.deliveryFee,
      p_discount: params.discount,
      p_total: params.total,
      p_payment_method: params.paymentMethod,
      p_payment_status: 'pending',
      p_scheduled_delivery: params.scheduledDelivery ?? null,
      p_promo_code_id: params.promoCodeId ?? null,
      p_type: params.orderType,
      p_base_subtotal: params.baseSubtotal,
      p_base_price_adjustment: params.basePriceAdjustment ?? 0,
      p_store_share: params.storeShare,
      p_queless_share: params.quelessShare,
      p_service_fee: params.serviceFee,
      p_ai_assisted: params.aiAssisted ?? false,
      p_ai_conversation_id: params.aiConversationId ?? null,
      p_delivery_address: params.deliveryAddress,
    };

    // The deployed guard now accepts `p_delivery_address`. Keep the PGRST202
    // fallback for older environments and persist the address separately there.
    let { data, error } = await supabase.rpc(
      'create_order_geo_guard',
      rpcArgs as never
    );
    let addressSavedByRpc = true;

    if (error?.code === 'PGRST202') {
      const { p_delivery_address: _address, ...legacyArgs } = rpcArgs;
      const retry = await supabase.rpc(
        'create_order_geo_guard',
        legacyArgs as never
      );
      data = retry.data;
      error = retry.error;
      addressSavedByRpc = false;
    }

    if (error) {
      throw new OrderCreationError('RPC_FAILED', error.message || 'Could not create the order.');
    }

    const rows = (data as Array<Record<string, any>> | null) ?? [];
    const row = rows[0];
    if (!row?.order_id) {
      throw new OrderCreationError(
        (row?.status_code as string) || 'UNKNOWN',
        (row?.user_message as string) || 'This order could not be placed.'
      );
    }
    if ((row.status_code as string) !== 'OK') {
      throw new OrderCreationError(
        (row.status_code as string) || 'UNKNOWN',
        (row.user_message as string) || 'This order could not be placed.'
      );
    }

    const orderId = row.order_id as string;

    if (!addressSavedByRpc) {
      const { error: addressError } = await supabase
        .from('orders')
        .update({ delivery_address: params.deliveryAddress })
        .eq('id', orderId);
      if (addressError) {
        console.warn('Could not persist delivery address on order:', addressError.message);
      }
    }

    const created = await this.getOrderById(orderId);
    if (!created) {
      throw new OrderCreationError(
        'READ_FAILED',
        'Your order was created but could not be loaded. Check your Orders tab before paying again.'
      );
    }
    return created;
  },

  /**
   * Cash on delivery unlocks after three completed orders paid by Card,
   * Instant EFT, or Capitec Pay (legacy EFT labels included) combined.
   * Cash orders never count towards the requirement.
   */
  async getCodUnlockProgress(userId: string): Promise<CodUnlockProgress> {
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('payment_status', 'completed')
      .in('payment_method', [...COD_UNLOCK_PAYMENT_METHOD_LABELS])
      .limit(COD_UNLOCK_PAID_ORDER_COUNT);

    if (error) {
      console.warn('Could not check prior paid orders:', error.message);
      return getCodUnlockProgress(0);
    }
    return getCodUnlockProgress(Array.isArray(data) ? data.length : 0);
  },

  async getUserOrders(userId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, stores(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Fetch Orders Error:', error.message);
      return [];
    }
    if (!data) return [];

    const drivers = await fetchDriversForOrders(data.map((item) => item.id));
    return data.map((item) =>
      this.mapOrderRecord(item, item.stores?.name, drivers.get(item.id))
    );
  },

  /**
   * Paid, non-terminal orders. Shared by the Orders tab and Home screen so
   * "active deliveries" always means the same thing as "can track this order".
   */
  async getActiveOrders(userId: string): Promise<Order[]> {
    const orders = await this.getUserOrders(userId);
    return orders.filter(canTrackOrder);
  },

  async getOrderById(orderId: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, stores(name)')
      .eq('id', orderId)
      .single();

    if (error || !data) return null;
    const driver = await fetchDriverForOrder(orderId);
    return this.mapOrderRecord(data, data.stores?.name, driver);
  },

  /**
   * The driver app publishes GPS to `driver_locations` every few seconds while
   * a delivery is live. `get_driver_for_order` only carries the assignment's
   * last snapshot, so tracking also reads this row to avoid a stale/hidden pin.
   */
  async getLiveDriverLocation(driverId: string): Promise<DriverLocationFix | null> {
    const { data, error } = await supabase
      .from('driver_locations')
      .select('current_lat, current_lng, last_location_update')
      .eq('driver_id', driverId)
      .maybeSingle();

    if (error) {
      console.warn('Fetch live driver location error:', error.message);
      return null;
    }
    return locationFixFromRow(data);
  },

  /** Realtime updates for the live driver pin on the tracking screen. */
  subscribeToDriverLocation(
    driverId: string,
    callback: (fix: DriverLocationFix) => void
  ) {
    const channel = supabase
      .channel(`driver_location_${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const fix = locationFixFromRow(payload.new as Record<string, unknown> | null);
          if (fix) callback(fix);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async cancelOrder(orderId: string): Promise<boolean> {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) throw error;
    return true;
  },

  /**
   * Reflect a settled payment on the order (cash on delivery, and the dev-mode
   * auto-completion parity with the Flutter app). Paystack card/EFT payments
   * are settled server-side by verify-paystack-split / the webhook instead.
   */
  async syncOrderAfterPayment(
    orderId: string,
    paymentStatus: PaymentStatus,
    userId?: string
  ): Promise<void> {
    const paid = paymentStatus === 'completed';
    let query = supabase
      .from('orders')
      .update({
        payment_status: paid ? 'completed' : paymentStatus,
        status: paid ? 'awaiting_store_acceptance' : 'awaiting_payment',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);
    if (userId) query = query.eq('user_id', userId);

    const { error } = await query;
    if (error) {
      console.warn('Order payment sync warning:', error.message);
    }
  },

  subscribeToOrderUpdates(orderId: string, callback: (order: Order) => void) {
    // The realtime row only carries the changed table's columns; driver data
    // lives in driver_assignments, so reload the full order through the
    // RPC-backed mapper instead of mapping the payload alone.
    const refresh = () => {
      void this.getOrderById(orderId).then((updated) => {
        if (updated) callback(updated);
      });
    };

    const channel = supabase
      .channel(`order_${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        refresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_assignments',
          filter: `order_id=eq.${orderId}`,
        },
        refresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  mapOrderRecord(
    data: any,
    storeName?: string,
    driverRow?: DriverAssignmentRow | null
  ): Order {
    const deliveryAddress: Address =
      mapAddressRecord(data.delivery_address, data.user_id) ??
      emptyAddress(data.user_id);

    const driver = mapDriverInfo(driverRow);

    return {
      id: data.id,
      orderNumber: data.order_number || data.id?.substring(0, 8),
      userId: data.user_id,
      storeId: data.store_id,
      storeName: storeName || data.store_name || 'Store',
      items: data.items || [],
      subtotal: Number(data.subtotal || 0),
      deliveryFee: Number(data.delivery_fee || 0),
      discount: Number(data.discount || 0),
      total: Number(data.total || 0),
      status: orderStatusFromDatabaseValue(data.status) as OrderStatus,
      paymentStatus: paymentStatusFromDatabaseValue(data.payment_status) as PaymentStatus,
      paymentMethod: data.payment_method || 'Card',
      deliveryAddress,
      createdAt: data.created_at || new Date().toISOString(),
      updatedAt: data.updated_at || new Date().toISOString(),
      trackingUpdates: Array.isArray(data.tracking_updates)
        ? data.tracking_updates.map((update: Record<string, unknown>) =>
            trackingUpdateFromJson(update)
          )
        : [],
      aiAssisted: data.ai_assisted,
      aiConversationId: data.ai_conversation_id,
      driverId: driverRow?.driver_id ?? undefined,
      driver,
    };
  },
};

interface DriverAssignmentRow {
  order_id: string;
  driver_id: string;
  driver_full_name: string | null;
  driver_contact_number: string | null;
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
}

/** Latest assignment + driver profile for one order (get_driver_for_order). */
async function fetchDriverForOrder(
  orderId: string
): Promise<DriverAssignmentRow | null> {
  const { data, error } = await supabase.rpc('get_driver_for_order', {
    p_order_id: orderId,
  });
  if (error) {
    console.warn('Fetch Driver Error:', error.message);
    return null;
  }
  const rows = (data as DriverAssignmentRow[] | null) ?? [];
  return rows[0] ?? null;
}

/** Latest assignment per order for a batch of orders (get_drivers_for_orders). */
async function fetchDriversForOrders(
  orderIds: string[]
): Promise<Map<string, DriverAssignmentRow>> {
  const drivers = new Map<string, DriverAssignmentRow>();
  if (orderIds.length === 0) return drivers;

  const { data, error } = await supabase.rpc('get_drivers_for_orders', {
    p_order_ids: orderIds,
  });
  if (error) {
    console.warn('Fetch Drivers Error:', error.message);
    return drivers;
  }

  for (const row of (data as DriverAssignmentRow[] | null) ?? []) {
    // The RPC sorts newest assignment first; keep one row per order.
    if (!drivers.has(row.order_id)) drivers.set(row.order_id, row);
  }
  return drivers;
}

function locationFixFromRow(
  row: Record<string, unknown> | null | undefined
): DriverLocationFix | null {
  const latitude = toFiniteNumber(row?.current_lat);
  const longitude = toFiniteNumber(row?.current_lng);
  if (latitude == null || longitude == null) return null;

  const rawTimestamp = row?.last_location_update;
  return {
    latitude,
    longitude,
    updatedAt: typeof rawTimestamp === 'string' ? rawTimestamp : undefined,
  };
}

/**
 * Build the shared DriverInfo shape from a get_driver_for_order row.
 *
 * `orders` no longer stores driver columns (010_relation_based_live_tracking),
 * so name/phone/location all come from driver_assignments joined to drivers.
 */
function mapDriverInfo(row: DriverAssignmentRow | null | undefined): DriverInfo | null {
  if (!row) return null;

  const latitude = toFiniteNumber(row.current_lat);
  const longitude = toFiniteNumber(row.current_lng);
  const location =
    latitude != null && longitude != null
      ? {
          latitude,
          longitude,
          updatedAt: row.last_location_update ?? undefined,
        }
      : null;

  const name = row.driver_full_name?.trim() || undefined;
  const phone = row.driver_contact_number?.trim() || undefined;

  if (!name && !phone && !location) return null;
  return driverInfoFromJson({ name, phone, location });
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
