import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { storeService } from '../../services/storeService';
import { Store } from '../../models/store';
import { Product } from '../../models/product';
import { SmartImage } from '../../components/SmartImage';
import { ProductCard } from '../../components/ProductCard';
import { CartBanner } from '../../components/CartBanner';
import { StatusMessage } from '../../components/StatusMessage';
import { cartService } from '../../services/cartService';
import { locationService } from '../../services/locationService';
import { addProductToCart } from '../../utils/cartActions';
import { appConfig } from '../../config/appConfig';
import { Skeleton, ProductCardSkeleton } from '../../components/Skeleton';

export const StoreDetailScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { colors, typography } = useTheme();
  const storeId = route.params?.storeId;

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadStore = async () => {
      try {
        if (!storeId) return;
        const [storeData, productData] = await Promise.all([
          storeService.getStoreById(storeId),
          storeService.getStoreProducts(storeId),
        ]);
        setStore(storeData);
        setProducts(productData);
      } catch (e) {
        console.warn('Store detail load error:', e);
      } finally {
        setLoading(false);
      }
    };
    loadStore();
  }, [storeId]);

  // Measure the store once so the cart uses the distance-based delivery fee
  // instead of the store's flat published fee (they can disagree).
  useEffect(() => {
    let cancelled = false;

    const measure = async () => {
      const point = store?.coordinates;
      if (!point) return;

      const position = await locationService.getCurrentLocation();
      if (!position || cancelled) return;

      const distanceKm = locationService.calculateDistanceKm(
        position.latitude,
        position.longitude,
        point.latitude,
        point.longitude
      );
      cartService.updateStoreContext(store!.id, {
        distanceMeters: distanceKm * 1000,
      });
      if (distanceKm > 20 && !cancelled) {
        setStatusMessage('This store is too far away for delivery. Delivery is only available up to 20km.');
      }
    };

    void measure();
    return () => {
      cancelled = true;
    };
  }, [store?.id, store?.coordinates]);

  const handleAddToCart = (product: Product) => {
    if (!store) return;
    void addProductToCart({
      navigation,
      product,
      store,
      storeId: store.id,
      storeName: store.name,
    });
  };

  if (loading || !store) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Skeleton width="100%" height={200} borderRadius={0} />
          <View style={{ marginHorizontal: 16, marginTop: -24, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.cardBackground }}>
            <Skeleton width="70%" height={24} borderRadius={6} style={{ marginBottom: 10 }} />
            <Skeleton width="100%" height={14} borderRadius={6} style={{ marginBottom: 8 }} />
            <Skeleton width="90%" height={14} borderRadius={6} style={{ marginBottom: 12 }} />
            <Skeleton width="80%" height={14} borderRadius={6} />
          </View>
          <View style={{ marginHorizontal: 16, marginTop: 20, marginBottom: 8 }}>
            <Skeleton width={140} height={22} borderRadius={6} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: '50%' }}>
                <ProductCardSkeleton />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  const storeClosed = !store.isOpen;
  const canAddToCart = !storeClosed;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {statusMessage && !storeClosed && (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <StatusMessage variant="warning" message={statusMessage} onDismiss={() => setStatusMessage(null)} />
          </View>
        )}
        {/* Banner Image & Back Button */}
        <View style={styles.bannerContainer}>
          <SmartImage
            source={{ uri: store.imageUrl }}
            style={styles.bannerImage}
            fallbackIcon="storefront-outline"
            fallbackIconSize={64}
          />
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Store Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Text style={[typography.headlineMedium, { color: colors.onSurface }]}>{store.name}</Text>

          <Text style={[typography.bodyMedium, { color: colors.subtext, marginTop: 4 }]}>
            {store.description}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={[typography.titleSmall, { color: colors.onSurface, marginLeft: 4 }]}>
                {store.rating.toFixed(1)} ({store.totalReviews})
              </Text>
            </View>

            <Text style={[styles.dot, { color: colors.subtext }]}>•</Text>

            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={colors.subtext} />
              <Text style={[typography.bodySmall, { color: colors.subtext, marginLeft: 4 }]}>
                {store.deliveryTimeMin}-{store.deliveryTimeMax} min
              </Text>
            </View>

            <Text style={[styles.dot, { color: colors.subtext }]}>•</Text>

            <View style={styles.metaItem}>
              <Ionicons name="bicycle-outline" size={16} color={colors.subtext} />
              <Text style={[typography.bodySmall, { color: colors.subtext, marginLeft: 4 }]}>
                {store.deliveryFee === 0 ? 'FREE' : appConfig.formatCurrency(store.deliveryFee)}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu Section Header */}
        <View style={styles.menuHeader}>
          <Text style={[typography.titleLarge, { color: colors.onSurface }]}>Store Menu</Text>
        </View>

        {/* Products Grid */}
        <View style={{ paddingHorizontal: 10 }}>
          <FlatList
            data={products}
            numColumns={2}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                onPress={(product) =>
                  navigation.navigate(product.optionGroups.length > 0 ? 'ProductOptions' : 'ProductDetail', {
                    product,
                    storeId: store.id,
                    storeName: store.name,
                    store,
                    isFood: !store.isAlcohol,
                  })
                }
                onAddToCart={canAddToCart ? handleAddToCart : undefined}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyProducts}>
                <Text style={[typography.bodyMedium, { color: colors.subtext }]}>
                  No products available in this store currently.
                </Text>
              </View>
            }
          />
        </View>
      </ScrollView>

      <CartBanner onPressCart={() => navigation.navigate('Cart')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 90,
  },
  bannerContainer: {
    height: 200,
    width: '100%',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  backBtn: {
    position: 'absolute',
    top: 45,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: -24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    marginHorizontal: 8,
  },
  menuHeader: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyProducts: {
    padding: 30,
    alignItems: 'center',
  },
});
