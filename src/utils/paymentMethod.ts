import { PaymentMethodType } from '../models/payment';

/**
 * The four choices shown in Checkout. Card and Instant EFT each open their own
 * Paystack channel, Capitec Pay uses a Capitec-only authorization URL, and COD
 * is settled locally.
 */
export type CheckoutPaymentMethod = 'card' | 'instantEft' | 'capitecPay' | 'cashOnDelivery';

export type PaymentMethodCode = PaymentMethodType;

export type OrderPaymentMethodLabel = 'Card' | 'Instant EFT' | 'Capitec Pay' | 'Cash on Delivery';

const ORDER_LABELS: Record<CheckoutPaymentMethod, OrderPaymentMethodLabel> = {
  card: 'Card',
  instantEft: 'Instant EFT',
  capitecPay: 'Capitec Pay',
  cashOnDelivery: 'Cash on Delivery',
};

const PAYMENT_CODES: Record<CheckoutPaymentMethod, PaymentMethodCode> = {
  card: 'card',
  instantEft: 'instantEft',
  capitecPay: 'capitecPay',
  cashOnDelivery: 'cashOnDelivery',
};

/**
 * Paid orders that count towards unlocking Cash on Delivery. The order table
 * stores human-readable labels, including legacy EFT labels from older orders.
 * Cash orders never count towards the requirement.
 */
export const COD_UNLOCK_PAYMENT_METHOD_LABELS = [
  'Card',
  'Instant EFT',
  'Capitec Pay',
  'EFT',
  'Instant Bank Transfer',
] as const;

export const COD_UNLOCK_PAID_ORDER_COUNT = 3;

export interface CodUnlockProgress {
  allowed: boolean;
  paidOrderCount: number;
  requiredPaidOrders: number;
}

export function getCodUnlockProgress(paidOrderCount: number): CodUnlockProgress {
  const count = Math.max(0, paidOrderCount);
  return {
    allowed: count >= COD_UNLOCK_PAID_ORDER_COUNT,
    paidOrderCount: count,
    requiredPaidOrders: COD_UNLOCK_PAID_ORDER_COUNT,
  };
}

/** The value written to orders.payment_method (must match its CHECK constraint). */
export function toOrderPaymentMethod(method: CheckoutPaymentMethod): OrderPaymentMethodLabel {
  return ORDER_LABELS[method];
}

/** The value written to payments.payment_method. */
export function toPaymentMethodCode(method: CheckoutPaymentMethod): PaymentMethodCode {
  return PAYMENT_CODES[method];
}

/**
 * Reverse lookup for an existing order so Pay now reuses the method the
 * customer already chose at checkout instead of asking again.
 */
export function checkoutPaymentMethodFromOrderLabel(
  label?: string | null
): CheckoutPaymentMethod | null {
  const key = String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const match = (Object.keys(ORDER_LABELS) as CheckoutPaymentMethod[]).find(
    (method) => ORDER_LABELS[method].toLowerCase().replace(/[^a-z0-9]/g, '') === key
  );
  // Legacy 'EFT' orders are Instant EFT.
  if (!match && (key === 'eft' || key === 'instantbanktransfer')) return 'instantEft';
  return match ?? null;
}

/** Capitec Pay approvals are asynchronous, so they need status polling. */
export function needsApprovalPolling(method: CheckoutPaymentMethod | undefined): boolean {
  return method === 'capitecPay';
}

export interface PaymentPollingPlan {
  /** Delay before the first verification check. */
  firstDelayMs: number;
  /** Minimum gap between later checks. */
  intervalMs: number;
  /** Maximum number of checks before showing a failed state. */
  maxAttempts: number;
}

/**
 * Capitec Pay's docs require the first requery at ~90s and never faster than
 * 10s. Other methods settle quickly, so they are checked sooner and more often.
 */
export function getPaymentPollingPlan(
  method: CheckoutPaymentMethod | undefined,
  elapsedMs = 0
): PaymentPollingPlan {
  if (needsApprovalPolling(method)) {
    return {
      firstDelayMs: Math.max(1_000, 90_000 - Math.max(0, elapsedMs)),
      intervalMs: 10_000,
      maxAttempts: 30,
    };
  }

  return { firstDelayMs: 3_000, intervalMs: 5_000, maxAttempts: 60 };
}
