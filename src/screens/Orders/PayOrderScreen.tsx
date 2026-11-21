import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { Header } from '../../components/Header';
import { StatusMessage } from '../../components/StatusMessage';
import { Skeleton } from '../../components/Skeleton';
import { appConfig } from '../../config/appConfig';
import { orderService } from '../../services/orderService';
import { paymentService } from '../../services/paymentService';
import type { Order } from '../../models/order';
import { isAwaitingPaymentOrder, orderStatusHelpers } from '../../models/statuses';
import {
  checkoutPaymentMethodFromOrderLabel,
  toPaymentMethodCode,
} from '../../utils/paymentMethod';

interface PayOrderScreenProps {
  navigation: any;
  route: { params?: { orderId?: string } };
}

/**
 * Pay now for an order that was created but never paid. Reuses the same payment
 * row and gateway flow as checkout — it never creates a second order.
 */
export const PayOrderScreen: React.FC<PayOrderScreenProps> = ({ navigation, route }) => {
  const { colors, typography } = useTheme();
  const orderId = route.params?.orderId;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!orderId) {
        setError('No order was selected.');
        setLoading(false);
        return;
      }
      try {
        const data = await orderService.getOrderById(orderId);
        if (!cancelled) setOrder(data);
      } catch {
        if (!cancelled) setError('We could not load this order. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const goToTracking = () => {
    if (orderId) navigation.navigate('OrderTracking', { orderId });
    else navigation.goBack();
  };

  const handlePayNow = async () => {
    if (!order || paying) return;

    const method = checkoutPaymentMethodFromOrderLabel(order.paymentMethod);
    if (!method || method === 'cashOnDelivery') return;

    // Open the payment window synchronously so popup blockers allow it.
    let paymentWindow: Window | null = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      paymentWindow = window.open('about:blank', '_blank');
      if (paymentWindow) {
        try {
          paymentWindow.opener = null;
        } catch {
          // Some browsers lock opener; the request screen still offers a link.
        }
      }
    }
    const closePaymentWindow = () => {
      if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
    };

    setPaying(true);
    setError(null);
    try {
      const payment = await paymentService.createPayment({
        orderId: order.id,
        amount: order.total,
        method: toPaymentMethodCode(method),
      });

      if (payment.status === 'completed') {
        closePaymentWindow();
        goToTracking();
        return;
      }

      const paystack = await paymentService.initializePaystackPayment(payment.id);
      if (paymentWindow && !paymentWindow.closed) {
        try {
          paymentWindow.location.href = paystack.authorizationUrl;
          paymentWindow.focus();
        } catch {
          paymentWindow.close();
          paymentWindow = null;
        }
      }

      navigation.navigate('PaystackPayment', {
        orderId: order.id,
        paymentId: payment.id,
        reference: paystack.reference || payment.reference,
        authorizationUrl: paystack.authorizationUrl,
        paymentMethod: method,
        amount: order.total,
      });
    } catch (e: any) {
      closePaymentWindow();
      setError(e?.message || 'We could not start the payment. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Header title="Pay for order" showBack onBackPress={() => navigation.goBack()} />
        <View style={{ padding: 16 }}>
          <Skeleton width="100%" height={140} borderRadius={16} style={{ marginBottom: 16 }} />
          <Skeleton width="70%" height={20} borderRadius={6} style={{ marginBottom: 10 }} />
          <Skeleton width="100%" height={50} borderRadius={14} />
        </View>
      </View>
    );
  }

  const method = order ? checkoutPaymentMethodFromOrderLabel(order.paymentMethod) : null;
  const awaitingPayment =
    !!order && isAwaitingPaymentOrder(order) && !orderStatusHelpers.isTerminal(order.status);
  const canPay = awaitingPayment && !!method && method !== 'cashOnDelivery';

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Pay for order" showBack onBackPress={() => navigation.goBack()} />

      <View style={styles.content}>
        {error && (
          <StatusMessage
            variant="error"
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {!order ? (
          <StatusMessage
            variant="warning"
            message="We could not find this order. Check your Orders tab."
          />
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
              <Ionicons name="receipt-outline" size={28} color={colors.secondary} />
              <Text style={[typography.titleMedium, { color: colors.onSurface, marginTop: 10 }]}>
                {order.storeName || 'Your order'}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4 }]}>
                Order #{order.orderNumber}
              </Text>
              <Text style={[typography.headlineSmall, { color: colors.secondary, fontWeight: '800', marginTop: 14 }]}>
                {appConfig.formatCurrency(order.total)}
              </Text>
              {!!order.paymentMethod && (
                <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4 }]}>
                  Paying by {order.paymentMethod}
                </Text>
              )}
            </View>

            {canPay ? (
              <>
                <View style={[styles.notice, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.secondary} />
                  <Text style={[typography.bodySmall, { color: colors.subtext, flex: 1, marginLeft: 8 }]}>
                    Payment is still outstanding. Your order will move to the store as soon as it is confirmed.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.payBtn, { backgroundColor: colors.secondary }]}
                  onPress={() => void handlePayNow()}
                  disabled={paying}
                  activeOpacity={0.85}
                >
                  {paying ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="card-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={[typography.titleSmall, { color: '#FFFFFF', fontWeight: '800' }]}>
                        Pay now
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={[styles.notice, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.secondary} />
                <Text style={[typography.bodySmall, { color: colors.subtext, flex: 1, marginLeft: 8 }]}>
                  {method === 'cashOnDelivery'
                    ? 'This order is paid on delivery — no online payment is needed.'
                    : 'This order does not need a payment right now.'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.divider }]}
              onPress={goToTracking}
              activeOpacity={0.85}
            >
              <Text style={[typography.titleSmall, { color: colors.secondary, fontWeight: '700' }]}>
                View order
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  notice: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  payBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
