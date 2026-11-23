import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { responsiveContentStyle, useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useTheme } from '../../theme/theme';
import { storeService } from '../../services/storeService';
import { Product } from '../../models/product';
import { Store } from '../../models/store';
import { Header } from '../../components/Header';
import { ProductCard } from '../../components/ProductCard';
import { CartBanner } from '../../components/CartBanner';
import { cartService } from '../../services/cartService';
import { addProductToCart } from '../../utils/cartActions';
import { ProductCardSkeleton } from '../../components/Skeleton';

export const StoreProductsScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { colors, typography } = useTheme();
  const layout = useResponsiveLayout();
  const storeId = route.params?.storeId;

  const [products, setProducts] = useState<Product[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStore = async () => {
      if (!storeId) return;
      try {
        const data = await storeService.getStoreById(storeId);
        setStore(data);
        if (data) {
          // Register the store type so the cart applies the correct fee and
          // minimum order (food vs liquor), as Home and Store Detail do.
          cartService.registerStore(data);
        }
      } catch (e) {
        console.warn('Store fetch error:', e);
      }
    };
    fetchStore();
  }, [storeId]);

  const handleAddToCart = (product: Product) => {
    if (!storeId) return;
    void addProductToCart({
      navigation,
      product,
      store,
      storeId,
      storeName: store?.name,
    });
  };

  useEffect(() => {
    const fetchProds = async () => {
      try {
        if (!storeId) return;
        const data = await storeService.getStoreProducts(storeId, undefined, searchQuery);
        setProducts(data);
      } catch (e) {
        console.warn('Store products fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchProds();
  }, [storeId, searchQuery]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header
        title="Store Products"
        subtitle={store?.name}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.searchBarContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Ionicons name="search" size={20} color={colors.subtext} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder="Search items in store..."
            placeholderTextColor={colors.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading ? (
        <ScrollView contentContainerStyle={responsiveContentStyle(layout, styles.gridContent)}>
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
      ) : (
        <FlatList
          key={`cols-${layout.columns}`}
          data={products}
          numColumns={layout.columns}
          columnWrapperStyle={layout.isWeb ? { justifyContent: 'center' } : undefined}
          keyExtractor={(item) => item.id}
          contentContainerStyle={responsiveContentStyle(layout, styles.gridContent)}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={(product) =>
                product.optionGroups.length > 0
                  ? navigation.navigate('ProductOptions', {
                      product,
                      storeId,
                      storeName: store?.name,
                      isFood: store ? !store.isAlcohol : undefined,
                    })
                  : navigation.navigate('ProductDetail', {
                      product,
                      storeId,
                      store: store ?? undefined,
                    })
              }
              onAddToCart={handleAddToCart}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Ionicons name="search-outline" size={48} color={colors.subtext} />
              <Text style={[typography.titleMedium, { color: colors.onSurface, marginTop: 12 }]}>
                No products found
              </Text>
            </View>
          }
        />
      )}

      <CartBanner onPressCart={() => navigation.navigate('Cart')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  gridContent: {
    paddingHorizontal: 10,
    paddingBottom: 90,
  },
});
