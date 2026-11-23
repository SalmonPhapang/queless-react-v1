import React, { useState } from 'react';
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
import { Header } from '../../components/Header';
import { SmartImage } from '../../components/SmartImage';
import { appConfig } from '../../config/appConfig';
import {
  BudgetBasket,
  budgetBasketCanCheckout,
  budgetMealService,
} from '../../services/budgetMealService';
import { cartService } from '../../services/cartService';

interface BudgetBasketScreenProps {
  navigation: any;
  route: { params?: { basket?: BudgetBasket; budget?: number; servings?: number } };
}

/** Destination after qai_build_budget_basket succeeds — the basket is no longer
 *  buried below the plan list on the same screen. */
export const BudgetBasketScreen: React.FC<BudgetBasketScreenProps> = ({ navigation, route }) => {
  const { colors, typography } = useTheme();
  const layout = useResponsiveLayout();
  const basket = route.params?.basket;
  const [adding, setAdding] = useState(false);

  if (!basket) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Header title="Basket" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.centered}>
          <Text style={[typography.bodyMedium, { color: colors.subtext }]}>
            This basket is no longer available. Go back and choose a plan again.
          </Text>
        </View>
      </View>
    );
  }

  const canAdd = budgetBasketCanCheckout(basket);

  const addToCart = async () => {
    if (!canAdd) return;
    setAdding(true);
    try {
      const added = await budgetMealService.addAllToCart(basket);
      await cartService.markAiAssisted();
      Alert.alert(
        'Added to cart',
        added > 0
          ? `${added} item${added === 1 ? '' : 's'} from ${basket.storeName || 'the store'} are in your cart.`
          : 'None of these items could be added.',
        [
          { text: 'Keep browsing', style: 'cancel' },
          { text: 'View cart', onPress: () => navigation.navigate('Cart') },
        ]
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Your budget basket" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={responsiveContentStyle(layout, styles.content)}>
        <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Text style={[typography.headlineSmall, { color: colors.onSurface }]}>
            {basket.storeName || 'Basket'}
          </Text>
          <View style={styles.summaryRow}>
            <Text style={[typography.bodyMedium, { color: colors.secondary, fontWeight: '800' }]}>
              {appConfig.formatCurrency(basket.totalCost)}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.subtext }]}>
              {appConfig.formatCurrency(basket.perPersonCost)} per person
            </Text>
          </View>
          <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 6 }]}>
            {basket.itemCount} items · {basket.servings} servings ·{' '}
            {basket.withinBudget ? 'Within budget' : 'Over budget'}
          </Text>
          {typeof basket.budgetHeadroom === 'number' ? (
            <Text style={[typography.labelSmall, { color: colors.subtext, marginTop: 4 }]}>
              {basket.budgetHeadroom >= 0
                ? `${appConfig.formatCurrency(basket.budgetHeadroom)} left in your budget`
                : `${appConfig.formatCurrency(Math.abs(basket.budgetHeadroom))} over your budget`}
            </Text>
          ) : null}
          {!!basket.warning && (
            <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 8 }]}>
              {basket.warning}
            </Text>
          )}
        </View>

        <Text style={[typography.titleMedium, { color: colors.onSurface, marginTop: 20, marginBottom: 8 }]}>
          Items from this store
        </Text>

        {basket.products.map((product) => (
          <View
            key={product.id}
            style={[styles.productRow, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
          >
            <SmartImage
              source={{ uri: product.imageUrl }}
              style={styles.productImage}
              fallbackIcon="fast-food-outline"
              fallbackIconSize={20}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[typography.titleSmall, { color: colors.onSurface }]} numberOfLines={1}>
                {product.name}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]}>
                {appConfig.formatCurrency(product.price)}
              </Text>
            </View>
          </View>
        ))}

        {basket.products.length === 0 && (
          <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 8 }]}>
            No products were matched at this store.
          </Text>
        )}

        {basket.missing.length > 0 && (
          <Text style={[typography.labelSmall, { color: colors.error, marginTop: 12 }]}>
            Unavailable: {basket.missing.map((item) => item.name || 'item').join(', ')}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.secondary, marginTop: 24 }]}
          onPress={() => void addToCart()}
          disabled={!canAdd || adding}
          activeOpacity={0.85}
        >
          {adding ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="cart-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={[typography.titleSmall, { color: '#FFFFFF', fontWeight: '800' }]}>
                Add {basket.itemCount} items to cart
              </Text>
            </>
          )}
        </TouchableOpacity>

        {basket.storeId && (
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.divider }]}
            onPress={() => navigation.navigate('StoreDetail', { storeId: basket.storeId })}
            activeOpacity={0.85}
          >
            <Text style={[typography.titleSmall, { color: colors.secondary, fontWeight: '700' }]}>
              Browse the store
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.divider }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={[typography.titleSmall, { color: colors.subtext, fontWeight: '700' }]}>
            Back to plans
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, paddingBottom: 40 },
  summaryCard: { borderWidth: 1, borderRadius: 14, padding: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  productImage: { width: 44, height: 44, borderRadius: 8 },
  primaryBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
});
