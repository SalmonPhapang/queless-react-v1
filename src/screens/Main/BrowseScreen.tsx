import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { storeService } from '../../services/storeService';
import { Store } from '../../models/store';
import { StoreCard } from '../../components/StoreCard';
import { Header } from '../../components/Header';
import { CartBanner } from '../../components/CartBanner';
import { StoreCardSkeleton } from '../../components/Skeleton';

const PRODUCT_CATEGORIES: { id: string; label: string; icon: string; productType: 'alcohol' | 'food' }[] = [
  { id: 'burgers', label: 'Burgers', icon: 'fast-food-outline', productType: 'food' },
  { id: 'pizza', label: 'Pizza', icon: 'pizza-outline', productType: 'food' },
  { id: 'chicken', label: 'Chicken', icon: 'nutrition-outline', productType: 'food' },
  { id: 'asian', label: 'Asian', icon: 'restaurant-outline', productType: 'food' },
  { id: 'beer', label: 'Beer', icon: 'beer-outline', productType: 'alcohol' },
  { id: 'wine', label: 'Wine', icon: 'wine-outline', productType: 'alcohol' },
  { id: 'spirits', label: 'Spirits', icon: 'flask-outline', productType: 'alcohol' },
  { id: 'mixers', label: 'Mixers', icon: 'water-outline', productType: 'alcohol' },
];

const CATEGORIES = [
  { id: 'All', label: 'All Stores', icon: 'grid-outline' },
  { id: 'burgers', label: 'Burgers', icon: 'fast-food-outline' },
  { id: 'pizza', label: 'Pizza', icon: 'pizza-outline' },
  { id: 'asian', label: 'Asian', icon: 'restaurant-outline' },
  { id: 'chicken', label: 'Chicken', icon: 'nutrition-outline' },
  { id: 'alcohol', label: 'Liquor 18+', icon: 'wine-outline', isAlcohol: true },
  { id: 'groceries', label: 'Groceries', icon: 'cart-outline' },
  { id: 'desserts', label: 'Desserts', icon: 'ice-cream-outline' },
];

export const BrowseScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { colors, typography } = useTheme();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>(route.params?.search || '');
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const isAlcohol = selectedCategory === 'alcohol' ? true : undefined;
      const cat = selectedCategory === 'alcohol' || selectedCategory === 'All' ? undefined : selectedCategory;
      const data = await storeService.getStores({
        category: cat,
        searchQuery,
        isAlcohol,
      });
      setStores(data);
    } catch (e) {
      console.warn('Browse error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, [selectedCategory, searchQuery]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Browse & Explore" subtitle="Discover top local merchants" />

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Ionicons name="search" size={20} color={colors.subtext} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder="Search stores or cuisines..."
            placeholderTextColor={colors.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.subtext} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills */}
      <View style={styles.categoriesSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isActive ? colors.secondary : colors.cardBackground,
                    borderColor: isActive ? colors.secondary : colors.divider,
                  },
                ]}
                onPress={() => {
                  if (cat.isAlcohol) {
                    navigation.navigate('AgeVerification');
                  }
                  setSelectedCategory(cat.id);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={16}
                  color={isActive ? '#FFFFFF' : colors.onSurface}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    typography.labelMedium,
                    { color: isActive ? '#FFFFFF' : colors.onSurface, fontWeight: isActive ? '700' : '500' },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Product Categories */}
      <View style={styles.categoriesSection}>
        <Text style={[typography.titleMedium, { color: colors.onSurface, marginHorizontal: 16, marginBottom: 10 }]}>
          Shop by category
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {PRODUCT_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryPill, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
              onPress={() => navigation.navigate('Category', { category: cat.id, productType: cat.productType })}
              activeOpacity={0.8}
            >
              <Ionicons name={cat.icon as any} size={16} color={colors.secondary} style={{ marginRight: 6 }} />
              <Text style={[typography.labelMedium, { color: colors.onSurface }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stores List */}
      {loading ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {[1, 2, 3].map((i) => (
            <StoreCardSkeleton key={i} />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <StoreCard
              store={item}
              onPress={(s) => navigation.navigate('StoreDetail', { storeId: s.id })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={colors.subtext} />
              <Text style={[typography.titleMedium, { color: colors.onSurface, marginTop: 12 }]}>
                No stores found
              </Text>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4 }]}>
                Try adjusting your search or category filter
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
  searchSection: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  categoriesSection: {
    marginVertical: 12,
  },
  categoryScroll: {
    paddingHorizontal: 16,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  listContent: {
    paddingBottom: 90,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
});
