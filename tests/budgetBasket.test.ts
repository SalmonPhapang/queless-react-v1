import assert from 'node:assert/strict';
import test from 'node:test';
import type { Product } from '../src/models/product';
import {
  budgetBasketCanCheckout,
  canOpenBudgetBasket,
  type BudgetBasket,
} from '../src/utils/budgetBasket';

const makeBasket = (overrides: Partial<BudgetBasket> = {}): BudgetBasket => ({
  storeId: 'store-1',
  storeName: 'Queless Kitchen',
  itemCount: 1,
  totalCost: 57.99,
  perPersonCost: 28.99,
  servings: 2,
  withinBudget: true,
  missing: [],
  products: [
    {
      id: 'prod-1',
      name: 'Chicken burger',
      price: 57.99,
      productType: 'food',
    } as Product,
  ],
  ...overrides,
});

test('a successful RPC with no matched products is not opened as a basket', () => {
  assert.equal(canOpenBudgetBasket(null), false);
  assert.equal(canOpenBudgetBasket(makeBasket({ products: [] })), false);
});

test('a matched budget basket is openable and checkoutable', () => {
  const basket = makeBasket();
  assert.equal(canOpenBudgetBasket(basket), true);
  assert.equal(basket.products.length, 1);
  assert.equal(budgetBasketCanCheckout(basket), true);
});

test('a basket without a store cannot start a cart', () => {
  const basket = makeBasket({ storeId: undefined });
  assert.equal(canOpenBudgetBasket(basket), true);
  assert.equal(budgetBasketCanCheckout(basket), false);
});
