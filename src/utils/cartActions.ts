import { Alert } from 'react-native';
import { cartService } from '../services/cartService';
import { authService } from '../services/authService';
import { Product, SelectedOption } from '../models/product';
import { Store } from '../models/store';
import { deliveryLocationService } from '../services/deliveryLocationService';
import { getStoreDistanceKm, isBeyondDeliveryRadius } from './deliveryRadius';

interface AddToCartArgs {
  navigation: any;
  product: Product;
  store?: Store | null;
  storeId: string;
  storeName?: string;
  quantity?: number;
  selectedOptions?: SelectedOption[];
  aiAssisted?: boolean;
  aiConversationId?: string;
}

const confirmStoreSwitch = (storeName: string): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(
      'Start a new cart?',
      `Your cart has items from another store. Adding this item will clear it and start a cart at ${storeName}.`,
      [
        { text: 'Keep my cart', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Start new cart', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });

/**
 * The single add-to-cart entry point.
 *
 * - Orders require an account (Supabase needs an auth token — there is no guest
 *   checkout), so a signed-out tap sends the customer to sign in.
 * - Alcohol requires a verified age.
 * - Switching stores asks before silently discarding the existing basket.
 */
export async function addProductToCart({
  navigation,
  product,
  store,
  storeId,
  storeName,
  quantity = 1,
  selectedOptions = [],
  aiAssisted = false,
  aiConversationId,
}: AddToCartArgs): Promise<boolean> {
  const user = await authService.getCurrentSessionUser();
  if (!user) {
    Alert.alert('Sign in required', 'Create an account or sign in to start your order.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Sign in', onPress: () => navigation.navigate('Auth') },
    ]);
    return false;
  }

  if (store && !store.isOpen) {
    Alert.alert('Store closed', 'This store is currently closed and will open soon.');
    return false;
  }

  // Browse is always allowed; ordering is not. Measure against the active
  // delivery point when a store arrived without a distance (e.g. Browse).
  const distanceKm = store
    ? getStoreDistanceKm(store, deliveryLocationService.getActive()?.coords)
    : undefined;
  if (isBeyondDeliveryRadius(distanceKm)) {
    Alert.alert(
      'Delivery unavailable',
      'This store is too far away for delivery. Delivery is only available up to 20km.'
    );
    return false;
  }

  const isAlcohol = store ? store.isAlcohol : product.productType?.toLowerCase() === 'alcohol';
  if (isAlcohol && !user.ageVerified) {
    Alert.alert(
      'Age verification required',
      'You need to verify your age before ordering alcohol.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Verify', onPress: () => navigation.navigate('AgeVerification') },
      ]
    );
    return false;
  }

  if (cartService.isDifferentStore(storeId)) {
    const confirmed = await confirmStoreSwitch(store?.name || storeName || 'this store');
    if (!confirmed) return false;
  }

  if (store) {
    cartService.registerStore(store);
    if (distanceKm !== undefined) {
      cartService.updateStoreContext(store.id, { distanceMeters: distanceKm * 1000 });
    }
  } else {
    // Store row was not loaded; the product type is the best available signal.
    cartService.updateStoreContext(storeId, {
      isFood: product.productType?.toLowerCase() !== 'alcohol',
    });
  }

  await cartService.initCart();
  await cartService.addItem(
    product,
    quantity,
    selectedOptions,
    storeId,
    store?.name || storeName,
    aiAssisted,
    aiConversationId
  );
  return true;
}
