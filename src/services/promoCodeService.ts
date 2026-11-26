import { supabase } from '../config/supabaseClient';
import { AppliedPromo } from '../models/cart';

export class PromoCodeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PromoCodeError';
    this.code = code;
  }
}

interface PromoValidationRow {
  ok: boolean;
  reason_code: string;
  user_message: string;
  discount: number | string | null;
  promo: {
    id?: string;
    code?: string;
    discountType?: string;
    discountScope?: string;
    discountValue?: number | string | null;
    maxDiscountAmount?: number | string | null;
    minOrderAmount?: number | string | null;
    targetProducts?: string[] | null;
    freeDelivery?: boolean;
    expectedDiscount?: number | string | null;
  } | null;
}

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Server-authoritative promo validation.
 *
 * The SQL RPC `validate_promo_code_by_code` is the same validator used by
 * `create_order_geo_guard` when the order is actually placed, so active dates,
 * spend minimums, per-user limits, first-order rules, store/order-type scoping
 * and product targeting are no longer only client-side checks.
 */
export const promoCodeService = {
  async validate(
    code: string,
    context: {
      subtotal: number;
      storeId: string;
      orderType: 'Food' | 'Liquor';
      items?: Array<{ productId: string; totalPrice: number }>;
    }
  ): Promise<AppliedPromo> {
    const trimmed = code.trim();
    if (!trimmed) {
      throw new PromoCodeError('EMPTY', 'Enter a promo code.');
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw new PromoCodeError('UNAUTHORIZED', 'Please sign in again to use a promo code.');
    }

    const { data, error } = await supabase.rpc('validate_promo_code_by_code', {
      p_code: trimmed,
      p_user_id: authData.user.id,
      p_subtotal: context.subtotal,
      p_store_id: context.storeId,
      p_order_type: context.orderType,
      p_items: (context.items ?? []).map((item) => ({
        product_id: item.productId,
        total_price: item.totalPrice,
      })),
      // At apply time the free-delivery discount has not been folded into the
      // cart fee yet. The order RPC re-checks with the final fee.
      p_delivery_fee: null,
    });

    if (error) {
      throw new PromoCodeError('LOOKUP_FAILED', 'We could not check that code. Please try again.');
    }

    const row = (Array.isArray(data) ? data?.[0] : data) as PromoValidationRow | null | undefined;
    if (!row) {
      throw new PromoCodeError('LOOKUP_FAILED', 'We could not check that code. Please try again.');
    }
    if (!row.ok) {
      throw new PromoCodeError(
        row.reason_code || 'INVALID',
        row.user_message || 'That promo code could not be applied.'
      );
    }

    const promo = row.promo ?? {};
    const rawType = promo.discountType ?? 'fixed';
    const rawScope = promo.discountScope ?? 'order';

    return {
      id: String(promo.id ?? ''),
      code: String(promo.code ?? trimmed),
      discountType: (['percentage', 'fixed', 'free_delivery'].includes(rawType)
        ? rawType
        : 'fixed') as AppliedPromo['discountType'],
      discountScope: (rawScope === 'product' ? 'product' : 'order') as AppliedPromo['discountScope'],
      discountValue: num(promo.discountValue),
      maxDiscountAmount:
        promo.maxDiscountAmount == null ? undefined : num(promo.maxDiscountAmount),
      minOrderAmount: promo.minOrderAmount == null ? undefined : num(promo.minOrderAmount),
      targetProducts: promo.targetProducts ?? [],
      freeDelivery: Boolean(promo.freeDelivery || rawType === 'free_delivery'),
    };
  },

  /**
   * Discount for the current cart. Mirrors the server validator's calculation:
   * order/product scope, percentage/fixed, capped by max_discount_amount.
   */
  calculateDiscount(
    promo: AppliedPromo | undefined,
    subtotal: number,
    items: Array<{ productId: string; totalPrice: number }>
  ): number {
    if (!promo || promo.freeDelivery) return 0;

    let discount = 0;
    if (promo.discountScope === 'product') {
      const targets = new Set(promo.targetProducts ?? []);
      const eligible = items
        .filter((item) => targets.has(item.productId))
        .reduce((sum, item) => sum + item.totalPrice, 0);

      discount =
        promo.discountType === 'percentage'
          ? (eligible * promo.discountValue) / 100
          : Math.min(promo.discountValue, eligible);
    } else {
      discount =
        promo.discountType === 'percentage'
          ? (subtotal * promo.discountValue) / 100
          : promo.discountValue;
    }

    if (promo.maxDiscountAmount && promo.maxDiscountAmount > 0) {
      discount = Math.min(discount, promo.maxDiscountAmount);
    }
    return Math.max(0, Math.round((discount + Number.EPSILON) * 100) / 100);
  },
};
