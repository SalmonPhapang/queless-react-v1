import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { responsiveContentStyle, useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useTheme } from '../../theme/theme';
import { productService } from '../../services/productService';
import { storeService } from '../../services/storeService';
import { locationService } from '../../services/locationService';
import { cartService } from '../../services/cartService';
import { Product } from '../../models/product';
import { Store } from '../../models/store';
import { Header } from '../../components/Header';
import { SmartImage } from '../../components/SmartImage';
import { CartBanner } from '../../components/CartBanner';
import { appConfig } from '../../config/appConfig';
import { Skeleton, ProductCardSkeleton } from '../../components/Skeleton';

interface CategoryScreenProps {
  navigation: any;
  route: any;
}

export const CategoryScreen: React.FC<CategoryScreenProps> = ({ navigation, route }) => {
  const { colors, typography } = useTheme();
  const layout = useResponsiveLayout();
  const category: string = route.params?.category ?? '';
  const productType: 'alcohol' | 'food' = route.params?.productType ?? 'alcohol';

  const [products, setProducts] = useState<Product[]>([]);
  const [nearestStore, setNearestStore] = useState<Store | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const location = await locationService.getCurrentLocation();

        // Without a real fix there is no nearest store to order from; browse
        // the category across all stores instead of inventing a location.
        let store: Store | null = null;
        let distance: number | null = null;

        if (location) {
          const stores = await storeService.getStores({
            isAlcohol: productType === 'alcohol',
          });
          store = stores.find((s) => s.isOpen) ?? stores[0] ?? null;

          if (store) {
            cartService.registerStore(store);

            const parts = store.location ? store.location.split(',') : [];
            if (parts.length === 2) {
              const lat = Number(parts[0].trim());
              const lng = Number(parts[1].trim());
              if (!isNaN(lat) && !isNaN(lng)) {
                distance = locationService.calculateDistanceKm(
                  location.latitude,
                  location.longitude,
                  lat,
                  lng
                );
                cartService.updateStoreContext(store.id, {
                  distanceMeters: distance * 1000,
                });
              }
            }
          }
        }

        const loaded = store
          ? (await storeService.getStoreProducts(store.id)).filter(
              (product) => product.category === category
            )
          : await productService.getProductsByCategory(category);

        if (cancelled) return;
        setNearestStore(store);
        setDistanceKm(distance);
        setProducts(loaded);
      } catch (e) {
        console.warn('Category load error:', e);
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [category, productType]);

  const openProduct = (product: Product) => {
    const storeId = product.storeId || nearestStore?.id;
    if (product.optionGroups.length > 0) {
      navigation.navigate('ProductOptions', {
        product,
        storeId,
        storeName: nearestStore?.name,
        isFood: nearestStore ? !nearestStore.isAlcohol : productType === 'food',
      });
    } else {
      navigation.navigate('ProductDetail', {
        product,
        storeId,
        // Only hand over the store when it is the one the product belongs to.
        store: nearestStore && nearestStore.id === storeId ? nearestStore : undefined,
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title={category} showBack onBackPress={() => navigation.goBack()} />

      {nearestStore && (
        <View style={[styles.storeBanner, { backgroundColor: colors.primaryContainer }]}>
          <Ionicons name="storefront" size={20} color={colors.secondary} />
          <View style={styles.storeBannerText}>
            <Text style={[typography.bodyLarge, { color: colors.onSurface, fontWeight: '700' }]}>
              Ordering from: {nearestStore.name}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.subtext }]}>
              {distanceKm !== null ? `${distanceKm.toFixed(1)}km away • ` : ''}
              Delivery: {appConfig.formatCurrency(nearestStore.deliveryFee)}
            </Text>
          </View>
        </View>
      )}

      {loading ? (
        <ScrollView contentContainerStyle={responsiveContentStyle(layout, styles.gridContent)}>
          <Skeleton width="70%" height={56} borderRadius={12} style={{ marginBottom: 16 }} />
          <View
            style={[
              { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 },
              layout.isWeb && { justifyContent: 'center' },
            ]}
          >
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: `${100 / layout.columns}%` }}>
                <ProductCardSkeleton />
              </View>
            ))}
          </View>
        </ScrollView>
      ) : products.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="search-outline" size={64} color={colors.subtext} />
          <Text style={[typography.titleMedium, styles.emptyText, { color: colors.onSurface }]}>
            {nearestStore
              ? `No products in this category from ${nearestStore.name}`
              : `No ${productType === 'alcohol' ? 'liquor' : 'food'} stores available nearby`}
          </Text>
        </View>
      ) : (
        <FlatList
          key={`cols-${layout.columns}`}
          data={products}
          numColumns={layout.columns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={responsiveContentStyle(layout, styles.gridContent)}
          columnWrapperStyle={[styles.gridRow, layout.isWeb && { justifyContent: 'center' }]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.card,
                { backgroundColor: colors.cardBackground, borderColor: colors.divider },
              ]}
              onPress={() => openProduct(item)}
              activeOpacity={0.85}
            >
              <View style={[styles.imageWrapper, layout.isWeb && { height: undefined, aspectRatio: 4 / 3 }]}>
                <SmartImage
                  source={{ uri: item.imageUrl }}
                  style={styles.image}
                  resizeMode={layout.isWeb ? 'contain' : undefined}
                  fallbackIcon="restaurant-outline"
                />
                {item.stock <= 0 && (
                  <View style={styles.outOfStockOverlay}>
                    <View style={[styles.outOfStockPill, { backgroundColor: colors.error }]}>
                      <Text style={[typography.labelSmall, { color: '#FFFFFF', fontWeight: '700' }]}>
                        OUT OF STOCK
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                {item.isLocalBrand && (
                  <View style={styles.localRow}>
                    <Ionicons name="flag" size={12} color={colors.secondary} />
                    <Text style={[typography.bodySmall, { color: colors.secondary, fontWeight: '700' }]}>
                      {' '}
                      Local
                    </Text>
                  </View>
                )}
                <Text
                  style={[typography.titleSmall, { color: colors.onSurface, marginTop: 4 }]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                {!!item.volume && (
                  <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4 }]}>
                    {item.volume}
                  </Text>
                )}
                <Text
                  style={[typography.titleMedium, { color: colors.onSurface, fontWeight: '800', marginTop: 8 }]}
                >
                  {appConfig.formatCurrency(item.price)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <CartBanner onPressCart={() => navigation.navigate('Cart')} />
    </View>
  );
};

const absoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  storeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  storeBannerText: {
    marginLeft: 12,
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
  },
  gridContent: {
    padding: 16,
    paddingBottom: 100,
  },
  gridRow: {
    gap: 16,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  imageWrapper: {
    height: 130,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  outOfStockOverlay: {
    ...absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cardBody: {
    padding: 12,
  },
  localRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
