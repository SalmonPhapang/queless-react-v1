import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { responsiveContentStyle, useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useTheme } from '../../theme/theme';
import { cartService } from '../../services/cartService';
import { promoCodeService } from '../../services/promoCodeService';
import { storeService } from '../../services/storeService';
import { Cart } from '../../models/cart';
import { Store } from '../../models/store';
import { Header } from '../../components/Header';
import { StatusMessage } from '../../components/StatusMessage';
import { SmartImage } from '../../components/SmartImage';
import { appConfig } from '../../config/appConfig';

export const CartScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const layout = useResponsiveLayout();
  const [cart, setCart] = useState<Cart | null>(cartService.getCartSync());
  const [promoInput, setPromoInput] = useState('');
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);

  useEffect(() => {
    const unsubscribe = cartService.subscribe((updatedCart) => {
      setCart(updatedCart);
    });
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadStore = async () => {
        const storeId = cartService.getCartSync()?.storeId;
        if (!storeId) {
          if (!cancelled) setStore(null);
          return;
        }
        try {
          const fresh = await storeService.getStoreById(storeId);
          if (!cancelled) setStore(fresh);
        } catch {
          if (!cancelled) setStore(null);
        }
      };
      void loadStore();
      return () => {
        cancelled = true;
      };
    }, [cart?.storeId])
  );

  if (!cart || cart.items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Header title="Your Cart" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="cart-outline" size={48} color={colors.secondary} />
          </View>
          <Text style={[typography.headlineMedium, { color: colors.onSurface, marginTop: 16 }]}>
            Your cart is empty
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.subtext, textAlign: 'center', marginTop: 8 }]}>
            Explore our wide variety of restaurants and stores to add items to your cart.
          </Text>
          <TouchableOpacity
            style={[styles.exploreBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Browse')}
            activeOpacity={0.85}
          >
            <Text style={[typography.titleMedium, { color: colors.onPrimary, fontWeight: '700' }]}>
              Explore Stores
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const subtotal = cartService.calculateSubtotal();
  const deliveryFee = cartService.getDeliveryFee(cart.storeId);
  const deliveryUnavailable = deliveryFee < 0;
  const serviceFee = cartService.getServiceFee(cart.storeId);
  const discount = cartService.calculateDiscount(subtotal);
  const total = cartService.calculateTotal(cart.storeId);
  const minimumOrder = cartService.getMinimumOrder(cart.storeId);
  const meetsMinimum = cartService.isMinimumOrderMet(cart.storeId);
  const storeClosed = store?.isOpen === false;
  const canCheckout = meetsMinimum && !deliveryUnavailable && !storeClosed;

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    try {
      const isFood = cartService.getStoreContext(cart.storeId).isFood !== false;
      const promo = await promoCodeService.validate(promoInput, {
        subtotal,
        storeId: cart.storeId,
        orderType: isFood ? 'Food' : 'Liquor',
      });
      await cartService.applyPromo(promo);
      setPromoInput('');
      setPromoMessage(`${promo.code} is now applied to this cart.`);
    } catch (e: any) {
      setPromoMessage(e?.message || 'That promo code could not be applied.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header
        title="Your Cart"
        subtitle={cart.storeName || 'Store'}
        showBack
        onBackPress={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity onPress={() => cartService.clearCart()}>
            <Text style={[typography.labelMedium, { color: colors.error }]}>Clear</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={responsiveContentStyle(layout, styles.scrollContent)}>
        {promoMessage && (
          <StatusMessage
            variant="info"
            message={promoMessage}
            onDismiss={() => setPromoMessage(null)}
          />
        )}
        {/* Cart Items List */}
        <View style={styles.section}>
          {cart.items.map((item) => (
            <View
              key={item.uniqueId}
              style={[styles.itemCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            >
              <SmartImage
                source={{ uri: item.productImageUrl }}
                style={styles.itemImage}
                fallbackIcon="fast-food-outline"
                fallbackIconSize={28}
              />
              <View style={styles.itemInfo}>
                <Text style={[typography.titleMedium, { color: colors.onSurface }]} numberOfLines={1}>
                  {item.productName}
                </Text>
                <Text style={[typography.titleSmall, { color: colors.secondary, marginTop: 4 }]}>
                  {appConfig.formatCurrency(item.price)}
                </Text>

                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, { borderColor: colors.divider }]}
                    onPress={() => cartService.updateQuantity(item.uniqueId, item.quantity - 1)}
                  >
                    <Ionicons name="remove" size={16} color={colors.onSurface} />
                  </TouchableOpacity>

                  <Text style={[typography.titleMedium, { color: colors.onSurface, marginHorizontal: 12 }]}>
                    {item.quantity}
                  </Text>

                  <TouchableOpacity
                    style={[styles.qtyBtn, { borderColor: colors.divider }]}
                    onPress={() => cartService.updateQuantity(item.uniqueId, item.quantity + 1)}
                  >
                    <Ionicons name="add" size={16} color={colors.onSurface} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => cartService.removeItem(item.uniqueId)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.subtext} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Promo Code Section */}
        <View style={[styles.promoBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Ionicons name="pricetag-outline" size={20} color={colors.secondary} style={{ marginRight: 8 }} />
          {cart.appliedPromo ? (
            <>
              <View style={{ flex: 1 }}>
                <Text style={[typography.titleSmall, { color: colors.onSurface }]}>
                  {cart.appliedPromo.code}
                </Text>
                <Text style={[typography.labelSmall, { color: colors.subtext }]}>
                  {cart.appliedPromo.freeDelivery
                    ? 'Free delivery'
                    : `${cart.appliedPromo.discountType === 'percentage' ? `${cart.appliedPromo.discountValue}%` : appConfig.formatCurrency(cart.appliedPromo.discountValue)} off`}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: colors.primary }]}
                onPress={() => cartService.removePromo()}
              >
                <Text style={[typography.labelMedium, { color: colors.onPrimary }]}>Remove</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={[styles.promoInput, { color: colors.onSurface }]}
                placeholder="Enter a promo code"
                placeholderTextColor={colors.subtext}
                value={promoInput}
                onChangeText={setPromoInput}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: colors.primary }]}
                onPress={handleApplyPromo}
              >
                <Text style={[typography.labelMedium, { color: colors.onPrimary }]}>Apply</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Bill Summary Breakdown */}
        <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Text style={[typography.titleMedium, { color: colors.onSurface, marginBottom: 12 }]}>
            Payment Summary
          </Text>

          <View style={styles.summaryRow}>
            <Text style={[typography.bodyMedium, { color: colors.subtext }]}>Subtotal</Text>
            <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>
              {appConfig.formatCurrency(subtotal)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={[typography.bodyMedium, { color: colors.subtext }]}>Delivery Fee</Text>
            <Text
              style={[
                typography.bodyMedium,
                { color: deliveryUnavailable ? colors.error : colors.onSurface },
              ]}
            >
              {deliveryUnavailable ? 'Unavailable' : appConfig.formatCurrency(deliveryFee)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={[typography.bodyMedium, { color: colors.subtext }]}>Service Fee</Text>
            <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>
              {appConfig.formatCurrency(serviceFee)}
            </Text>
          </View>

          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[typography.bodyMedium, { color: colors.secondary }]}>Discount</Text>
              <Text style={[typography.bodyMedium, { color: colors.secondary }]}>
                -{appConfig.formatCurrency(discount)}
              </Text>
            </View>
          )}

          <View style={styles.dividerLine} />

          <View style={styles.summaryRow}>
            <Text style={[typography.titleLarge, { color: colors.onSurface }]}>Total Cost</Text>
            <Text style={[typography.titleLarge, { color: colors.secondary, fontWeight: '800' }]}>
              {appConfig.formatCurrency(total)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Checkout Footer */}
      <View style={[styles.footer, { backgroundColor: colors.appBarBackground, borderTopColor: colors.divider }]}>
        {!canCheckout && (
          <Text
            style={[
              typography.bodySmall,
              { color: colors.error, textAlign: 'center', marginBottom: 10 },
            ]}
          >
            {storeClosed
              ? store?.nextOpeningTime || 'This store is currently closed and will open soon.'
              : deliveryUnavailable
              ? 'Delivery is unavailable to this store (over 20km).'
              : `Minimum order is ${appConfig.formatCurrency(minimumOrder)} for this store.`}
          </Text>
        )}
        <TouchableOpacity
          style={[
            styles.checkoutBtn,
            { backgroundColor: canCheckout ? colors.secondary : colors.divider },
          ]}
          onPress={() => navigation.navigate('Checkout')}
          disabled={!canCheckout}
          activeOpacity={0.85}
        >
          <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
            {canCheckout
              ? `Proceed to Checkout · ${appConfig.formatCurrency(total)}`
              : storeClosed
              ? 'Store currently closed'
              : meetsMinimum
              ? 'Delivery unavailable'
              : `Add ${appConfig.formatCurrency(Math.max(0, minimumOrder - subtotal))} more`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exploreBtn: {
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  section: {
    marginBottom: 16,
  },
  itemCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: 'center',
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    padding: 8,
  },
  promoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  promoInput: {
    flex: 1,
    fontSize: 14,
  },
  applyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  dividerLine: {
    height: 1,
    backgroundColor: 'rgba(150,150,150,0.15)',
    marginVertical: 10,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  checkoutBtn: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
