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
import { useTheme } from '../../theme/theme';
import {
  Product,
  ProductOption,
  ProductOptionGroup,
  SelectedOption,
  PRODUCT_FEE_RATE,
} from '../../models/product';
import { Store } from '../../models/store';
import { cartService } from '../../services/cartService';
import { storeService } from '../../services/storeService';
import { addProductToCart } from '../../utils/cartActions';
import { StatusMessage } from '../../components/StatusMessage';
import { SmartImage } from '../../components/SmartImage';
import { appConfig } from '../../config/appConfig';

interface ProductOptionsScreenProps {
  navigation: any;
  route: any;
}

export const ProductOptionsScreen: React.FC<ProductOptionsScreenProps> = ({ navigation, route }) => {
  const { colors, typography } = useTheme();
  const product: Product = route.params?.product;
  const passedStore: Store | undefined = route.params?.store;
  const storeId: string | undefined = route.params?.storeId ?? passedStore?.id ?? product?.storeId;
  const storeName: string | undefined = route.params?.storeName ?? passedStore?.name;
  // Callers that already hold the store pass its nature, so this screen does
  // not need its own store query.
  const isFoodParam: boolean | undefined =
    route.params?.isFood ?? (passedStore ? !passedStore.isAlcohol : undefined);

  const [selections, setSelections] = useState<Record<string, ProductOption[]>>(() => {
    const initial: Record<string, ProductOption[]> = {};
    (product?.optionGroups ?? []).forEach((group) => {
      initial[group.name] = [];
    });
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [attemptedAdd, setAttemptedAdd] = useState(false);
  const [store, setStore] = useState<Store | null>(passedStore ?? null);

  useEffect(() => {
    let cancelled = false;
    const loadStore = async () => {
      if (passedStore) {
        if (!cancelled) setStore(passedStore);
        return;
      }
      if (!storeId) return;
      try {
        const fresh = await storeService.getStoreById(storeId);
        if (!cancelled) setStore(fresh);
      } catch {
        // keep unavailable
      }
    };
    void loadStore();
    return () => {
      cancelled = true;
    };
  }, [storeId, passedStore]);

  if (!product) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface }]}>
        <Text style={[typography.bodyMedium, { color: colors.subtext }]}>
          This item is no longer available.
        </Text>
      </View>
    );
  }

  const toggleOption = (group: ProductOptionGroup, option: ProductOption) => {
    setAttemptedAdd(false);
    setSelections((current) => {
      const currentGroup = current[group.name] ?? [];
      if (group.multiSelect) {
        const nextGroup = currentGroup.some((o) => o.name === option.name)
          ? currentGroup.filter((o) => o.name !== option.name)
          : [...currentGroup, option];
        return { ...current, [group.name]: nextGroup };
      }
      return { ...current, [group.name]: [option] };
    });
  };

  const isSelected = (group: ProductOptionGroup, option: ProductOption) =>
    (selections[group.name] ?? []).some((o) => o.name === option.name);

  const missingRequired = product.optionGroups.some(
    (group) => group.isRequired && (selections[group.name] ?? []).length === 0
  );

  const optionsTotal = Object.values(selections)
    .flat()
    .reduce((sum, option) => sum + Math.floor(option.price * (1 + PRODUCT_FEE_RATE)), 0);
  const total = (product.price + optionsTotal) * quantity;

  const addToCart = async () => {
    if (storeClosed) {
      Alert.alert('Store closed', store?.nextOpeningTime || 'This store is currently closed and will open soon.');
      return;
    }
    if (missingRequired) {
      setAttemptedAdd(true);
      Alert.alert('Required options', 'Please select all required options');
      return;
    }

    setIsAdding(true);
    try {
      // Revalidate latest store state before adding.
      let currentStore = store;
      if (storeId) {
        try {
          const fresh = await storeService.getStoreById(storeId);
          if (fresh) {
            currentStore = fresh;
            setStore(fresh);
          }
        } catch {
          // fall back to last known
        }
      }
      if (currentStore && !currentStore.isOpen) {
        Alert.alert('Store closed', currentStore.nextOpeningTime || 'This store is currently closed and will open soon.');
        return;
      }

      const selectedOptions: SelectedOption[] = Object.entries(selections).flatMap(
        ([groupName, options]) =>
          options.map((option) => ({
            groupName,
            optionName: option.name,
            priceAdjustment: option.price,
          }))
      );

      const resolvedStoreId = storeId ?? product.storeId;
      if (!resolvedStoreId) return;

      if (storeId) {
        // Defensive: keep the context correct even if the store lookup above
        // failed or has not resolved yet. Product type is the best fallback.
        cartService.updateStoreContext(storeId, {
          isFood: (currentStore ? !currentStore.isAlcohol : isFoodParam) ?? product.productType === 'food',
        });
      }
      const added = await addProductToCart({
        navigation,
        product,
        store: currentStore,
        storeId: resolvedStoreId,
        storeName: currentStore?.name ?? storeName,
        quantity,
        selectedOptions,
      });
      if (added) navigation.goBack();
    } catch (e) {
      Alert.alert('Could not add to cart', e instanceof Error ? e.message : String(e));
    } finally {
      setIsAdding(false);
    }
  };

  const storeClosed = store?.isOpen === false;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.handleBar} />

      <View style={[styles.headerRow, { borderBottomColor: colors.divider }]}>
        <Text style={[typography.titleLarge, { color: colors.onSurface, fontWeight: '800', flex: 1 }]}>
          Customise your order
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.productHeader}>
          <SmartImage
            source={{ uri: product.imageUrl }}
            style={styles.productImage}
            fallbackIcon="fast-food-outline"
          />
          <View style={styles.productHeaderText}>
            <Text style={[typography.titleLarge, { color: colors.onSurface, fontWeight: '800' }]}>
              {product.name}
            </Text>
            <Text
              style={[typography.bodyMedium, { color: colors.subtext, marginTop: 4 }]}
              numberOfLines={2}
            >
              {product.description}
            </Text>
            <Text
              style={[typography.titleMedium, { color: colors.secondary, fontWeight: '800', marginTop: 8 }]}
            >
              {appConfig.formatCurrency(product.price)}
            </Text>
          </View>
        </View>

        {product.optionGroups.map((group) => {
          const showError = attemptedAdd && group.isRequired && (selections[group.name] ?? []).length === 0;
          return (
            <View key={group.name} style={[styles.group, { borderTopColor: colors.divider }]}>
              <View style={styles.groupHeader}>
                <Text style={[typography.titleMedium, { color: colors.onSurface, fontWeight: '800' }]}>
                  {group.name}
                </Text>
                {group.isRequired && (
                  <View
                    style={[
                      styles.requiredPill,
                      { backgroundColor: showError ? colors.errorContainer : colors.primaryContainer },
                    ]}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: showError ? colors.error : colors.secondary, fontWeight: '800' },
                      ]}
                    >
                      REQUIRED
                    </Text>
                  </View>
                )}
              </View>

              {showError && (
                <Text style={[typography.bodySmall, { color: colors.error, marginTop: 8, fontWeight: '600' }]}>
                  Please select an option
                </Text>
              )}

              {group.options.map((option) => {
                const selected = isSelected(group, option);
                const priceAdjustment = Math.floor(option.price * (1 + PRODUCT_FEE_RATE));
                return (
                  <TouchableOpacity
                    key={option.name}
                    style={styles.optionRow}
                    onPress={() => toggleOption(group, option)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          typography.bodyLarge,
                          { color: colors.onSurface, fontWeight: selected ? '700' : '500' },
                        ]}
                      >
                        {option.name}
                      </Text>
                      {priceAdjustment !== 0 && (
                        <Text
                          style={[typography.bodySmall, { color: colors.secondary, fontWeight: '600' }]}
                        >
                          + {appConfig.formatCurrency(priceAdjustment)}
                        </Text>
                      )}
                    </View>

                    <Ionicons
                      name={
                        group.multiSelect
                          ? selected
                            ? 'checkbox'
                            : 'square-outline'
                          : selected
                          ? 'radio-button-on'
                          : 'radio-button-off'
                      }
                      size={22}
                      color={selected ? colors.secondary : colors.subtext}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {storeClosed ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.surface, borderTopColor: colors.divider, paddingBottom: 32 },
          ]}
        >
          <View
            style={[
              styles.unavailableBox,
              { borderColor: colors.error, backgroundColor: colors.errorContainer ?? 'rgba(220,38,38,0.08)' },
            ]}
          >
            <Text style={[typography.titleMedium, { color: colors.error, fontWeight: '800', textAlign: 'center' }]}>
              Store is currently closed
            </Text>
            <Text
              style={[
                typography.bodySmall,
                { color: colors.error, marginTop: 4, opacity: 0.85, textAlign: 'center' },
              ]}
            >
              {store?.nextOpeningTime || 'This store is currently closed and will open soon.'}
            </Text>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.surface, borderTopColor: colors.divider, paddingBottom: 32 },
          ]}
        >
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
            style={[
              styles.addButton,
              { backgroundColor: missingRequired ? colors.divider : colors.secondary },
            ]}
            onPress={addToCart}
            disabled={isAdding}
            activeOpacity={0.85}
          >
            {isAdding ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '800' }]}>
                Add to Cart {appConfig.formatCurrency(total)}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.35)',
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  productHeader: {
    flexDirection: 'row',
    padding: 24,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
  },
  productHeaderText: {
    flex: 1,
    marginLeft: 16,
  },
  group: {
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  requiredPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  quantityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  quantityButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  unavailableBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
});
