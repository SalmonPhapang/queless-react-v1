import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
  BackHandler,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { supabase } from '../../config/supabaseClient';
import { appConfig } from '../../config/appConfig';
import { storeService } from '../../services/storeService';
import {
  recommendationService,
  ProductRecommendation,
  StoreRecommendation,
  UsualOrder,
} from '../../services/recommendationService';
import {
  deliveryLocationFromAddress,
  deliveryLocationFromCurrent,
  deliveryLocationService,
  DeliveryLocation,
  getDeliveryShortLabel,
} from '../../services/deliveryLocationService';
import { cartService } from '../../services/cartService';
import { locationService, LocationCoords } from '../../services/locationService';
import { Store } from '../../models/store';
import { Product } from '../../models/product';
import { Address } from '../../models/user';
import { StoreCard } from '../../components/StoreCard';
import { ProductCard } from '../../components/ProductCard';
import { SectionHeader } from '../../components/SectionHeader';
import { CartBanner } from '../../components/CartBanner';
import { Skeleton, StoreCardSkeleton, ProductCardSkeleton } from '../../components/Skeleton';
import { addProductToCart } from '../../utils/cartActions';
import { authService } from '../../services/authService';
import { cleanText, formatAddress } from '../../utils/address';

const DEFAULT_CUISINES = ['All', 'Fast Food', 'Pizza', 'Burgers', 'Asian', 'Desserts'];

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'stores' | 'items' | 'again'>('stores');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [stores, setStores] = useState<Store[]>([]);
  const [recommendedStores, setRecommendedStores] = useState<StoreRecommendation[]>([]);
  const [recommendedItems, setRecommendedItems] = useState<ProductRecommendation[]>([]);
  const [usualOrder, setUsualOrder] = useState<UsualOrder | null>(null);
  const [deliveryLabel, setDeliveryLabel] = useState('Add delivery address');
  const [deliveryFullAddress, setDeliveryFullAddress] = useState('No delivery address selected');
  const [deliverySource, setDeliverySource] = useState<'current' | 'saved' | 'none'>('none');
  const [selectedSavedAddress, setSelectedSavedAddress] = useState<Address | null>(null);
  const selectedSavedAddressRef = useRef<Address | null>(null);
  const [autoSavedAddress, setAutoSavedAddress] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [currentLocationOption, setCurrentLocationOption] = useState<{ shortLabel: string; fullAddress: string; coords: LocationCoords | null } | null>(null);
  const [selectingAddressId, setSelectingAddressId] = useState<string | null>(null);
  const [refreshingLocation, setRefreshingLocation] = useState(false);
  const [exitToast, setExitToast] = useState(false);
  const lastBackPress = useRef(0);
  const exitToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDeliveryFromManualAddress = (address: Address): DeliveryLocation =>
    deliveryLocationFromAddress(address);

  const loadData = async (selected?: Address | null, active?: DeliveryLocation | null) => {
    setError(null);
    try {
      let coords: LocationCoords | null = null;

      if (selected) {
        const d = getDeliveryFromManualAddress(selected);
        deliveryLocationService.setActive(d);
        coords = d.coords;
        setDeliveryLabel(d.shortLabel);
        setDeliveryFullAddress(d.fullAddress);
        setDeliverySource(d.source);
        setAutoSavedAddress(null);
      } else if (active) {
        // The address modal already resolved a fresh fix. Use that exact point
        // instead of resolving again and possibly falling back to a saved default.
        coords = active.coords;
        setDeliveryLabel(active.shortLabel || active.label);
        setDeliveryFullAddress(active.fullAddress || active.label);
        setDeliverySource(active.source);
        setAutoSavedAddress(active.source === 'saved' ? active.address : null);
      } else {
        const delivery = await deliveryLocationService.resolve();
        coords = delivery.coords;
        setDeliveryLabel(delivery.shortLabel || delivery.label);
        setDeliveryFullAddress(delivery.fullAddress || delivery.label);
        setDeliverySource(delivery.source);
        setAutoSavedAddress(delivery.source === 'saved' ? delivery.address : null);
      }

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      const [nearbyStores, storeRecs, productRecs, usual] = await Promise.all([
        coords
          ? storeService.getNearbyStores(coords.latitude, coords.longitude)
          : storeService.getStores({ isAlcohol: false }),
        recommendationService.getRecommendedStores(userId, coords),
        recommendationService.getRecommendedProducts(userId),
        recommendationService.getUsualOrder(userId),
      ]);

      // Food tab only: liquor has its own tab. If no nearby food store was
      // found, fall back to every approved food store.
      const nearbyFood = coords
        ? nearbyStores.filter((store) => !store.isAlcohol)
        : nearbyStores;
      setStores(
        nearbyFood.length > 0
          ? nearbyFood
          : await storeService.getStores({ isAlcohol: false })
      );
      setRecommendedStores(storeRecs.filter((rec) => !rec.store.isAlcohol));
      setRecommendedItems(
        productRecs.filter((rec) => rec.product.productType !== 'alcohol')
      );
      setUsualOrder(usual);
    } catch (e) {
      console.warn('Error loading home data:', e);
      setError('We could not load stores. Check your connection and try again.');
    } finally {
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    const active = deliveryLocationService.getActive();
    void loadData(
      selectedSavedAddressRef.current,
      active?.source === 'current' ? active : undefined
    );
  }, []);

  const openLocationModal = async () => {
    setLocationModalVisible(true);
    setAddressesLoading(true);
    try {
      const [user, current] = await Promise.all([
        authService.getCurrentSessionUser().catch(() => null),
        locationService.getCurrentLocation().catch(() => null),
      ]);
      setSavedAddresses(user?.addresses ?? []);

      if (current) {
        const resolved = await locationService
          .getAddressFromCoordinates(current.latitude, current.longitude)
          .catch(() => 'Current location');
        const full = cleanText(resolved) || 'Current location';
        const short = getDeliveryShortLabel(full, 'Current location');
        setCurrentLocationOption({ shortLabel: short, fullAddress: full, coords: current });
      } else {
        setCurrentLocationOption(null);
      }
    } finally {
      setAddressesLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setSelectingAddressId('__current__');
    try {
      const current = await locationService.getCurrentLocation({ forceRefresh: true });
      let active: DeliveryLocation | null = null;
      if (current) {
        const resolved = await locationService
          .getAddressFromCoordinates(current.latitude, current.longitude)
          .catch(() => 'Current location');
        const full = cleanText(resolved) || 'Current location';
        const short = getDeliveryShortLabel(full, 'Current location');
        setCurrentLocationOption({ shortLabel: short, fullAddress: full, coords: current });
        active = deliveryLocationFromCurrent(current, full);
        deliveryLocationService.setActive(active);
      } else {
        deliveryLocationService.setActive(null);
      }
      selectedSavedAddressRef.current = null;
      setSelectedSavedAddress(null);
      setLocationModalVisible(false);
      await loadData(null, active ?? undefined);
    } finally {
      setSelectingAddressId(null);
    }
  };

  const handleSelectSavedAddress = async (address: Address) => {
    setSelectingAddressId(address.id || address.label);
    try {
      const user = await authService.getCurrentSessionUser();
      if (user?.id) {
        const updated = (user.addresses ?? []).map((a) => ({
          ...a,
          isDefault:
            a.id && address.id
              ? a.id === address.id
              : a.label === address.label && a.streetAddress === address.streetAddress,
        }));
        await authService.saveAddresses(user.id, updated).catch(() => null);
        setSavedAddresses(updated);
      }
      selectedSavedAddressRef.current = address;
      setSelectedSavedAddress(address);
      setLocationModalVisible(false);
      await loadData(address);
    } finally {
      setSelectingAddressId(null);
    }
  };

  const refreshCurrentLocationInModal = async () => {
    setRefreshingLocation(true);
    try {
      const usingCurrent =
        deliveryLocationService.getActive()?.source === 'current' ||
        (deliverySource === 'current' && !selectedSavedAddressRef.current);
      const current = await locationService.getCurrentLocation({ forceRefresh: true });
      if (!current) {
        setCurrentLocationOption(null);
        const granted = await locationService.hasPermission().catch(() => false);
        setLocationDenied(!granted);
        if (usingCurrent) {
          deliveryLocationService.setActive(null);
          await loadData(null);
        }
        return;
      }

      const resolved = await locationService
        .getAddressFromCoordinates(current.latitude, current.longitude)
        .catch(() => 'Current location');
      const full = cleanText(resolved) || 'Current location';
      const short = getDeliveryShortLabel(full, 'Current location');
      setCurrentLocationOption({ shortLabel: short, fullAddress: full, coords: current });
      setLocationDenied(false);

      // If currently using device location, refresh the active delivery and nearby results too.
      if (usingCurrent) {
        const active = deliveryLocationFromCurrent(current, full);
        deliveryLocationService.setActive(active);
        setDeliveryLabel(short);
        setDeliveryFullAddress(full);
        await loadData(null, active);
      }
    } finally {
      setRefreshingLocation(false);
    }
  };

  // Android hardware back on the home tab should warn before exit.
  useFocusEffect(
    React.useCallback(() => {
      const exitToastTimerCleanup = () => {
        if (exitToastTimer.current) {
          clearTimeout(exitToastTimer.current);
          exitToastTimer.current = null;
        }
      };

      const onHardwareBack = () => {
        if (
          Platform.OS !== 'android' ||
          locationModalVisible ||
          navigation.canGoBack()
        ) {
          return false;
        }

        const now = Date.now();
        if (now - lastBackPress.current < 2500) {
          exitToastTimerCleanup();
          lastBackPress.current = 0;
          setExitToast(false);
          BackHandler.exitApp();
          return true;
        }

        lastBackPress.current = now;
        setExitToast(true);
        exitToastTimerCleanup();
        exitToastTimer.current = setTimeout(() => {
          setExitToast(false);
          lastBackPress.current = 0;
          exitToastTimer.current = null;
        }, 2500);
        return true;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => {
        backHandler.remove();
        exitToastTimerCleanup();
        setExitToast(false);
        lastBackPress.current = 0;
      };
    }, [locationModalVisible, navigation])
  );

  // Users who skipped the permission screen still need a way back to it.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      locationService.hasPermission().then((granted) => {
        if (!cancelled) setLocationDenied(!granted);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    const active = deliveryLocationService.getActive();
    await loadData(
      selectedSavedAddressRef.current,
      active?.source === 'current' ? active : undefined
    );
    setRefreshing(false);
  };

  const cuisineCategories = useMemo(() => {
    const values = new Set<string>(DEFAULT_CUISINES);
    for (const store of stores) {
      for (const type of store.cuisineTypes ?? []) {
        const cleaned = type.trim();
        if (cleaned) values.add(cleaned);
      }
      const category = store.category?.trim();
      if (category && category.toLowerCase() !== 'general') values.add(category);
    }
    return Array.from(values);
  }, [stores]);

  const visibleStores = useMemo(() => {
    if (selectedCuisine === 'All') return stores;
    const needle = selectedCuisine.toLowerCase();
    return stores.filter(
      (store) =>
        (store.cuisineTypes ?? []).some((type) => type.toLowerCase() === needle) ||
        store.category?.toLowerCase() === needle
    );
  }, [stores, selectedCuisine]);

  const findStore = (product: Product): Store | undefined =>
    stores.find((candidate) => candidate.id === product.storeId) ??
    recommendedStores.find((rec) => rec.store.id === product.storeId)?.store;

  const handleAddToCart = (product: Product) => {
    const store = findStore(product);
    const storeId = store?.id || product.storeId;
    if (!storeId) return;

    // Sign-in, age and store-switch rules live in one place.
    void addProductToCart({
      navigation,
      product,
      store,
      storeId,
      storeName: store?.name,
    });
  };

  const handleReorder = async () => {
    if (!usualOrder) return;
    const availableCount = usualOrder.items.filter((item) => item.available).length;
    if (!usualOrder.storeOpen || availableCount === 0) {
      Alert.alert('Order Again', 'Those items are no longer available.');
      return;
    }

    const reorder = async () => {
      const added = await recommendationService.addUsualOrderToCart(usualOrder);
      if (added > 0) {
        navigation.navigate('Cart');
      } else {
        Alert.alert('Order Again', 'Those items are no longer available.');
      }
    };

    if (cartService.isDifferentStore(usualOrder.storeId)) {
      Alert.alert(
        'Start a new cart?',
        `Adding ${usualOrder.storeName}'s usual order will clear your current cart.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start new cart', style: 'destructive', onPress: () => void reorder() },
        ]
      );
      return;
    }
    await reorder();
  };

  const availableAgainCount = usualOrder?.items.filter((item) => item.available).length ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Location Header */}
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
        <TouchableOpacity
          style={[styles.locationContainer, { marginRight: 10 }]}
          activeOpacity={0.85}
          onPress={() => void openLocationModal()}
        >
          <Ionicons name="location" size={20} color={colors.secondary} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[typography.labelSmall, { color: colors.subtext }]}>DELIVER TO</Text>
            <Text
              style={[typography.titleSmall, { color: colors.onSurface }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {deliveryLabel} ▾
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.qAiIconButton, { backgroundColor: colors.primaryContainer }]}
          onPress={() => navigation.navigate('QAiChat')}
          activeOpacity={0.8}
          accessibilityLabel="Ask Q"
          accessibilityRole="button"
        >
          <Ionicons name="sparkles" size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      {locationDenied && !error && (
        <TouchableOpacity
          style={[styles.locationBanner, { backgroundColor: colors.primaryContainer }]}
          onPress={() => navigation.navigate('LocationPermission')}
          activeOpacity={0.85}
        >
          <Ionicons name="location-outline" size={18} color={colors.secondary} />
          <Text style={[typography.bodySmall, { color: colors.onSurface, flex: 1, marginHorizontal: 8 }]}>
            Turn on location so we can show stores that deliver to you.
          </Text>
          <Text style={[typography.labelMedium, { color: colors.secondary, fontWeight: '700' }]}>Enable</Text>
        </TouchableOpacity>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>{error}</Text>
          <TouchableOpacity onPress={() => void loadData(selectedSavedAddressRef.current)}>
            <Text style={[typography.labelMedium, { color: colors.secondary, fontWeight: '700' }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.secondary]} />}
      >
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <Ionicons name="search" size={20} color={colors.subtext} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.onSurface }]}
              placeholder="Search restaurants or cuisines..."
              placeholderTextColor={colors.subtext}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => navigation.navigate('Browse', { search: searchQuery })}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.subtext} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Cuisine filters, mirroring Flutter's CategoryChips. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cuisineScroll}
        >
          {cuisineCategories.map((category) => {
            const selected = category === selectedCuisine;
            return (
              <TouchableOpacity
                key={category}
                style={[
                  styles.cuisineChip,
                  {
                    backgroundColor: selected ? colors.secondary : colors.cardBackground,
                    borderColor: selected ? colors.secondary : colors.divider,
                  },
                ]}
                onPress={() => setSelectedCuisine(category)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    typography.labelMedium,
                    { color: selected ? '#FFFFFF' : colors.subtext, fontWeight: '700' },
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Unified "For You" hub: recommendation-service results. */}
        <View style={styles.hubContainer}>
          <View style={styles.minimalTabs}>
            {(['stores', 'items', 'again'] as const).map((tab) => {
              const label = tab === 'stores' ? 'Stores' : tab === 'items' ? 'Items' : 'Order Again';
              const active = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={styles.minimalTab}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      typography.titleSmall,
                      {
                        color: active ? colors.secondary : colors.subtext,
                        fontWeight: active ? '700' : '500',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                  {active && (
                    <View style={[styles.minimalUnderline, { backgroundColor: colors.secondary }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {!hasLoadedOnce ? (
          <View>
            {activeTab === 'items' ? (
              <View style={{ paddingHorizontal: 8 }}>
                <View style={{ paddingHorizontal: 8, marginTop: 8, marginBottom: 4 }}>
                  <Skeleton width={140} height={22} borderRadius={6} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4].map((i) => (
                    <View key={i} style={{ width: '50%' }}>
                      <ProductCardSkeleton />
                    </View>
                  ))}
                </View>
              </View>
            ) : activeTab === 'again' ? (
              <View>
                <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 8 }}>
                  <Skeleton width={160} height={22} borderRadius={6} />
                </View>
                <View
                  style={[
                    styles.orderAgainCard,
                    { backgroundColor: colors.cardBackground, borderColor: colors.divider },
                  ]}
                >
                  <View style={styles.orderAgainHeader}>
                    <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Skeleton width="60%" height={18} borderRadius={6} style={{ marginBottom: 8 }} />
                      <Skeleton width="40%" height={14} borderRadius={6} />
                    </View>
                  </View>
                  <Skeleton width="100%" height={44} borderRadius={12} style={{ marginTop: 16 }} />
                </View>
              </View>
            ) : (
              <View>
                <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
                  <Skeleton width={120} height={22} borderRadius={6} style={{ marginBottom: 12 }} />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recommendationScroll}
                >
                  {[1, 2].map((i) => (
                    <StoreCardSkeleton key={i} horizontal />
                  ))}
                </ScrollView>
                <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
                  <Skeleton width={170} height={22} borderRadius={6} style={{ marginBottom: 8 }} />
                </View>
                {[1, 2, 3].map((i) => (
                  <StoreCardSkeleton key={i} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
            {activeTab === 'stores' && (
              <View>
                {recommendedStores.length > 0 && (
                  <View>
                    <SectionHeader title="For You" actionText="" />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.recommendationScroll}
                    >
                      {recommendedStores.map((rec) => (
                        <StoreCard
                          key={rec.store.id}
                          store={rec.store}
                          horizontal
                          badge={rec.reason}
                          onPress={(store) => navigation.navigate('StoreDetail', { storeId: store.id })}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}

                <SectionHeader title="Nearby Restaurants" onActionPress={() => navigation.navigate('Browse')} />
                {visibleStores.map((store) => (
                  <StoreCard
                    key={store.id}
                    store={store}
                    onPress={(s) => navigation.navigate('StoreDetail', { storeId: s.id })}
                  />
                ))}
                {visibleStores.length === 0 && (
                  <Text style={[typography.bodyMedium, { color: colors.subtext, textAlign: 'center', marginVertical: 20 }]}>
                    No restaurants match {selectedCuisine}.
                  </Text>
                )}
              </View>
            )}

            {activeTab === 'items' && (
              <View>
                <SectionHeader title="Picked for You" />
                {recommendedItems.length > 0 ? (
                  <FlatList
                    data={recommendedItems}
                    numColumns={2}
                    scrollEnabled={false}
                    keyExtractor={(item) => item.product.id}
                    renderItem={({ item }) => (
                      <ProductCard
                        product={item.product}
                        badge={item.reason}
                        onPress={(product) =>
                          navigation.navigate('ProductDetail', {
                            product,
                            storeId: product.storeId || findStore(product)?.id,
                            store: findStore(product),
                          })
                        }
                        onAddToCart={handleAddToCart}
                      />
                    )}
                  />
                ) : (
                  <Text style={[typography.bodyMedium, { color: colors.subtext, textAlign: 'center', marginVertical: 20 }]}>
                    Your personal picks will appear once you browse and order.
                  </Text>
                )}
              </View>
            )}

            {activeTab === 'again' && (
              <View>
                <SectionHeader title="Your Usual Order" />
                {usualOrder ? (
                  <View style={[styles.orderAgainCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                    <View style={styles.orderAgainHeader}>
                      <View style={[styles.repeatIcon, { backgroundColor: colors.primaryContainer }]}>
                        <Ionicons name="repeat" size={20} color={colors.secondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.titleMedium, { color: colors.onSurface }]} numberOfLines={1}>
                          {usualOrder.storeName}
                        </Text>
                        <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]}>
                          {availableAgainCount} item{availableAgainCount === 1 ? '' : 's'} ·{' '}
                          {appConfig.formatCurrency(usualOrder.currentSubtotal)}
                        </Text>
                        {usualOrder.unavailableCount > 0 && (
                          <Text style={[typography.bodySmall, { color: colors.error, marginTop: 2 }]}>
                            {usualOrder.unavailableCount} item(s) no longer available
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.reorderButton, { backgroundColor: colors.secondary }]}
                      onPress={() => void handleReorder()}
                      activeOpacity={0.85}
                    >
                      <Text style={[typography.titleSmall, { color: '#FFFFFF', fontWeight: '700' }]}>
                        {usualOrder.storeOpen ? 'Add usual items to cart' : 'Store is closed'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={[typography.bodyMedium, { color: colors.subtext, textAlign: 'center', marginVertical: 20 }]}>
                    Complete an order and your usual basket will appear here.
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Floating Cart Banner */}
      <CartBanner onPressCart={() => navigation.navigate('Cart')} />

      <Modal
        visible={locationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setLocationModalVisible(false)}
          />
          <View style={[styles.modalCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.headlineSmall, { color: colors.onSurface, fontWeight: '700' }]}>
                Delivery address
              </Text>
              <TouchableOpacity onPress={() => setLocationModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.subtext} />
              </TouchableOpacity>
            </View>

            <View style={[styles.currentAddressBox, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[typography.labelSmall, { color: colors.subtext }]}>CURRENTLY DELIVERING TO</Text>
                <TouchableOpacity
                  onPress={() => void refreshCurrentLocationInModal()}
                  disabled={refreshingLocation || selectingAddressId !== null}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Refresh location"
                  accessibilityRole="button"
                >
                  {refreshingLocation ? (
                    <ActivityIndicator size="small" color={colors.secondary} />
                  ) : (
                    <Ionicons name="refresh-outline" size={18} color={colors.secondary} />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={[typography.titleSmall, { color: colors.onSurface }]}>{deliveryLabel}</Text>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4 }]}>
                {deliveryFullAddress}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.secondary, marginTop: 8 }]}>
                Not the right address? Select a saved address below, use your current location, or tap refresh to update your location.
              </Text>
            </View>

            {addressesLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={colors.secondary} />
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={[
                    styles.addressOption,
                    {
                      borderColor:
                        deliverySource === 'current' && !selectedSavedAddress ? colors.secondary : colors.divider,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  onPress={() => void handleUseCurrentLocation()}
                  activeOpacity={0.85}
                  disabled={selectingAddressId !== null}
                >
                  <View style={[styles.optionIcon, { backgroundColor: colors.primaryContainer }]}>
                    <Ionicons name="navigate" size={16} color={colors.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.titleSmall, { color: colors.onSurface }]}>Use current location</Text>
                    <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]} numberOfLines={2}>
                      {currentLocationOption?.fullAddress || 'Use your device location for delivery'}
                    </Text>
                  </View>
                  {selectingAddressId === '__current__' ? (
                    <ActivityIndicator size="small" color={colors.secondary} />
                  ) : deliverySource === 'current' && !selectedSavedAddress ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.secondary} />
                  ) : null}
                </TouchableOpacity>

                {savedAddresses.map((address, idx) => {
                  const active = selectedSavedAddress || (deliverySource === 'saved' ? autoSavedAddress : null);
                  const isSelected =
                    !!active &&
                    ((active.id && address.id && active.id === address.id) ||
                      (!active.id &&
                        active.streetAddress === address.streetAddress &&
                        active.label === address.label &&
                        active.city === address.city));
                  const optionKey = address.id || `${address.label}-${idx}`;
                  const short = cleanText(address.streetAddress) || cleanText(address.label) || 'Saved address';
                  const full = formatAddress(address, address.label || 'Saved address');
                  const busy = selectingAddressId === (address.id || address.label);
                  return (
                    <TouchableOpacity
                      key={optionKey}
                      style={[
                        styles.addressOption,
                        {
                          borderColor: isSelected ? colors.secondary : colors.divider,
                          backgroundColor: colors.surface,
                        },
                      ]}
                      onPress={() => void handleSelectSavedAddress(address)}
                      activeOpacity={0.85}
                      disabled={selectingAddressId !== null}
                    >
                      <View style={[styles.optionIcon, { backgroundColor: colors.primaryContainer }]}>
                        <Ionicons
                          name={address.label?.toLowerCase() === 'home' ? 'home-outline' : 'location-outline'}
                          size={16}
                          color={colors.secondary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.titleSmall, { color: colors.onSurface }]}>
                          {short}
                          {address.isDefault ? ' • Default' : ''}
                        </Text>
                        <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]} numberOfLines={2}>
                          {full}
                        </Text>
                      </View>
                      {busy ? (
                        <ActivityIndicator size="small" color={colors.secondary} />
                      ) : isSelected ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.secondary} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}

                {savedAddresses.length === 0 && (
                  <Text style={[typography.bodySmall, { color: colors.subtext, textAlign: 'center', marginTop: 8 }]}>
                    No saved addresses yet. Add one to select it quickly next time.
                  </Text>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.manageBtn, { borderColor: colors.divider }]}
              onPress={() => {
                setLocationModalVisible(false);
                navigation.navigate('AddressManagement');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.secondary} />
              <Text style={[typography.titleSmall, { color: colors.secondary, marginLeft: 8, fontWeight: '700' }]}>
                Add or manage addresses
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {exitToast && (
        <View
          style={[styles.exitToast, { backgroundColor: colors.onSurface }]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[typography.bodyMedium, styles.exitToastText, { color: colors.surface }]}>
            Press back again to exit
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  qAiIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  currentAddressBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  addressOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  optionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  scrollContent: {
    paddingBottom: 90,
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
  cuisineScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cuisineChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 8,
  },
  recommendationScroll: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  hubContainer: {
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  minimalTabs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  minimalTab: {
    marginRight: 24,
    paddingVertical: 6,
    alignItems: 'flex-start',
  },
  minimalUnderline: {
    height: 2,
    width: '100%',
    borderRadius: 1,
    marginTop: 4,
  },
  orderAgainCard: {
    marginHorizontal: 16,
    marginTop: 4,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  orderAgainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  repeatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reorderButton: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  exitToast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 92,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 100,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  exitToastText: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
