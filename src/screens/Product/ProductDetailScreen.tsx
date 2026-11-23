import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { responsiveContentStyle, useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useTheme } from '../../theme/theme';
import { Product } from '../../models/product';
import { Store } from '../../models/store';
import { storeService } from '../../services/storeService';
import { cartService } from '../../services/cartService';
import { locationService } from '../../services/locationService';
import { deliveryFeeHelper } from '../../utils/deliveryFeeHelper';
import { addProductToCart } from '../../utils/cartActions';
import { authService } from '../../services/authService';
import { StatusMessage } from '../../components/StatusMessage';
import { SmartImage } from '../../components/SmartImage';
import { appConfig } from '../../config/appConfig';

interface ProductDetailScreenProps {
  navigation: any;
  route: any;
}

export const ProductDetailScreen: React.FC<ProductDetailScreenProps> = ({ navigation, route }) => {
  const { colors, typography } = useTheme();
  const layout = useResponsiveLayout();
  const product: Product = route.params?.product;
  const passedStore: Store | undefined = route.params?.store;
  const storeId: string | undefined =
    route.params?.storeId ?? passedStore?.id ?? product?.storeId;

  const [store, setStore] = useState<Store | null>(passedStore ?? null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      // Callers pass the store they already loaded (open/closed, next opening
      // time); only query when this screen was opened without one.
      const loadedStore =
        passedStore ?? (storeId ? await storeService.getStoreById(storeId) : null);

      if (loadedStore) {
        setStore(loadedStore);
        // Register the store type so a cart started from a product page gets
        // the correct delivery fee and food/liquor minimum order.
        cartService.registerStore(loadedStore);
      }

      const user = await authService.getCurrentSessionUser();
      setIsFavorite(user?.favoriteProducts?.includes(product.id) ?? false);
    };
    load();
  }, [storeId, passedStore, product?.id]);

  if (!product) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface }]}>
        <Text style={[typography.bodyMedium, { color: colors.subtext }]}>
          This item is no longer available.
        </Text>
      </View>
    );
  }

  const toggleFavorite = async () => {
    const favorites = await authService.toggleFavorite(product.id);
    if (favorites.length > 0 || isFavorite) {
      setIsFavorite(favorites.includes(product.id));
    }
  };

  const addToCart = async () => {
    setStatusMessage(null);

    // Revalidate latest store state so a store that closed after this screen
    // opened cannot accept adds/orders.
    let currentStore = store;
    if (storeId) {
      try {
        const fresh = await storeService.getStoreById(storeId);
        if (fresh) {
          currentStore = fresh;
          setStore(fresh);
          cartService.registerStore(fresh);
        }
      } catch {
        // fall back to last known state
      }
    }

    if (currentStore && !currentStore.isOpen) {
      setStatusMessage(currentStore.nextOpeningTime || 'This store is currently closed and will open soon.');
      return;
    }

    // Delivery boundary (Flutter parity): over 20km is unavailable.
    if (currentStore?.coordinates) {
      const position = await locationService.getCurrentLocation().catch(() => null);
      if (position) {
        const distanceKm = locationService.calculateDistanceKm(
          position.latitude,
          position.longitude,
          currentStore.coordinates.latitude,
          currentStore.coordinates.longitude
        );
        const fee = deliveryFeeHelper.calculateFee(distanceKm * 1000);
        if (fee < 0) {
          setStatusMessage('This store is too far away for delivery. Delivery is only available up to 20km.');
          return;
        }
      }
    }

    if (product.optionGroups.length > 0) {
      navigation.navigate('ProductOptions', {
        product,
        storeId,
        storeName: currentStore?.name,
        store: currentStore ?? undefined,
        isFood: currentStore ? !currentStore.isAlcohol : undefined,
      });
      return;
    }

    const resolvedStoreId = storeId ?? product.storeId;
    if (!resolvedStoreId) return;

    setIsAdding(true);
    try {
      const added = await addProductToCart({
        navigation,
        product,
        store: currentStore,
        storeId: resolvedStoreId,
        storeName: currentStore?.name,
        quantity,
      });
      if (added) navigation.goBack();
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsAdding(false);
    }
  };

  const inStock = product.stock > 0;
  const canOrder = (store?.isOpen ?? true) && inStock;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={responsiveContentStyle(layout, styles.scrollContent)} showsVerticalScrollIndicator={false}>
        {statusMessage && (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <StatusMessage variant="warning" message={statusMessage} onDismiss={() => setStatusMessage(null)} />
          </View>
        )}
        <View style={[styles.imageSection, layout.isWeb && { maxWidth: layout.heroMaxWidth, alignSelf: 'center' as const }]}>
          <SmartImage
            source={{ uri: product.imageUrl }}
            style={styles.heroImage}
            fallbackIcon="fast-food-outline"
            fallbackIconSize={88}
          />

          <TouchableOpacity
            style={styles.floatingButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={22} color="#111111" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.floatingButtonRight} onPress={toggleFavorite} activeOpacity={0.8}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? '#DC2626' : '#111111'}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.infoSection, layout.isWeb && { maxWidth: layout.heroMaxWidth, alignSelf: 'center' as const }, { backgroundColor: colors.surface }]}>
          {product.isLocalBrand && (
            <View style={[styles.localBadge, { backgroundColor: 'rgba(6, 193, 103, 0.12)' }]}>
              <Ionicons name="flag" size={14} color={colors.secondary} />
              <Text style={[typography.labelSmall, { color: colors.secondary, fontWeight: '800', marginLeft: 6 }]}>
                LOCAL BRAND
              </Text>
            </View>
          )}

          <Text style={[typography.headlineLarge, styles.name, { color: colors.onSurface }]}>
            {product.name}
          </Text>

          {!!product.brand && (
            <Text style={[typography.titleMedium, { color: colors.subtext, marginTop: 4 }]}>
              {product.brand}
            </Text>
          )}

          <View style={styles.priceRow}>
            <Text style={[typography.headlineLarge, { color: colors.secondary, fontWeight: '800' }]}>
              {appConfig.formatCurrency(product.price)}
            </Text>
            {!!product.volume && (
              <Text style={[typography.titleMedium, { color: colors.subtext, marginLeft: 8 }]}>
                / {product.volume}
              </Text>
            )}
          </View>

          {product.alcoholContent != null && (
            <AttributeRow
              icon="water-outline"
              label="Alcohol Content"
              value={`${product.alcoholContent}% ABV`}
            />
          )}

          {!!product.category && (
            <AttributeRow icon="grid-outline" label="Category" value={product.category} />
          )}

          <Text style={[typography.titleMedium, styles.aboutTitle, { color: colors.onSurface }]}>
            About this item
          </Text>
          <Text style={[typography.bodyLarge, styles.description, { color: colors.subtext }]}>
            {product.description}
          </Text>

          {product.tags.length > 0 && (
            <View style={styles.tags}>
              {product.tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.cardBackground }]}>
                  <Text style={[typography.labelMedium, { color: colors.subtext }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, layout.isWeb && { maxWidth: layout.heroMaxWidth, alignSelf: 'center' as const }, { backgroundColor: colors.surface, borderTopColor: colors.divider }]}>
        {canOrder ? (
          <View style={styles.footerRow}>
            <View style={[styles.quantityBox, { backgroundColor: colors.cardBackground }]}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Ionicons name="remove" size={18} color={colors.onSurface} />
              </TouchableOpacity>
              <Text style={[typography.titleMedium, { color: colors.onSurface, fontWeight: '800' }]}>
                {quantity}
              </Text>
              <TouchableOpacity style={styles.quantityButton} onPress={() => setQuantity((q) => q + 1)}>
                <Ionicons name="add" size={18} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.onSurface }]}
              onPress={addToCart}
              disabled={isAdding}
              activeOpacity={0.85}
            >
              {isAdding ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={[typography.titleMedium, { color: colors.surface, fontWeight: '800' }]}>
                  Add â€¢ {appConfig.formatCurrency(product.price * quantity)}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={[
              styles.unavailableBox,
              { borderColor: colors.error, backgroundColor: colors.errorContainer ?? 'rgba(220,38,38,0.08)' },
            ]}
          >
            <Text style={[typography.titleMedium, { color: colors.error, fontWeight: '800' }]}>
              {!inStock ? 'Out of Stock' : 'Store is currently closed'}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.error, marginTop: 4, opacity: 0.8 }]}>
              {!inStock
                ? 'This item is currently unavailable'
                : store?.nextOpeningTime || 'This store is currently closed and will open soon.'}
            </Text>
          </View>
        )}
      </View>

    </View>
  );
};

const AttributeRow = ({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) => {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.attributeRow}>
      <View style={[styles.attributeIcon, { backgroundColor: colors.cardBackground }]}>
        <Ionicons name={icon} size={18} color={colors.secondary} />
      </View>
      <View style={{ marginLeft: 16 }}>
        <Text style={[typography.labelSmall, { color: colors.subtext, fontWeight: '600' }]}>
          {label}
        </Text>
        <Text style={[typography.titleSmall, { color: colors.onSurface, fontWeight: '700' }]}>
          {value}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  imageSection: {
    height: 340,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  floatingButton: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingButtonRight: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    marginTop: -32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  localBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 16,
  },
  name: {
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 20,
    marginBottom: 24,
  },
  attributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  attributeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutTitle: {
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 12,
  },
  description: {
    lineHeight: 26,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 24,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 4,
  },
  quantityButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  unavailableBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
});
