import type { Product } from '../models/product';

export interface BudgetBasketMissing {
  name?: string;
  quantity?: string;
  reason?: string;
}

export interface BudgetBasket {
  storeId?: string;
  storeName?: string;
  itemCount: number;
  totalCost: number;
  perPersonCost: number;
  servings: number;
  withinBudget: boolean;
  budgetHeadroom?: number | null;
  missing: BudgetBasketMissing[];
  products: Product[];
  warning?: string;
}

export const budgetBasketCanCheckout = (basket: BudgetBasket): boolean =>
  !!basket.storeId && basket.products.length > 0;

/** A successful RPC is only worth opening when it actually matched products. */
export const canOpenBudgetBasket = (basket: BudgetBasket | null): basket is BudgetBasket =>
  !!basket && basket.products.length > 0;
