import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { DriverLocationFix, orderService } from '../../services/orderService';
import { Order } from '../../models/order';
import { Header } from '../../components/Header';
import { StatusBadge } from '../../components/StatusBadge';
import { TrackingMap } from '../../components/TrackingMap';
import { appConfig } from '../../config/appConfig';
import {
  isAwaitingPaymentOrder,
  orderStatusHelpers,
  orderStatusMeta,
} from '../../models/core/statuses';
import { formatAddress } from '../../utils/address';
import { Skeleton } from '../../components/Skeleton';

const POLL_INTERVAL_MS = 20_000;
const DRIVER_FIX_MAX_AGE_MS = 5 * 60 * 1000;

/** Prefer the fresher of the assignment snapshot and the driver's live row. */
function pickDriverFix(
  assignment: DriverLocationFix | null,
  live: DriverLocationFix | null
): DriverLocationFix | null {
  if (!assignment) return live;
  if (!live) return assignment;
  const assignmentTime = fixTimestamp(assignment.updatedAt);
  const liveTime = fixTimestamp(live.updatedAt);
  return liveTime >= assignmentTime ? live : assignment;
}

function fixTimestamp(value?: string): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatFixAge(value?: string): string {
  const timestamp = fixTimestamp(value);
  if (!timestamp) return 'time unknown';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} h ago`;
}

export const OrderTrackingScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { colors, typography } = useTheme();
  const orderId = route.params?.orderId;
  const fromCheckout = !!route.params?.fromCheckout;

  const [order, setOrder] = useState<Order | null>(null);
  const [liveFix, setLiveFix] = useState<DriverLocationFix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    if (fromCheckout) {
      navigation.navigate('MainTabs');
    } else {
      navigation.goBack();
    }
  };

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setError('No order was selected.');
      setLoading(false);
      return;
    }

    const data = await orderService.getOrderById(orderId);
    if (data) {
      setOrder(data);
      setLiveFix(
        data.driverId ? await orderService.getLiveDriverLocation(data.driverId) : null
      );
      setError(null);
    } else {
      setError('We could not find this order. It may have been removed.');
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      await fetchOrder();
      if (cancelled) return;
    };
    load();

    const unsubscribe = orderService.subscribeToOrderUpdates(orderId, (updated) => {
      if (cancelled) return;
      setOrder(updated);
      if (updated.driverId) {
        void orderService.getLiveDriverLocation(updated.driverId).then((fix) => {
          if (!cancelled) setLiveFix(fix);
        });
      }
    });

    // Realtime is best-effort (delivery depends on the table's publication), so
    // poll while the order is still in flight.
    const interval = setInterval(() => {
      if (cancelled) return;
      setOrder((current) => {
        if (current && orderStatusHelpers.isTerminal(current.status)) {
          return current;
        }
        void fetchOrder();
        return current;
      });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(interval);
    };
  }, [fetchOrder, orderId]);

  useEffect(() => {
    if (!order?.driverId) return;
    const unsubscribe = orderService.subscribeToDriverLocation(order.driverId, (fix) => {
      setLiveFix(fix);
    });
    return unsubscribe;
  }, [order?.driverId]);

  const destination =
    order &&
    Number.isFinite(order.deliveryAddress?.latitude) &&
    Number.isFinite(order.deliveryAddress?.longitude) &&
    !(order.deliveryAddress.latitude === 0 && order.deliveryAddress.longitude === 0)
      ? {
          latitude: order.deliveryAddress.latitude,
          longitude: order.deliveryAddress.longitude,
        }
      : null;

  const driverLocation = order?.driver?.location ?? null;
  const assignmentFix: DriverLocationFix | null =
    driverLocation?.latitude != null && driverLocation?.longitude != null
      ? {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          updatedAt: driverLocation.updatedAt ?? order?.updatedAt,
        }
      : null;
  const bestFix = pickDriverFix(assignmentFix, liveFix);
  const driverFix = bestFix
    ? { latitude: bestFix.latitude, longitude: bestFix.longitude }
    : null;
  const driverFresh = !!bestFix && Date.now() - fixTimestamp(bestFix.updatedAt) <= DRIVER_FIX_MAX_AGE_MS;

  const statusMeta = order ? orderStatusMeta[order.status] : undefined;
  const paymentOutstanding =
    !!order &&
    isAwaitingPaymentOrder(order) &&
    !orderStatusHelpers.isTerminal(order.status);

  const handleCallDriver = () => {
    if (order?.driver?.phone) {
      Linking.openURL(`tel:${order.driver.phone}`);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Header title="Delivery Tracking" showBack onBackPress={handleBack} />
        <View style={{ padding: 16 }}>
          <Skeleton width="100%" height={320} borderRadius={20} style={{ marginBottom: 16 }} />
          <Skeleton width="60%" height={20} borderRadius={6} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={16} borderRadius={6} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={72} borderRadius={14} style={{ marginBottom: 12 }} />
          <Skeleton width="90%" height={16} borderRadius={6} style={{ marginBottom: 8 }} />
          <Skeleton width="80%" height={16} borderRadius={6} />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Header title="Delivery Tracking" showBack onBackPress={handleBack} />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={54} color={colors.subtext} />
          <Text style={[typography.titleMedium, { color: colors.onSurface, marginTop: 12, textAlign: 'center' }]}>
            {error || 'Order unavailable'}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.secondary }]}
            onPress={() => {
              setLoading(true);
              void fetchOrder();
            }}
          >
            <Text style={[typography.titleSmall, { color: '#FFFFFF', fontWeight: '700' }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Delivery Tracking" showBack onBackPress={handleBack} />

      {destination ? (
        <View style={[styles.mapContainer, { backgroundColor: colors.cardBackground }]}>
          <TrackingMap
            destination={destination}
            driver={driverFresh ? driverFix : null}
            driverLabel={order.driver?.name}
            destinationLabel="Delivery address"
          />

          <View style={[styles.etaBanner, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <Ionicons name="time" size={24} color={colors.secondary} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.labelSmall, { color: colors.subtext }]}>
                CURRENT STATUS
              </Text>
              <Text style={[typography.titleMedium, { color: colors.onSurface, fontWeight: '800' }]}>
                {statusMeta?.displayName || order.status}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.noMap,
            { backgroundColor: colors.cardBackground, borderColor: colors.divider },
          ]}
        >
          <Ionicons name="navigate-outline" size={22} color={colors.secondary} />
          <Text style={[typography.bodySmall, { color: colors.subtext, marginLeft: 8, flex: 1 }]}>
            A live map appears once the delivery address has coordinates.
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.detailsDrawer}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.titleMedium, { color: colors.onSurface }]}>
              {order.storeName || 'Store'}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.subtext }]}>
              Order #{order.orderNumber}
            </Text>
          </View>
          <StatusBadge status={order.status} />
        </View>

        <View style={styles.dividerLine} />

        {paymentOutstanding && (
          <View style={[styles.paymentBox, { backgroundColor: colors.cardBackground, borderColor: colors.secondary }]}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.titleSmall, { color: colors.onSurface, fontWeight: '700' }]}>
                Payment still outstanding
              </Text>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4 }]}>
                Tracking starts once payment is confirmed.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: colors.secondary }]}
              onPress={() => navigation.navigate('PayOrder', { orderId: order.id })}
              activeOpacity={0.85}
            >
              <Ionicons name="card-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '800' }]}>
                Pay now
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {order.driver?.name ? (
          <View style={[styles.driverBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={[styles.driverAvatar, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="person" size={24} color={colors.secondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.titleSmall, { color: colors.onSurface }]}>
                {order.driver.name}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.subtext }]}>
                {driverFresh ? 'Your delivery driver' : 'Last known driver'}
              </Text>
            </View>
            {!!order.driver.phone && (
              <TouchableOpacity
                style={[styles.callBtn, { backgroundColor: colors.secondary }]}
                onPress={handleCallDriver}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={[styles.driverBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <View style={[styles.driverAvatar, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="person-add-outline" size={22} color={colors.secondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.titleSmall, { color: colors.onSurface }]}>
                Driver not assigned yet
              </Text>
              <Text style={[typography.bodySmall, { color: colors.subtext }]}>
                We will show driver details here once your order is on the way.
              </Text>
            </View>
          </View>
        )}

        {bestFix && (
          <View style={styles.locationStatusRow}>
            <Ionicons
              name={driverFresh ? 'locate' : 'hourglass-outline'}
              size={16}
              color={colors.secondary}
            />
            <Text style={[typography.bodySmall, { color: colors.subtext, marginLeft: 6, flex: 1 }]}>
              {driverFresh ? 'Live driver location' : 'Last known driver location'} ·{' '}
              {formatFixAge(bestFix.updatedAt)}
            </Text>
          </View>
        )}

        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={20} color={colors.subtext} style={{ marginRight: 8 }} />
          <Text style={[typography.bodySmall, { color: colors.onSurface, flex: 1 }]}>
            {formatAddress(order.deliveryAddress, 'Delivery address not recorded')}
          </Text>
        </View>

        {order.trackingUpdates && order.trackingUpdates.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={[typography.titleSmall, { color: colors.onSurface, marginBottom: 8 }]}>
              Progress
            </Text>
            {order.trackingUpdates.map((update, index) => (
              <View key={`${update.timestamp}-${index}`} style={styles.timelineRow}>
                <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>
                    {update.message || update.status.replace(/_/g, ' ')}
                  </Text>
                  <Text style={[typography.labelSmall, { color: colors.subtext }]}>
                    {new Date(update.timestamp).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.totalRow}>
          <Text style={[typography.bodyMedium, { color: colors.subtext }]}>Order Total</Text>
          <Text style={[typography.titleMedium, { color: colors.secondary, fontWeight: '800' }]}>
            {appConfig.formatCurrency(order.total)}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  mapContainer: {
    height: 320,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  noMap: {
    margin: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 5,
  },
  detailsDrawer: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dividerLine: { height: 1, backgroundColor: 'rgba(150,150,150,0.15)', marginVertical: 14 },
  paymentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginLeft: 10,
  },
  driverBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -6,
    marginBottom: 14,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 10 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
});
