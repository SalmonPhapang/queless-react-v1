import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { responsiveContentStyle, useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useTheme } from '../../theme/theme';
import { orderService } from '../../services/orderService';
import { authService } from '../../services/authService';
import { Order } from '../../models/order';
import { orderStatusFromDatabaseValue, orderStatusHelpers } from '../../models/core/statuses';
import { Header } from '../../components/Header';
import { StatusBadge } from '../../components/StatusBadge';
import { appConfig } from '../../config/appConfig';
import { OrderCardSkeleton } from '../../components/Skeleton';

export const OrdersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const layout = useResponsiveLayout();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    try {
      const currentUser = await authService.getCurrentSessionUser();
      if (currentUser) {
        const data = await orderService.getUserOrders(currentUser.id);
        setOrders(data);
      }
    } catch (e) {
      console.warn('Orders fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Your Orders" subtitle="Track live deliveries & history" />

      {loading ? (
        <ScrollView contentContainerStyle={responsiveContentStyle(layout, styles.listContent)}>
          {[1, 2, 3].map((i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={responsiveContentStyle(layout, styles.listContent)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.secondary]} />}
          renderItem={({ item }) => {
            const canonicalStatus = orderStatusFromDatabaseValue(item.status);
            const isActive = !orderStatusHelpers.isTerminal(canonicalStatus) && canonicalStatus !== 'awaiting_payment';

            return (
              <View style={[styles.orderCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderInfo}>
                    <Text
                      style={[typography.titleMedium, { color: colors.onSurface }]}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {item.storeName || 'Store'}
                    </Text>
                    <Text
                      style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      Order #{item.orderNumber} • {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} compact />
                </View>

                <View style={styles.dividerLine} />

                <View style={styles.cardFooter}>
                  <Text style={[typography.titleMedium, { color: colors.secondary, fontWeight: '700' }]}>
                    {appConfig.formatCurrency(item.total)}
                  </Text>

                  <View style={styles.actionsRow}>
                    {isActive ? (
                      <TouchableOpacity
                        style={[styles.trackBtn, { backgroundColor: colors.primary }]}
                        onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="location-outline" size={16} color={colors.onPrimary} style={{ marginRight: 4 }} />
                        <Text style={[typography.labelMedium, { color: colors.onPrimary, fontWeight: '700' }]}>
                          Track Order
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.reorderBtn, { borderColor: colors.secondary }]}
                        onPress={() => navigation.navigate('StoreDetail', { storeId: item.storeId })}
                        activeOpacity={0.8}
                      >
                        <Text style={[typography.labelMedium, { color: colors.secondary, fontWeight: '700' }]}>
                          Reorder
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="receipt-outline" size={54} color={colors.subtext} />
              <Text style={[typography.titleMedium, { color: colors.onSurface, marginTop: 12 }]}>
                No orders placed yet
              </Text>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4 }]}>
                Your order history will appear here once you make your first order
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  dividerLine: {
    height: 1,
    backgroundColor: 'rgba(150,150,150,0.15)',
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  reorderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
});
