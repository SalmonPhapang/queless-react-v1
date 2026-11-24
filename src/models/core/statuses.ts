// ============================================================================
// QUELESS CORE (React) — ORDER + PAYMENT STATUSES
//
// Port of queless-core/lib/statuses.dart, trimmed to the two lifecycles this
// customer app reads. Values are exactly what the edge functions write to
// Supabase, so parsing is lenient in the same places the Dart version is.
//
// Differences from the Dart original:
//  - enums become const arrays + union types;
//  - Flutter `Color`/`IconData` hints become hex strings and MaterialIcons
//    glyph names (the customer app already uses @expo/vector-icons).
// ============================================================================

export interface StatusMeta {
  /** Human-readable label shown in the UI. */
  displayName: string;
  /** Microsoft MaterialIcons glyph name (used via @expo/vector-icons). */
  icon: string;
  /** Semantic colour, matching the Material palette used by the Flutter apps. */
  color: string;
}

// Material palette values, so the React colours match the Dart originals.
const COLORS = {
  blueGrey: '#607D8B',
  amber: '#FFC107',
  orange: '#FF9800',
  deepOrange: '#FF5722',
  teal: '#009688',
  indigo: '#3F51B5',
  blue: '#2196F3',
  cyan: '#00BCD4',
  green: '#4CAF50',
  grey: '#9E9E9E',
  red: '#F44336',
  brown: '#795548',
  purple: '#9C27B0',
} as const;

// ============================================================================
// 1. ORDER LIFECYCLE
// ============================================================================

export const ORDER_STATUSES = [
  'pending',
  'awaiting_payment',
  'awaiting_store_acceptance',
  'preparing',
  'ready_for_pickup',
  'driver_assigned',
  'out_for_delivery',
  'arrived',
  'delivered',
  'cancelled',
  'rejected',
  'failed_delivery',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orderStatusMeta: Record<OrderStatus, StatusMeta> = {
  pending: { displayName: 'Pending', icon: 'hourglass-top', color: COLORS.blueGrey },
  awaiting_payment: { displayName: 'Awaiting Payment', icon: 'payments', color: COLORS.amber },
  awaiting_store_acceptance: {
    displayName: 'Awaiting Store Acceptance',
    icon: 'storefront',
    color: COLORS.orange,
  },
  preparing: { displayName: 'Preparing', icon: 'restaurant', color: COLORS.deepOrange },
  ready_for_pickup: { displayName: 'Ready for Pickup', icon: 'inventory-2', color: COLORS.teal },
  driver_assigned: { displayName: 'Driver Assigned', icon: 'person-pin-circle', color: COLORS.indigo },
  out_for_delivery: { displayName: 'Out for Delivery', icon: 'delivery-dining', color: COLORS.blue },
  arrived: { displayName: 'Arrived', icon: 'location-on', color: COLORS.cyan },
  delivered: { displayName: 'Delivered', icon: 'check-circle', color: COLORS.green },
  cancelled: { displayName: 'Cancelled', icon: 'cancel', color: COLORS.grey },
  rejected: { displayName: 'Rejected', icon: 'block', color: COLORS.red },
  failed_delivery: { displayName: 'Failed Delivery', icon: 'error', color: COLORS.brown },
  refunded: { displayName: 'Refunded', icon: 'money-off', color: COLORS.purple },
};

/** Finite state machine: statuses an order may move to from each state. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['awaiting_payment', 'awaiting_store_acceptance', 'cancelled'],
  awaiting_payment: ['awaiting_store_acceptance', 'cancelled'],
  awaiting_store_acceptance: ['preparing', 'rejected', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled', 'refunded'],
  ready_for_pickup: ['driver_assigned', 'cancelled'],
  driver_assigned: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['arrived', 'failed_delivery'],
  arrived: ['delivered', 'failed_delivery'],
  delivered: ['refunded'],
  cancelled: [],
  rejected: [],
  failed_delivery: [],
  refunded: [],
};

const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  'delivered',
  'cancelled',
  'rejected',
  'failed_delivery',
  'refunded',
];

export const orderStatusHelpers = {
  isTerminal: (status: OrderStatus): boolean => TERMINAL_ORDER_STATUSES.includes(status),
};

/** Order and payment values both use 'awaiting_payment' for an unpaid order. */
export function isAwaitingPaymentStatus(status?: string | null): boolean {
  return orderStatusFromDatabaseValue(status ?? undefined) === 'awaiting_payment';
}

/**
 * Awaiting payment means no delivery exists yet. Cash on delivery keeps a
 * pending payment status but is still trackable after store acceptance.
 */
export function isAwaitingPaymentOrder(order: {
  status?: string | null;
  paymentStatus?: string | null;
}): boolean {
  return isAwaitingPaymentStatus(order.status) || isAwaitingPaymentStatus(order.paymentStatus);
}

export function canTrackOrder(order: {
  status?: string | null;
  paymentStatus?: string | null;
}): boolean {
  const status = orderStatusFromDatabaseValue(order.status ?? undefined);
  return !orderStatusHelpers.isTerminal(status) && !isAwaitingPaymentOrder(order);
}

const ORDER_STATUS_ALIASES: Record<string, OrderStatus> = {
  confirmed: 'awaiting_store_acceptance',
  delivering: 'out_for_delivery',
  enroute: 'out_for_delivery',
  ontheway: 'out_for_delivery',
  ontheway2: 'out_for_delivery',
  pickedup: 'out_for_delivery',
  complete: 'delivered',
  completed: 'delivered',
  success: 'delivered',
  canceled: 'cancelled',
  assigned: 'driver_assigned',
  ready: 'ready_for_pickup',
  inprogress: 'preparing',
  cooking: 'preparing',
  atdoor: 'arrived',
  customerlocation: 'arrived',
  declined: 'rejected',
  denied: 'rejected',
  failed: 'failed_delivery',
  undelivered: 'failed_delivery',
  refund: 'refunded',
  aborted: 'cancelled',
};

const normalizeKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Parse a database value into an OrderStatus.
 *
 * Accepts snake_case ('awaiting_payment'), camelCase ('awaitingPayment') and
 * the legacy aliases the Flutter apps historically wrote.
 */
export function orderStatusFromDatabaseValue(
  value: string | null | undefined,
  fallback: OrderStatus = 'pending'
): OrderStatus {
  if (!value) return fallback;
  const normalized = normalizeKey(value);
  for (const status of ORDER_STATUSES) {
    if (normalizeKey(status) === normalized) return status;
  }
  return ORDER_STATUS_ALIASES[normalized] ?? fallback;
}

// ============================================================================
// 2. PAYMENT LIFECYCLE
// ============================================================================

export const PAYMENT_STATUSES = [
  'pending',
  'awaiting_payment',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partially_refunded',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const PAYMENT_STATUS_ALIASES: Record<string, PaymentStatus> = {
  unpaid: 'pending',
  awaitingpayment: 'awaiting_payment',
  paymentpending: 'awaiting_payment',
  inprogress: 'processing',
  complete: 'completed',
  success: 'completed',
  succeeded: 'completed',
  paid: 'completed',
  captured: 'completed',
  failure: 'failed',
  declined: 'failed',
  error: 'failed',
  reversed: 'refunded',
  refund: 'refunded',
  partial: 'partially_refunded',
};

export function paymentStatusFromDatabaseValue(
  value: string | null | undefined,
  fallback: PaymentStatus = 'pending'
): PaymentStatus {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase().replace(/-/g, '_');
  if ((PAYMENT_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as PaymentStatus;
  }
  return PAYMENT_STATUS_ALIASES[normalized.replace(/_/g, '')] ?? fallback;
}

// ============================================================================
// 3. UTILITIES
// ============================================================================

/**
 * Validate a state transition against one lifecycle's transition table.
 *
 * The table is passed explicitly because a bare value such as 'pending' exists
 * in more than one lifecycle.
 */
export function isValidStatusTransition<T extends string>(
  transitions: Record<T, readonly T[]>,
  from: T,
  to: T
): boolean {
  return transitions[from]?.includes(to) ?? false;
}
