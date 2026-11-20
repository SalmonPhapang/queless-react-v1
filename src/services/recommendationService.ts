import { supabase } from '../config/supabaseClient';
import { storeService } from './storeService';
import { cartService } from './cartService';
import { Store } from '../models/store';
import { Product, SelectedOption } from '../models/product';
import { LocationCoords } from './locationService';

export interface StoreRecommendation {
  store: Store;
  score: number;
  reason: string;
}

export interface ProductRecommendation {
  product: Product;
  score: number;
  reason: string;
}

export interface UsualOrderItem {
  productId: string;
  productName: string;
  productImageUrl: string;
  quantity: number;
  lastPrice: number;
  currentPrice: number | null;
  currentStock: number;
  available: boolean;
  selectedOptions: SelectedOption[];
}

export interface UsualOrder {
  orderId: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  storeImage: string;
  storeOpen: boolean;
  originalTotal: number;
  currentSubtotal: number;
  unavailableCount: number;
  items: UsualOrderItem[];
}

type Row = Record<string, any>;

const asRows = (data: unknown): Row[] =>
  Array.isArray(data) ? (data.filter((row) => row && typeof row === 'object') as Row[]) : [];

const numberValue = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const textValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

const currentUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

const mapSelectedOptions = (value: unknown): SelectedOption[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((option: any): SelectedOption => ({
      groupName: textValue(option?.groupName ?? option?.group_name),
      optionName: textValue(option?.optionName ?? option?.option_name),
      priceAdjustment: numberValue(option?.priceAdjustment ?? option?.price_adjustment),
    }))
    .filter((option) => option.groupName && option.optionName);
};

/**
 * Read-only wrapper around the Q AI affinity RPCs from the Flutter app.
 *
 * Stores and products are ranked from order/view/cart signals, while
 * `qai_usual_order` re-prices the last completed order for the Order Again
 * feature. Everything degrades to an empty list when signed out or when the
 * server has no signal yet; the home screen keeps its nearby list as fallback.
 */
export const recommendationService = {
  async getFeaturedStores(): Promise<Store[]> {
    return await storeService.getStores({ limit: 6 });
  },

  async getRecommendedStores(
    userId?: string,
    coords?: LocationCoords | null,
    limit = 6
  ): Promise<StoreRecommendation[]> {
    const id = userId ?? (await currentUserId());
    if (!id) return [];

    const { data, error } = await supabase.rpc('qai_recommended_stores', {
      p_user_id: id,
      p_limit: limit,
      p_user_lat: coords?.latitude ?? null,
      p_user_lng: coords?.longitude ?? null,
    });
    if (error) {
      console.warn('Recommended stores unavailable:', error.message);
      return [];
    }

    return asRows(data).flatMap((row) => {
      const rawStore = row.store;
      if (!rawStore || typeof rawStore !== 'object') return [];
      return [
        {
          store: storeService.mapStoreRecord(rawStore),
          score: numberValue(row.score),
          reason: textValue(row.reason, 'Picked for you'),
        },
      ];
    });
  },

  async getRecommendedProducts(userId?: string, limit = 8): Promise<ProductRecommendation[]> {
    const id = userId ?? (await currentUserId());
    if (!id) return [];

    const { data, error } = await supabase.rpc('qai_recommended_products', {
      p_user_id: id,
      p_limit: limit,
    });
    if (error) {
      console.warn('Recommended products unavailable:', error.message);
      return [];
    }

    return asRows(data).flatMap((row) => {
      const rawProduct = row.product;
      if (!rawProduct || typeof rawProduct !== 'object') return [];
      return [
        {
          product: storeService.mapProductRecord(rawProduct),
          score: numberValue(row.score),
          reason: textValue(row.reason, 'Based on your activity'),
        },
      ];
    });
  },

  async getUsualOrder(userId?: string): Promise<UsualOrder | null> {
    const id = userId ?? (await currentUserId());
    if (!id) return null;

    const { data, error } = await supabase.rpc('qai_usual_order', {
      p_user_id: id,
    });
    if (error) {
      console.warn('Order Again unavailable:', error.message);
      return null;
    }

    for (const row of asRows(data)) {
      const rawItems = Array.isArray(row.items) ? row.items : [];
      const items: UsualOrderItem[] = rawItems.flatMap((raw: any) => {
        const productId = textValue(raw?.product_id);
        if (!productId) return [];
        const currentPrice = raw?.current_price == null ? null : numberValue(raw.current_price);
        return [
          {
            productId,
            productName: textValue(raw.product_name, 'Item'),
            productImageUrl: textValue(raw.product_image_url),
            quantity: Math.max(1, numberValue(raw.quantity, 1)),
            lastPrice: numberValue(raw.last_price ?? raw.price_per_unit),
            currentPrice,
            currentStock: numberValue(raw.current_stock),
            available: raw.available === true,
            selectedOptions: mapSelectedOptions(raw.selected_options),
          },
        ];
      });
      if (items.length === 0) continue;

      return {
        orderId: textValue(row.order_id),
        orderNumber: textValue(row.order_number),
        storeId: textValue(row.store_id),
        storeName: textValue(row.store_name, 'Store'),
        storeImage: textValue(row.store_image),
        storeOpen: row.store_open === true,
        originalTotal: numberValue(row.original_total),
        currentSubtotal: numberValue(row.current_subtotal),
        unavailableCount: numberValue(row.unavailable_count),
        items,
      };
    }
    return null;
  },

  /** Product objects for the still-available items in the usual order. */
  async getOrderAgainProducts(userId?: string): Promise<Product[]> {
    const usual = await this.getUsualOrder(userId);
    if (!usual) return [];
    const ids = usual.items.filter((item) => item.available).map((item) => item.productId);
    if (ids.length === 0) return [];

    const { data, error } = await supabase.from('products').select('*').in('id', ids);
    if (error || !data) return [];
    return data.map(storeService.mapProductRecord);
  },

  /** Re-adds the available items from a usual order and returns the item count. */
  async addUsualOrderToCart(order: UsualOrder): Promise<number> {
    const available = order.items.filter(
      (item) => item.available && item.currentStock > 0
    );
    if (!available.length || !order.storeOpen) return 0;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('id', available.map((item) => item.productId));
    if (error || !data) return 0;

    const products = data.map(storeService.mapProductRecord).filter((product) => product.stock > 0);
    if (products.length === 0) return 0;

    await cartService.initCart();
    await cartService.clearCart();

    let added = 0;
    for (const product of products) {
      const snapshot = available.find((item) => item.productId === product.id);
      if (!snapshot) continue;
      cartService.updateStoreContext(order.storeId, {
        isFood: product.productType !== 'alcohol',
      });
      await cartService.addItem(
        product,
        snapshot.quantity,
        snapshot.selectedOptions,
        order.storeId,
        order.storeName,
        true
      );
      added++;
    }

    if (added > 0) await cartService.markAiAssisted();
    return added;
  },
};
