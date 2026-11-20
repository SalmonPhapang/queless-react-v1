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

interface PromoRow {
  id: string;
  code: string;
  is_active: boolean | null;
  start_date: string | null;
  end_date: string | null;
  min_order_amount: number | string | null;
  usage_limit_total: number | null;
  current_usage_total: number | null;
  applicable_order_types: string[] | null;
  applicable_store_ids: string[] | null;
  discount_type: string | null;
  discount_scope: string | null;
  discount_value: number | string | null;
  max_discount_amount: number | string | null;
  target_products: string[] | null;
}

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Port of PromoCodeService.validatePromoCode from the Flutter app.
 *
 * Mirrors the server-side validation in orders-create / create_order_geo_guard:
 * inactive, out-of-date, under-minimum, over-limit, wrong-order-type and
 * wrong-store promos are all rejected with a reason the customer can act on.
 */
export const promoCodeService = {
  async validate(
    code: string,
    context: { subtotal: number; storeId: string; orderType: 'Food' | 'Liquor' }
  ): Promise<AppliedPromo> {
    const trimmed = code.trim();
    if (!trimmed) {
      throw new PromoCodeError('EMPTY', 'Enter a promo code.');
    }

    const { data, error } = await supabase
      .from('promo_codes')
      .select(
        'id, code, is_active, start_date, end_date, min_order_amount, usage_limit_total, current_usage_total, applicable_order_types, applicable_store_ids, discount_type, discount_scope, discount_value, max_discount_amount, target_products'
      )
      .ilike('code', trimmed)
      .maybeSingle();

    if (error) {
      throw new PromoCodeError('LOOKUP_FAILED', 'We could not check that code. Please try again.');
    }
    if (!data) {
      throw new PromoCodeError('NOT_FOUND', 'That promo code does not exist.');
    }

    const promo = data as PromoRow;
    const now = Date.now();

    if (promo.is_active === false) {
      throw new PromoCodeError('INACTIVE', 'This promo code is no longer active.');
    }
    if (promo.start_date && new Date(promo.start_date).getTime() > now) {
      throw new PromoCodeError('NOT_STARTED', 'This promo code is not active yet.');
    }
    if (promo.end_date && new Date(promo.end_date).getTime() < now) {
      throw new PromoCodeError('EXPIRED', 'This promo code has expired.');
    }
    if (context.subtotal < num(promo.min_order_amount)) {
      throw new PromoCodeError(
        'MIN_ORDER',
        `Spend at least R ${num(promo.min_order_amount).toFixed(2)} to use this code.`
      );
    }
    if (
      promo.usage_limit_total != null &&
      num(promo.current_usage_total) >= Number(promo.usage_limit_total)
    ) {
      throw new PromoCodeError('USAGE_LIMIT', 'This promo code has reached its usage limit.');
    }

    const orderTypes = promo.applicable_order_types ?? [];
    if (orderTypes.length > 0 && !orderTypes.includes(context.orderType)) {
      throw new PromoCodeError(
        'ORDER_TYPE',
        `This code only applies to ${orderTypes.join(' / ')} orders.`
      );
    }

    const storeIds = promo.applicable_store_ids ?? [];
    if (storeIds.length > 0 && !storeIds.includes(context.storeId)) {
      throw new PromoCodeError('STORE', 'This promo code does not apply to this store.');
    }

    return {
      id: promo.id,
      code: promo.code,
      discountType: (promo.discount_type ?? 'fixed') as AppliedPromo['discountType'],
      discountScope: (promo.discount_scope ?? 'order') as AppliedPromo['discountScope'],
      discountValue: num(promo.discount_value),
      maxDiscountAmount:
        promo.max_discount_amount == null ? undefined : num(promo.max_discount_amount),
      minOrderAmount: num(promo.min_order_amount),
      targetProducts: promo.target_products ?? [],
      freeDelivery: promo.discount_type === 'free_delivery',
    };
  },

  /**
   * Discount for the current cart. Mirrors the server's calculateDiscount:
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
