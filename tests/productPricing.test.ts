import assert from 'node:assert/strict';
import test from 'node:test';
import { Cart } from '../src/models/cart';
import { customerPriceFromBasePrice } from '../src/models/product';
import {
  CART_PRICING_VERSION,
  migrateLegacyCartPricing,
} from '../src/utils/cartPricing';

const makeCart = (overrides: Partial<Cart> = {}): Cart => ({
  userId: 'local',
  storeId: 'store-1',
  storeName: 'Store',
  items: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  aiAssisted: false,
  ...overrides,
});

test('customer price adds the 12.5% margin and keeps the .99 anchor', () => {
  assert.equal(customerPriceFromBasePrice(550), 618.99);
  assert.equal(customerPriceFromBasePrice(299.89), 337.99);
  assert.equal(customerPriceFromBasePrice(100), 112.99);
});

test('legacy cart prices are rebased so the store keeps its base price', () => {
  const cart = makeCart({
    items: [
      {
        uniqueId: 'product-1',
        productId: 'product-1',
        productName: 'Thabeng Platter',
        productImageUrl: '',
        // Version 1: price was the DB base price (350) and basePrice was
        // derived as 350 / 1.125 = 311.11.
        price: 350,
        basePrice: 311.11,
        basePriceAdjustment: 0,
        quantity: 1,
        selectedOptions: [],
      },
    ],
  });

  const migrated = migrateLegacyCartPricing(cart);

  assert.equal(migrated.pricingVersion, CART_PRICING_VERSION);
  assert.equal(migrated.items[0].basePrice, 350);
  assert.equal(migrated.items[0].price, 393.99);
});

test('legacy cart option markups are preserved during rebasing', () => {
  const cart = makeCart({
    items: [
      {
        uniqueId: 'product-2',
        productId: 'product-2',
        productName: 'Steak Plate',
        productImageUrl: '',
        // Base 62 + raw option 10; version 1 charged 62 + floor(10 * 1.125).
        price: 73,
        basePrice: 65.11,
        basePriceAdjustment: 10,
        quantity: 2,
        selectedOptions: [
          { groupName: 'Extras', optionName: 'Cheese', priceAdjustment: 10 },
        ],
      },
    ],
  });

  const migrated = migrateLegacyCartPricing(cart);

  assert.equal(migrated.items[0].basePrice, 72);
  assert.equal(migrated.items[0].price, 80.99);
  assert.equal(migrated.items[0].quantity, 2);
});

test('already migrated carts are returned untouched', () => {
  const cart = makeCart({
    pricingVersion: CART_PRICING_VERSION,
    items: [
      {
        uniqueId: 'product-3',
        productId: 'product-3',
        productName: 'Item',
        productImageUrl: '',
        price: 112.99,
        basePrice: 100,
        basePriceAdjustment: 0,
        quantity: 1,
        selectedOptions: [],
      },
    ],
  });

  assert.equal(migrateLegacyCartPricing(cart), cart);
});
