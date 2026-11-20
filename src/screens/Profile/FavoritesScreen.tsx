import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { Header } from '../../components/Header';
import { ProductCard } from '../../components/ProductCard';
import { authService } from '../../services/authService';
import { productService } from '../../services/productService';
import { Product } from '../../models/product';
import { addProductToCart } from '../../utils/cartActions';
import { ProductCardSkeleton } from '../../components/Skeleton';

export const FavoritesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        const user = await authService.getCurrentSessionUser();
        const ids = user?.favoriteProducts ?? [];
        const items = ids.length > 0 ? await productService.getProductsByIds(ids) : [];
        if (!cancelled) {
          setProducts(items);
          setLoading(false);
        }
      };

      load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Favourites" showBack onBackPress={() => navigation.goBack()} />

      {loading ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: '50%' }}>
                <ProductCardSkeleton />
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={(product) =>
                navigation.navigate('ProductDetail', {
                  product,
                  storeId: product.storeId,
                })
              }
              onAddToCart={(product) => {
                if (!product.storeId) return;
                void addProductToCart({
                  navigation,
                  product,
                  storeId: product.storeId,
                });
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="heart-outline" size={52} color={colors.subtext} />
              <Text style={[typography.titleMedium, { color: colors.onSurface, marginTop: 12 }]}>
                No favourites yet
              </Text>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4, textAlign: 'center' }]}>
                Tap the heart on any product to save it here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  listContent: { padding: 10, flexGrow: 1 },
});
