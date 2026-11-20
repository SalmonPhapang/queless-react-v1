import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { Store } from '../../models/store';
import { storeService } from '../../services/storeService';
import { locationService } from '../../services/locationService';
import { sortStoresByAvailabilityAndDistance } from '../../utils/storeSort';
import { deliveryLocationService } from '../../services/deliveryLocationService';
import { cartService } from '../../services/cartService';
import { authService } from '../../services/authService';
import { StoreCard } from '../../components/StoreCard';
import { CartBanner } from '../../components/CartBanner';
import { StoreCardSkeleton, Skeleton } from '../../components/Skeleton';

const CATEGORIES = ['All', 'Beer', 'Wine', 'Spirits', 'Mixers'];

interface LiquorHomeScreenProps {
  navigation: any;
}

export const LiquorHomeScreen: React.FC<LiquorHomeScreenProps> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('Guest');
  const [ageVerified, setAgeVerified] = useState<boolean | null>(null);

  const loadStores = useCallback(async () => {
    setLocationError(null);
    try {
      // Current location first, then the user's default/first saved address.
      const delivery = await deliveryLocationService.resolve();
      const location = delivery.coords;

      if (!location) {
        // No GPS fix and no usable saved address: list every liquor store.
        setLocationError('Location unavailable. Showing all liquor stores.');
        const fallback = await storeService.getStores({ isAlcohol: true });
        fallback.forEach((store) => cartService.registerStore(store));
        setStores(sortStoresByAvailabilityAndDistance(fallback));
        return;
      }

      const liquorStores = await storeService.getStores({ isAlcohol: true });

      const withDistance = liquorStores.map((store) => {
        cartService.registerStore(store);

        const parts = store.location ? store.location.split(',') : [];
        if (parts.length !== 2) return store;

        const lat = Number(parts[0].trim());
        const lng = Number(parts[1].trim());
        if (isNaN(lat) || isNaN(lng)) return store;

        const distanceKm = locationService.calculateDistanceKm(
          location.latitude,
          location.longitude,
          lat,
          lng
        );

        // Distance drives the delivery fee tier; the card shows km.
        cartService.updateStoreContext(store.id, { distanceMeters: distanceKm * 1000 });

        return { ...store, distance: distanceKm };
      });

      setStores(sortStoresByAvailabilityAndDistance(withDistance));
    } catch (e) {
      console.warn('Error loading liquor stores:', e);
      setLocationError('Location unavailable. Showing all liquor stores.');
      try {
        const fallback = await storeService.getStores({ isAlcohol: true });
        fallback.forEach((store) => cartService.registerStore(store));
        setStores(sortStoresByAvailabilityAndDistance(fallback));
      } catch (fallbackError) {
        console.warn('Error loading fallback liquor stores:', fallbackError);
      }
    }
  }, []);

  // Re-check on focus so returning from age verification unlocks the section.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      authService.getCurrentSessionUser().then((user) => {
        if (cancelled) return;
        setAgeVerified(!!user?.ageVerified);
        if (user?.fullName) setFirstName(user.fullName.split(' ')[0]);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useEffect(() => {
    if (ageVerified !== true) return;
    const load = async () => {
      await loadStores();
      setLoading(false);
    };
    load();
  }, [ageVerified, loadStores]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStores();
    setRefreshing(false);
  };

  const filteredStores = stores.filter((store) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      store.cuisineTypes.some(
        (type) => type.toLowerCase() === selectedCategory.toLowerCase()
      );

    const query = searchQuery.toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      store.name.toLowerCase().includes(query) ||
      store.cuisineTypes.some((type) => type.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });

  if (ageVerified === false) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <View
          style={[
            styles.topHeader,
            {
              backgroundColor: colors.appBarBackground,
              borderBottomColor: colors.divider,
              paddingTop: insets.top + 12,
            },
          ]}
        >
          <Ionicons name="wine" size={20} color={colors.secondary} />
          <Text style={[typography.titleLarge, { color: colors.onSurface, marginLeft: 8 }]}>
            Liquor Delivery
          </Text>
        </View>

        <View style={styles.centered}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="shield-checkmark-outline" size={56} color={colors.secondary} />
          </View>
          <Text
            style={[
              typography.titleLarge,
              { color: colors.onSurface, fontWeight: '900', textAlign: 'center', marginTop: 24 },
            ]}
          >
            Age verification required
          </Text>
          <Text
            style={[
              typography.bodyMedium,
              { color: colors.subtext, textAlign: 'center', marginTop: 12, lineHeight: 22 },
            ]}
          >
            South African law requires us to verify that you are 18 or older before
            you can browse or order alcohol.
          </Text>
          <TouchableOpacity
            style={[styles.exploreButton, { backgroundColor: colors.secondary }]}
            onPress={() => navigation.navigate('AgeVerification')}
            activeOpacity={0.85}
          >
            <Text style={[typography.titleSmall, { color: '#FFFFFF', fontWeight: '800' }]}>
              Verify my age
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View
        style={[
          styles.topHeader,
          {
            backgroundColor: colors.appBarBackground,
            borderBottomColor: colors.divider,
            paddingTop: insets.top + 12,
          },
        ]}
      >
        <Ionicons name="wine" size={20} color={colors.secondary} />
        <Text style={[typography.titleLarge, { color: colors.onSurface, marginLeft: 8 }]}>
          Liquor Delivery
        </Text>
      </View>

      {loading ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Skeleton width={180} height={28} borderRadius={8} style={{ marginHorizontal: 16, marginBottom: 8 }} />
          <Skeleton width={240} height={16} borderRadius={6} style={{ marginHorizontal: 16 }} />
          <Skeleton width="auto" height={48} borderRadius={12} style={{ marginTop: 20, marginHorizontal: 16 }} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width={72} height={34} borderRadius={20} style={{ marginRight: 8 }} />
            ))}
          </ScrollView>
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <Skeleton width={180} height={22} borderRadius={6} />
          </View>
          {[1, 2, 3].map((i) => (
            <StoreCardSkeleton key={i} />
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.secondary]} />
          }
        >
          <Text style={[typography.headlineMedium, { color: colors.onSurface, marginHorizontal: 16 }]}>
            Hello, {firstName}!
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.subtext, marginTop: 6, marginHorizontal: 16 }]}>
            What would you like to drink today?
          </Text>

          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.cardBackground, borderColor: colors.divider },
            ]}
          >
            <Ionicons name="search" size={20} color={colors.subtext} />
            <TextInput
              style={[styles.searchInput, { color: colors.onSurface }]}
              placeholder="Search liquor stores or drinks..."
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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((category) => {
              const isSelected = category === selectedCategory;
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected ? colors.secondary : colors.cardBackground,
                      borderColor: isSelected ? colors.secondary : colors.divider,
                    },
                  ]}
                  onPress={() => setSelectedCategory(category)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      typography.labelMedium,
                      { color: isSelected ? '#FFFFFF' : colors.onSurface, fontWeight: '700' },
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.titleLarge, { color: colors.onSurface, fontWeight: '700' }]}>
                Nearby Liquor Stores
              </Text>
              {locationError && (
                <Text style={[typography.bodySmall, { color: colors.error, marginTop: 4 }]}>
                  {locationError}
                </Text>
              )}
            </View>
            {locationError && (
              <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
                <Ionicons name="refresh" size={20} color={colors.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {filteredStores.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primaryContainer }]}>
                <Ionicons name="search-outline" size={56} color={colors.secondary} />
              </View>
              <Text
                style={[
                  typography.titleLarge,
                  { color: colors.onSurface, fontWeight: '900', textAlign: 'center', marginTop: 24 },
                ]}
              >
                {searchQuery
                  ? `No liquor stores found for "${searchQuery}"`
                  : stores.length === 0
                  ? 'No liquor stores available nearby'
                  : `No liquor stores found for ${selectedCategory}`}
              </Text>

              {stores.length === 0 && !searchQuery && (
                <>
                  <Text
                    style={[
                      typography.bodyMedium,
                      { color: colors.subtext, textAlign: 'center', marginTop: 12, lineHeight: 22 },
                    ]}
                  >
                    We are expanding our liquor delivery zones. Why not check out the food
                    section in the meantime?
                  </Text>
                  <TouchableOpacity
                    style={[styles.exploreButton, { backgroundColor: colors.secondary }]}
                    onPress={() => navigation.navigate('FoodTab')}
                    activeOpacity={0.85}
                  >
                    <Text style={[typography.titleSmall, { color: '#FFFFFF', fontWeight: '800' }]}>
                      Explore Food
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            filteredStores.map((store) => (
              <StoreCard
                key={store.id}
                store={store}
                onPress={(selected) => navigation.navigate('StoreDetail', { storeId: selected.id })}
              />
            ))
          )}
        </ScrollView>
      )}

      <CartBanner onPressCart={() => navigation.navigate('Cart')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 100,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginTop: 20,
    marginHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
  },
  categoryScroll: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginHorizontal: 16,
  },
  retryButton: {
    padding: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  emptyIcon: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreButton: {
    height: 50,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
});
