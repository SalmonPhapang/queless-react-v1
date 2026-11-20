import { SelectedOption } from './product';

export interface CartItem {
  uniqueId: string;
  productId: string;
  productName: string;
  productImageUrl: string;
  price: number;
  basePrice: number;
  basePriceAdjustment: number;
  quantity: number;
  selectedOptions: SelectedOption[];
}

/** A validated promo code, snapshotted so pricing survives a restart. */
export interface AppliedPromo {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed' | 'free_delivery';
  discountScope: 'order' | 'product';
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  targetProducts?: string[];
  freeDelivery?: boolean;
}

export interface Cart {
  userId: string;
  storeId: string;
  storeName?: string;
  items: CartItem[];
  /** Legacy plain code, kept for carts saved before promo validation existed. */
  promoCode?: string;
  /** The validated promo applied to this cart. */
  appliedPromo?: AppliedPromo;
  createdAt: string;
  updatedAt: string;
  aiAssisted: boolean;
  aiConversationId?: string;
  /**
   * Pricing semantics used by the saved line items.
   *
   * 1 (implied for old carts): `price` was the database base price and
   * `basePrice` was derived by dividing by the fee rate.
   * 2: `price` includes the platform margin and `basePrice` is the vendor base.
   */
  pricingVersion?: number;
}
