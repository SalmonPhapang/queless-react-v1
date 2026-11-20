import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppliedPromo, Cart, CartItem } from '../models/cart';
import { Product, SelectedOption, PRODUCT_FEE_RATE } from '../models/product';
import { Store } from '../models/store';
import { appConfig } from '../config/appConfig';
import { CART_PRICING_VERSION, migrateLegacyCartPricing } from '../utils/cartPricing';
import { deliveryFeeHelper } from '../utils/deliveryFeeHelper';
import { promoCodeService } from './promoCodeService';

const CART_STORAGE_KEY = '@queless_cart';
const STORE_CONTEXT_STORAGE_KEY = '@queless_cart_store_contexts';

/** Flat fee used when a store's distance and own fee are both unknown. */
const DEFAULT_DELIVERY_FEE = 15.0;

/**
 * Per-store delivery context. The Flutter app keeps separate alcohol
 * (CartService) and food (FoodCartService) carts, each with its own store
 * distances and minimums; the React port uses one cart, so the store-specific
 * facts used for fees live here instead.
 */
export interface StoreCartContext {
  distanceMeters?: number;
  isFood?: boolean;
  /** The store's own published delivery fee, used until a distance is known. */
  baseDeliveryFee?: number;
  /** The store's own minimum order (0 means "use the food/liquor default"). */
  minimumOrder?: number;
}

type CartChangeListener = (cart: Cart | null) => void;

class CartService {
  private currentCart: Cart | null = null;
  private listeners: Set<CartChangeListener> = new Set();
  private initialized = false;
  private storeContexts: Record<string, StoreCartContext> = {};
  private contextWriteQueue: Promise<void> = Promise.resolve();

  async initCart(): Promise<Cart | null> {
    if (this.initialized) return this.currentCart;

    try {
      const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Cart;
        const migrated = migrateLegacyCartPricing(parsed);
        this.currentCart = migrated;
        if (migrated !== parsed) {
          await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(migrated));
        }
      }
    } catch (e) {
      console.warn('Failed to load cart from AsyncStorage', e);
    }

    // Store distances / flags must survive a restart, otherwise an existing
    // cart would fall back to the flat fee and liquor minimum.
    try {
      const storedContexts = await AsyncStorage.getItem(STORE_CONTEXT_STORAGE_KEY);
      if (storedContexts) {
        this.storeContexts = {
          ...this.sanitizeStoreContexts(JSON.parse(storedContexts)),
          ...this.storeContexts,
        };
      }
    } catch (e) {
      console.warn('Failed to load cart store context from AsyncStorage', e);
    }

    this.initialized = true;
    return this.currentCart;
  }

  /**
   * Writes are serialised so several stores registered in one pass cannot land
   * out of order and expose an older snapshot after a newer one.
   */
  private sanitizeStoreContexts(raw: unknown): Record<string, StoreCartContext> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

    const contexts: Record<string, StoreCartContext> = {};
    for (const [storeId, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;

      const entry = value as Record<string, unknown>;
      const context: StoreCartContext = {};
      if (typeof entry.distanceMeters === 'number' && isFinite(entry.distanceMeters)) {
        context.distanceMeters = entry.distanceMeters;
      }
      if (typeof entry.isFood === 'boolean') {
        context.isFood = entry.isFood;
      }
      if (typeof entry.baseDeliveryFee === 'number' && isFinite(entry.baseDeliveryFee)) {
        context.baseDeliveryFee = entry.baseDeliveryFee;
      }
      if (typeof entry.minimumOrder === 'number' && isFinite(entry.minimumOrder)) {
        context.minimumOrder = entry.minimumOrder;
      }
      contexts[storeId] = context;
    }
    return contexts;
  }

  private persistStoreContexts(): Promise<void> {
    const snapshot =
      Object.keys(this.storeContexts).length === 0
        ? null
        : JSON.stringify(this.storeContexts);

    this.contextWriteQueue = this.contextWriteQueue
      .catch(() => undefined)
      .then(async () => {
        try {
          if (snapshot === null) {
            await AsyncStorage.removeItem(STORE_CONTEXT_STORAGE_KEY);
          } else {
            await AsyncStorage.setItem(STORE_CONTEXT_STORAGE_KEY, snapshot);
          }
        } catch (e) {
          console.warn('Failed to save cart store context to AsyncStorage', e);
        }
      });

    return this.contextWriteQueue;
  }

  getCartSync(): Cart | null {
    return this.currentCart;
  }

  private async persistAndNotify() {
    try {
      if (this.currentCart) {
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.currentCart));
      } else {
        await AsyncStorage.removeItem(CART_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save cart to AsyncStorage', e);
    }

    await this.persistStoreContexts();

    this.listeners.forEach((listener) => listener(this.currentCart));
  }

  subscribe(listener: CartChangeListener) {
    this.listeners.add(listener);
    listener(this.currentCart);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Register a store's food/alcohol nature plus the fee and minimum it
   * publishes. This is the single place the food/liquor rule lives; every
   * add-to-cart entry point calls it instead of deciding itself.
   */
  registerStore(store: Store): void {
    this.updateStoreContext(store.id, {
      isFood: !store.isAlcohol,
      baseDeliveryFee: typeof store.deliveryFee === 'number' ? store.deliveryFee : undefined,
      minimumOrder:
        typeof store.minimumOrder === 'number' && store.minimumOrder > 0
          ? store.minimumOrder
          : undefined,
    });
  }

  /** Record distance / store facts used for delivery fees and minimum orders. */
  updateStoreContext(storeId: string, context: StoreCartContext): void {
    this.storeContexts[storeId] = { ...this.storeContexts[storeId], ...context };
    void this.persistStoreContexts();
  }

  getStoreContext(storeId?: string): StoreCartContext {
    const id = storeId ?? this.currentCart?.storeId;
    return id ? this.storeContexts[id] ?? {} : {};
  }

  /** Would adding from this store replace a non-empty cart from another? */
  isDifferentStore(storeId: string): boolean {
    return (
      !!this.currentCart &&
      this.currentCart.storeId !== storeId &&
      this.currentCart.items.length > 0
    );
  }

  /**
   * Delivery fee for the cart.
   *
   *  - free-delivery promo → 0
   *  - measured distance → the shared tier table (-1 when beyond 20 km)
   *  - no distance yet → the store's own published fee, else the flat default
   */
  getDeliveryFee(storeId?: string): number {
    const { distanceMeters, baseDeliveryFee } = this.getStoreContext(storeId);

    if (distanceMeters !== undefined) {
      const distanceFee = deliveryFeeHelper.calculateFee(distanceMeters);
      // A free-delivery promo must never override the 20km delivery guard.
      if (distanceFee < 0) return distanceFee;
      if (this.currentCart?.appliedPromo?.freeDelivery) return 0;
      return distanceFee;
    }

    if (this.currentCart?.appliedPromo?.freeDelivery) return 0;
    return typeof baseDeliveryFee === 'number' ? baseDeliveryFee : DEFAULT_DELIVERY_FEE;
  }

  getServiceFee(storeId?: string): number {
    if (!this.currentCart || this.currentCart.items.length === 0) return 0;
    return appConfig.serviceFee;
  }

  getMinimumOrder(storeId?: string): number {
    const { isFood, minimumOrder } = this.getStoreContext(storeId);
    if (typeof minimumOrder === 'number' && minimumOrder > 0) return minimumOrder;
    return isFood ? appConfig.foodMinimumOrder : appConfig.liquorMinimumOrder;
  }

  isMinimumOrderMet(storeId?: string): boolean {
    return this.calculateSubtotal() >= this.getMinimumOrder(storeId);
  }

  calculateSubtotal(): number {
    if (!this.currentCart) return 0;
    return roundMoney(
      this.currentCart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    );
  }

  /** Sum of the platform's base prices, used for the settlement split. */
  calculateBaseSubtotal(): number {
    if (!this.currentCart) return 0;
    return roundMoney(
      this.currentCart.items.reduce((sum, item) => sum + item.basePrice * item.quantity, 0)
    );
  }

  calculateDiscount(subtotal: number): number {
    const promo = this.currentCart?.appliedPromo;
    if (!promo || !this.currentCart) return 0;

    return promoCodeService.calculateDiscount(
      promo,
      subtotal,
      this.currentCart.items.map((item) => ({
        productId: item.productId,
        totalPrice: item.price * item.quantity,
      }))
    );
  }

  calculateTotal(storeId?: string): number {
    const subtotal = this.calculateSubtotal();
    const deliveryFee = Math.max(0, this.getDeliveryFee(storeId));
    const serviceFee = this.getServiceFee(storeId);
    const discount = this.calculateDiscount(subtotal);
    return roundMoney(subtotal + deliveryFee + serviceFee - discount);
  }

  /** Mark the cart as built with Q AI (budget baskets, recipe flows). */
  async markAiAssisted(conversationId?: string): Promise<void> {
    if (!this.currentCart) return;
    this.currentCart.aiAssisted = true;
    if (conversationId) this.currentCart.aiConversationId = conversationId;
    this.currentCart.updatedAt = new Date().toISOString();
    await this.persistAndNotify();
  }

  async addItem(
    product: Product,
    quantity: number = 1,
    selectedOptions: SelectedOption[] = [],
    storeId: string,
    storeName?: string,
    aiAssisted: boolean = false,
    aiConversationId?: string
  ): Promise<Cart> {
    await this.initCart();

    // Starting a new store replaces the old cart. Callers confirm this with the
    // user first (see utils/cartActions); this is the last line of defence.
    if (this.currentCart && this.currentCart.storeId !== storeId && this.currentCart.items.length > 0) {
      this.currentCart = null;
    }

    let basePriceAdj = 0;
    let priceAdj = 0;
    for (const opt of selectedOptions) {
      basePriceAdj += opt.priceAdjustment;
      priceAdj += Math.floor(opt.priceAdjustment * (1 + PRODUCT_FEE_RATE));
    }

    const sortedOpts = [...selectedOptions].sort((a, b) => {
      const g = a.groupName.localeCompare(b.groupName);
      return g !== 0 ? g : a.optionName.localeCompare(b.optionName);
    });
    const hash = sortedOpts.map((o) => `${o.groupName}:${o.optionName}`).join('|');
    const uniqueId = `${product.id}_${hash}`;

    const itemPrice = product.price + priceAdj;
    const itemBasePrice = product.basePrice + basePriceAdj;

    if (!this.currentCart) {
      this.currentCart = {
        userId: 'local',
        storeId,
        storeName: storeName || 'Store',
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        aiAssisted,
        aiConversationId,
        pricingVersion: CART_PRICING_VERSION,
      };
    }

    const existingIndex = this.currentCart.items.findIndex((i) => i.uniqueId === uniqueId);
    if (existingIndex >= 0) {
      this.currentCart.items[existingIndex].quantity += quantity;
    } else {
      this.currentCart.items.push({
        uniqueId,
        productId: product.id,
        productName: product.name,
        productImageUrl: product.imageUrl,
        price: itemPrice,
        basePrice: itemBasePrice,
        basePriceAdjustment: basePriceAdj,
        quantity,
        selectedOptions,
      });
    }

    if (aiAssisted) {
      this.currentCart.aiAssisted = true;
      if (aiConversationId) this.currentCart.aiConversationId = aiConversationId;
    }

    this.currentCart.updatedAt = new Date().toISOString();
    await this.persistAndNotify();
    return this.currentCart;
  }

  async removeItem(uniqueId: string): Promise<Cart | null> {
    await this.initCart();
    if (!this.currentCart) return null;

    this.currentCart.items = this.currentCart.items.filter((i) => i.uniqueId !== uniqueId);
    if (this.currentCart.items.length === 0) {
      this.currentCart = null;
    } else {
      this.currentCart.updatedAt = new Date().toISOString();
    }
    await this.persistAndNotify();
    return this.currentCart;
  }

  async updateQuantity(uniqueId: string, quantity: number): Promise<Cart | null> {
    await this.initCart();
    if (!this.currentCart) return null;

    if (quantity <= 0) {
      return this.removeItem(uniqueId);
    }

    const item = this.currentCart.items.find((i) => i.uniqueId === uniqueId);
    if (item) {
      item.quantity = quantity;
      this.currentCart.updatedAt = new Date().toISOString();
    }
    await this.persistAndNotify();
    return this.currentCart;
  }

  async clearCart(): Promise<void> {
    this.currentCart = null;
    await this.persistAndNotify();
  }

  /** Apply an already-validated promo. */
  async applyPromo(promo: AppliedPromo): Promise<void> {
    await this.initCart();
    if (!this.currentCart) return;

    this.currentCart.appliedPromo = promo;
    this.currentCart.promoCode = promo.code;
    this.currentCart.updatedAt = new Date().toISOString();
    await this.persistAndNotify();
  }

  async removePromo(): Promise<void> {
    await this.initCart();
    if (!this.currentCart) return;

    delete this.currentCart.appliedPromo;
    delete this.currentCart.promoCode;
    this.currentCart.updatedAt = new Date().toISOString();
    await this.persistAndNotify();
  }
}

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const cartService = new CartService();
