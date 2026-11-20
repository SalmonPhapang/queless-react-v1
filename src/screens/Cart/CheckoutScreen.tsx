import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/theme';
import { cartService } from '../../services/cartService';
import { orderService } from '../../services/orderService';
import { paymentService } from '../../services/paymentService';
import { authService } from '../../services/authService';
import { deliveryLocationService } from '../../services/deliveryLocationService';
import { storeService } from '../../services/storeService';
import { Cart } from '../../models/cart';
import { Store } from '../../models/store';
import { Address, User } from '../../models/user';
import { OrderItem } from '../../models/order';
import { Header } from '../../components/Header';
import { StatusMessage } from '../../components/StatusMessage';
import { appConfig } from '../../config/appConfig';
import { settlementCalculator } from '../../utils/settlementCalculator';
import { formatAddress } from '../../utils/address';
import { getStoreDistanceKm, isBeyondDeliveryRadius } from '../../utils/deliveryRadius';

export const CheckoutScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();

  const [cart] = useState<Cart | null>(cartService.getCartSync());
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cashOnDelivery'>('card');
  const [loading, setLoading] = useState(false);
  const [codAllowed, setCodAllowed] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [, setDistanceVersion] = useState(0);

  // Re-read the profile every time checkout regains focus, so an address added
  // or defaulted in AddressManagement is reflected here immediately.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadDetails = async () => {
        const current = await authService.getCurrentSessionUser();
        if (cancelled) return;

        setUser(current);
        const saved = current?.addresses ?? [];
        setAddresses(saved);

        // Use the delivery location chosen on Home/Liquor Home (which may be
        // the device's current location), then the default/first saved address.
        // A cold deep link into Checkout may have no selection yet, so resolve
        // current location first before falling back to the profile default.
        if (!deliveryLocationService.getActive()) {
          await deliveryLocationService.resolve();
        }
        const activeAddress = deliveryLocationService.getActiveAddress(current?.id);
        setSelectedAddress(
          activeAddress ?? saved.find((address) => address.isDefault) ?? saved[0] ?? null
        );

        if (current?.id) {
          const allowed = await orderService.hasCompletedPaidOrder(current.id);
          if (!cancelled) {
            setCodAllowed(allowed);
            if (!allowed) setPaymentMethod('card');
          }
        }
      };

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
          // keep last known store state
        }
      };

      loadDetails();
      void loadStore();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Re-measure against the selected delivery address. The cart may have been
  // filled while a different location was active; checkout must use the point
  // that will actually be sent to the server geo guard.
  useEffect(() => {
    if (!store || !selectedAddress) return;

    const coords =
      Number.isFinite(selectedAddress.latitude) && Number.isFinite(selectedAddress.longitude)
        ? { latitude: selectedAddress.latitude, longitude: selectedAddress.longitude }
        : deliveryLocationService.getActive()?.coords;
    const distanceKm = getStoreDistanceKm(store, coords);
    if (distanceKm === undefined) return;

    cartService.updateStoreContext(store.id, { distanceMeters: distanceKm * 1000 });
    setDistanceVersion((version) => version + 1);
  }, [store, selectedAddress]);

  if (!cart) return null;

  const storeContext = cartService.getStoreContext(cart.storeId);
  const orderType: 'Food' | 'Liquor' = storeContext.isFood === false ? 'Liquor' : 'Food';

  const subtotal = cartService.calculateSubtotal();
  const deliveryFee = cartService.getDeliveryFee(cart.storeId);
  const deliveryCoords =
    selectedAddress &&
    Number.isFinite(selectedAddress.latitude) &&
    Number.isFinite(selectedAddress.longitude)
      ? { latitude: selectedAddress.latitude, longitude: selectedAddress.longitude }
      : deliveryLocationService.getActive()?.coords;
  const deliveryDistanceKm = store ? getStoreDistanceKm(store, deliveryCoords) : undefined;
  const deliveryUnavailable = deliveryFee < 0 || isBeyondDeliveryRadius(deliveryDistanceKm);
  const serviceFee = cartService.getServiceFee(cart.storeId);
  const discount = cartService.calculateDiscount(subtotal);
  const total = cartService.calculateTotal(cart.storeId);
  const minimumOrder = cartService.getMinimumOrder(cart.storeId);
  const meetsMinimum = cartService.isMinimumOrderMet(cart.storeId);
  const hasAddress = !!selectedAddress;
  const storeClosed = store?.isOpen === false;
  const canPlaceOrder =
    meetsMinimum && !deliveryUnavailable && hasAddress && !!user && !storeClosed;

  const handlePlaceOrder = async () => {
    setStatusMessage(null);
    if (!user) {
      setStatusMessage('Please sign in to place an order.');
      navigation.navigate('Auth');
      return;
    }

    // Revalidate latest store state at payment time.
    let currentStore = store;
    try {
      const fresh = await storeService.getStoreById(cart.storeId);
      if (fresh) {
        currentStore = fresh;
        setStore(fresh);
      }
    } catch {
      // keep last known store state
    }

    if (currentStore?.isOpen === false) {
      setStatusMessage(currentStore.nextOpeningTime || 'This store is currently closed and will open soon.');
      return;
    }

    if (!selectedAddress) {
      setStatusMessage('Add a delivery address before placing this order.');
      navigation.navigate('AddressManagement');
      return;
    }
    if (!meetsMinimum || deliveryUnavailable) {
      setStatusMessage(
        deliveryUnavailable
          ? 'This store is too far away for delivery. Delivery is only available up to 20km.'
          : `This store requires a minimum order of ${appConfig.formatCurrency(minimumOrder)}.`
      );
      return;
    }

    if (orderType === 'Liquor' && !user.ageVerified) {
      setStatusMessage('You need to verify your age before ordering alcohol.');
      navigation.navigate('AgeVerification');
      return;
    }

    setLoading(true);
    try {
      const items: OrderItem[] = cart.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productImageUrl: item.productImageUrl,
        quantity: item.quantity,
        pricePerUnit: item.price,
        basePricePerUnit: item.basePrice,
        basePriceAdjustment: item.basePriceAdjustment,
        totalPrice: item.price * item.quantity,
        selectedOptions: item.selectedOptions,
      }));

      const settlement = settlementCalculator.calculate({
        total,
        baseSubtotal: cartService.calculateBaseSubtotal(),
        customerSubtotal: subtotal,
        deliveryFee: Math.max(0, deliveryFee),
        discount,
        serviceFee,
      });

      // 1. Create the order server-side. If this fails, the cart is untouched.
      const order = await orderService.createOrder({
        userId: user.id,
        storeId: cart.storeId,
        storeName: cart.storeName,
        items,
        subtotal,
        baseSubtotal: settlement.baseSubtotal,
        basePriceAdjustment: cart.items.reduce(
          (sum, item) => sum + item.basePriceAdjustment * item.quantity,
          0
        ),
        deliveryFee: settlement.deliveryFee,
        discount,
        total,
        serviceFee,
        storeShare: settlement.storeShare,
        quelessShare: settlement.quelessShare,
        deliveryAddress: selectedAddress,
        paymentMethod: paymentMethod === 'card' ? 'Instant EFT' : 'Cash on Delivery',
        orderType,
        promoCodeId: cart.appliedPromo?.id,
        aiAssisted: cart.aiAssisted,
        aiConversationId: cart.aiConversationId,
      });

      // 2. Payment row (one per order; reused if the customer retries).
      const payment = await paymentService.createPayment({
        orderId: order.id,
        amount: order.total,
        method: paymentMethod === 'card' ? 'instantEft' : 'cashOnDelivery',
      });

      // Cash on delivery settles immediately.
      if (payment.status === 'completed') {
        await cartService.clearCart();
        // Drop Cart/Checkout from the stack so back from tracking goes Home.
        navigation.reset({
          index: 1,
          routes: [
            { name: 'MainTabs' },
            { name: 'OrderTracking', params: { orderId: order.id, fromCheckout: true } },
          ],
        });
        return;
      }

      // 3. Card / Instant EFT — hand off to Paystack. The cart is only cleared
      //    once the payment is verified as successful.
      const paystack = await paymentService.initializePaystackPayment(payment.id);

      navigation.replace('PaystackPayment', {
        orderId: order.id,
        paymentId: payment.id,
        reference: paystack.reference || payment.reference,
        authorizationUrl: paystack.authorizationUrl,
      });
    } catch (e: any) {
      setStatusMessage(e?.message || 'We could not place your order. Your cart is still saved.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Checkout" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {statusMessage && (
          <StatusMessage
            variant="error"
            message={statusMessage}
            onDismiss={() => setStatusMessage(null)}
          />
        )}
        <View style={styles.section}>
          <Text style={[typography.titleMedium, { color: colors.onSurface, marginBottom: 8 }]}>
            Delivery Address
          </Text>
          <TouchableOpacity
            style={[styles.cardBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={() => navigation.navigate('AddressManagement')}
            activeOpacity={0.8}
          >
            <Ionicons name="location-outline" size={24} color={colors.secondary} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.titleSmall, { color: colors.onSurface }]}>
                {selectedAddress?.label || 'Add a delivery address'}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]} numberOfLines={2}>
                {selectedAddress
                  ? formatAddress(selectedAddress, 'Saved address')
                  : 'A saved address is required to deliver your order.'}
              </Text>
            </View>
            <Text style={[typography.labelMedium, { color: colors.secondary }]}>
              {selectedAddress ? 'Change' : 'Add'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[typography.titleMedium, { color: colors.onSurface, marginBottom: 8 }]}>
            Payment Method
          </Text>

          <TouchableOpacity
            style={[
              styles.methodOption,
              {
                backgroundColor: colors.cardBackground,
                borderColor: paymentMethod === 'card' ? colors.secondary : colors.divider,
              },
            ]}
            onPress={() => setPaymentMethod('card')}
            activeOpacity={0.8}
          >
            <View style={styles.methodLeft}>
              <Ionicons name="card-outline" size={22} color={colors.secondary} style={{ marginRight: 12 }} />
              <View>
                <Text style={[typography.titleSmall, { color: colors.onSurface }]}>
                  Card or Instant EFT (Paystack)
                </Text>
                <Text style={[typography.bodySmall, { color: colors.subtext }]}>
                  Secured by Paystack SA
                </Text>
              </View>
            </View>
            <Ionicons
              name={paymentMethod === 'card' ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={paymentMethod === 'card' ? colors.secondary : colors.subtext}
            />
          </TouchableOpacity>

          {codAllowed ? (
            <TouchableOpacity
              style={[
                styles.methodOption,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: paymentMethod === 'cashOnDelivery' ? colors.secondary : colors.divider,
                },
              ]}
              onPress={() => setPaymentMethod('cashOnDelivery')}
              activeOpacity={0.8}
            >
              <View style={styles.methodLeft}>
                <Ionicons name="cash-outline" size={22} color={colors.secondary} style={{ marginRight: 12 }} />
                <View>
                  <Text style={[typography.titleSmall, { color: colors.onSurface }]}>
                    Cash on Delivery
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.subtext }]}>
                    Pay driver upon arrival
                  </Text>
                </View>
              </View>
              <Ionicons
                name={paymentMethod === 'cashOnDelivery' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={paymentMethod === 'cashOnDelivery' ? colors.secondary : colors.subtext}
              />
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.methodOption,
                { backgroundColor: colors.cardBackground, borderColor: colors.divider, opacity: 0.6 },
              ]}
            >
              <View style={styles.methodLeft}>
                <Ionicons name="cash-outline" size={22} color={colors.subtext} style={{ marginRight: 12 }} />
                <View>
                  <Text style={[typography.titleSmall, { color: colors.subtext }]}>
                    Cash on Delivery (locked)
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.subtext }]}>
                    Available after your first paid order
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.cardBoxColumn, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Text style={[typography.titleMedium, { color: colors.onSurface, marginBottom: 8 }]}>
            Order Breakdown
          </Text>
          <Text style={[typography.bodySmall, { color: colors.subtext }]}>
            {cart.items.length} items from {cart.storeName}
          </Text>

          <View style={styles.dividerLine} />

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
              <Text style={[typography.bodyMedium, { color: colors.secondary }]}>
                Discount {cart.appliedPromo ? `(${cart.appliedPromo.code})` : ''}
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.secondary }]}>
                -{appConfig.formatCurrency(discount)}
              </Text>
            </View>
          )}

          <View style={styles.dividerLine} />

          <View style={styles.summaryRow}>
            <Text style={[typography.titleLarge, { color: colors.onSurface }]}>Total</Text>
            <Text style={[typography.titleLarge, { color: colors.secondary, fontWeight: '800' }]}>
              {appConfig.formatCurrency(total)}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.appBarBackground, borderTopColor: colors.divider }]}>
        {!canPlaceOrder && user && (
          <Text
            style={[
              typography.bodySmall,
              { color: colors.error, textAlign: 'center', marginBottom: 10 },
            ]}
          >
            {storeClosed
              ? store?.nextOpeningTime || 'This store is currently closed and will open soon.'
              : !hasAddress
              ? 'Add a delivery address to continue.'
              : deliveryUnavailable
              ? 'Delivery is unavailable to this store (over 20km).'
              : `Minimum order is ${appConfig.formatCurrency(minimumOrder)} for this store.`}
          </Text>
        )}
        <TouchableOpacity
          style={[
            styles.payBtn,
            { backgroundColor: canPlaceOrder ? colors.secondary : colors.divider },
          ]}
          onPress={handlePlaceOrder}
          disabled={loading || !canPlaceOrder}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
              Pay now
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 90 },
  section: { marginBottom: 20 },
  cardBox: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBoxColumn: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  methodLeft: { flexDirection: 'row', alignItems: 'center' },
  dividerLine: { height: 1, backgroundColor: 'rgba(150,150,150,0.15)', marginVertical: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  footer: { padding: 16, borderTopWidth: 1 },
  payBtn: { height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
});
