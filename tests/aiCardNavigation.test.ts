import assert from 'node:assert/strict';
import test from 'node:test';
import type { Product } from '../src/models/product';
import type { Store } from '../src/models/store';
import {
  getAiProductNavigationTarget,
  getAiStoreNavigationTarget,
} from '../src/utils/aiCardNavigation';

const makeProduct = (overrides: Partial<Product> = {}): Product =>
  ({
    id: 'prod-1',
    name: 'Chicken burger',
    category: 'burgers',
    description: '',
    basePrice: 50,
    price: 57.99,
    imageUrl: '',
    isLocalBrand: false,
    tags: [],
    productType: 'food',
    storeId: 'store-1',
    stock: 10,
    createdAt: '2026-11-21T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
    optionGroups: [],
    ...overrides,
  }) as Product;

const makeStore = (overrides: Partial<Store> = {}): Store =>
  ({
    id: 'store-1',
    name: 'Queless Kitchen',
    description: '',
    imageUrl: '',
    category: 'Food',
    cuisineTypes: [],
    rating: 4.5,
    totalReviews: 10,
    deliveryTimeMin: 20,
    deliveryTimeMax: 40,
    deliveryFee: 15,
    minimumOrder: 0,
    isOpen: true,
    operatingHours: {},
    address: '',
    location: '',
    coordinates: undefined,
    phone: '',
    tags: [],
    createdAt: '2026-11-21T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
    isApproved: true,
    acceptedPaymentMethods: ['eft'],
    isAlcohol: false,
    ...overrides,
  }) as Store;

test('AI product cards open a product screen instead of doing nothing', () => {
  const store = makeStore();
  const plain = getAiProductNavigationTarget(makeProduct(), store);
  assert.equal(plain?.screen, 'ProductDetail');
  assert.equal(plain?.params.storeId, 'store-1');
  assert.equal(plain?.params.store?.name, 'Queless Kitchen');

  const withOptions = getAiProductNavigationTarget(
    makeProduct({
      optionGroups: [
        { name: 'Size', isRequired: true, multiSelect: false, options: [] },
      ],
    }),
    store
  );
  assert.equal(withOptions?.screen, 'ProductOptions');
  assert.equal(withOptions?.params.storeName, 'Queless Kitchen');
});

test('AI cards without a store id do not navigate to a dead product screen', () => {
  assert.equal(getAiProductNavigationTarget(makeProduct({ storeId: undefined })), null);
  assert.equal(getAiStoreNavigationTarget(makeStore({ id: '' })), null);
});

test('AI store cards open the store detail screen', () => {
  const target = getAiStoreNavigationTarget(makeStore());
  assert.equal(target?.screen, 'StoreDetail');
  assert.equal(target?.params.storeId, 'store-1');
});
