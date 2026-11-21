import { Product } from '../models/product';
import { Store } from '../models/store';

/**
 * Navigation targets for the product/store cards returned by Ask Q.
 *
 * AI cards are built from live catalog rows, but some planner rows can be
 * missing a store id. Keeping that decision pure makes it easy to test and
 * keeps the chat screen from silently doing nothing when a card is tapped.
 */
export type AiProductNavigationTarget =
  | {
      screen: 'ProductOptions';
      params: {
        product: Product;
        storeId: string;
        store?: Store;
        storeName?: string;
        isFood?: boolean;
      };
    }
  | {
      screen: 'ProductDetail';
      params: {
        product: Product;
        storeId: string;
        store?: Store;
      };
    };

export function getAiProductNavigationTarget(
  product: Product,
  store?: Store | null
): AiProductNavigationTarget | null {
  const storeId = product.storeId || store?.id;
  if (!storeId) return null;

  if (product.optionGroups && product.optionGroups.length > 0) {
    return {
      screen: 'ProductOptions',
      params: {
        product,
        storeId,
        store: store ?? undefined,
        storeName: store?.name,
        isFood: store ? !store.isAlcohol : undefined,
      },
    };
  }

  return {
    screen: 'ProductDetail',
    params: { product, storeId, store: store ?? undefined },
  };
}

export function getAiStoreNavigationTarget(store: Store): { screen: 'StoreDetail'; params: { storeId: string } } | null {
  if (!store.id) return null;
  return { screen: 'StoreDetail', params: { storeId: store.id } };
}
