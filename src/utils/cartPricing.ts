import { Cart } from '../models/cart';
import { PRODUCT_FEE_RATE, customerPriceFromBasePrice } from '../models/product';

/** Bump when the meaning of CartItem.price/basePrice changes. */
export const CART_PRICING_VERSION = 2;

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Old carts stored the database base price in `price` and derived `basePrice`
 * by dividing by 1.125. Rebase those lines so the customer price includes the
 * platform margin and the store keeps its full base price.
 */
export const migrateLegacyCartPricing = (cart: Cart): Cart => {
  if ((cart.pricingVersion ?? 1) >= CART_PRICING_VERSION) return cart;

  const items = cart.items.map((item) => {
    const options = item.selectedOptions ?? [];
    const optionBase = options.reduce((sum, option) => sum + option.priceAdjustment, 0);
    const optionMarkup = options.reduce(
      (sum, option) =>
        sum + Math.floor(option.priceAdjustment * (1 + PRODUCT_FEE_RATE)),
      0
    );

    // Version 1 line price = base product price + option markup.
    const baseProductPrice = Math.max(0, item.price - optionMarkup);

    return {
      ...item,
      basePrice: roundMoney(baseProductPrice + optionBase),
      price: roundMoney(customerPriceFromBasePrice(baseProductPrice) + optionMarkup),
    };
  });

  return { ...cart, items, pricingVersion: CART_PRICING_VERSION };
};
