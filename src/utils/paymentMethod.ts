import { PaymentMethodType } from '../models/payment';

/**
 * The three choices shown in Checkout. Capitec Pay and card/Instant EFT both
 * use the Paystack hosted checkout; COD is settled locally.
 */
export type CheckoutPaymentMethod = 'card' | 'capitecPay' | 'cashOnDelivery';

export type PaymentMethodCode = PaymentMethodType;

export type OrderPaymentMethodLabel = 'Instant EFT' | 'Capitec Pay' | 'Cash on Delivery';

const ORDER_LABELS: Record<CheckoutPaymentMethod, OrderPaymentMethodLabel> = {
  card: 'Instant EFT',
  capitecPay: 'Capitec Pay',
  cashOnDelivery: 'Cash on Delivery',
};

const PAYMENT_CODES: Record<CheckoutPaymentMethod, PaymentMethodCode> = {
  card: 'instantEft',
  capitecPay: 'capitecPay',
  cashOnDelivery: 'cashOnDelivery',
};

/** The value written to orders.payment_method (must match its CHECK constraint). */
export function toOrderPaymentMethod(method: CheckoutPaymentMethod): OrderPaymentMethodLabel {
  return ORDER_LABELS[method];
}

/** The value written to payments.payment_method. */
export function toPaymentMethodCode(method: CheckoutPaymentMethod): PaymentMethodCode {
  return PAYMENT_CODES[method];
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
