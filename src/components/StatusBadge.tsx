import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { OrderStatus, PaymentStatus, DriverStatus } from '../models/statuses';

interface StatusBadgeProps {
  status: OrderStatus | PaymentStatus | DriverStatus | string;
  type?: 'order' | 'payment' | 'driver';
  /** Shorter labels and a constrained width for dense cards such as Orders. */
  compact?: boolean;
}

const COMPACT_LABELS: Record<string, string> = {
  awaiting_payment: 'AWAITING PAYMENT',
  awaiting_store_acceptance: 'AWAITING STORE',
  ready_for_pickup: 'READY FOR PICKUP',
  out_for_delivery: 'OUT FOR DELIVERY',
  driver_assigned: 'DRIVER ASSIGNED',
  heading_to_customer: 'ON THE WAY',
  at_customer: 'ARRIVED',
  heading_to_store: 'TO STORE',
  at_store: 'AT STORE',
  failed_delivery: 'FAILED DELIVERY',
  partially_refunded: 'PART REFUND',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'order', compact = false }) => {
  const { typography } = useTheme();

  const getStatusColor = () => {
    switch (status) {
      // Settled / finished (canonical payment + order values).
      case 'delivered':
      case 'completed':
        return { bg: '#DCEBDD', text: '#2F5B3A' };

      // In flight.
      case 'out_for_delivery':
      case 'arrived':
      case 'heading_to_customer':
      case 'at_customer':
        return { bg: '#DEE8F2', text: '#2E4D6B' };

      // In progress at the store / driver.
      case 'preparing':
      case 'processing':
      case 'awaiting_store_acceptance':
      case 'driver_assigned':
      case 'heading_to_store':
      case 'at_store':
      case 'assigned':
      case 'accepted':
        return { bg: '#F4E8D1', text: '#7A551A' };

      // Waiting for the customer to do something.
      case 'pending':
      case 'awaiting_payment':
        return { bg: '#E9E4F1', text: '#4B3C6B' };

      // Unhappy endings.
      case 'cancelled':
      case 'rejected':
      case 'failed':
      case 'failed_delivery':
        return { bg: '#F5DDD9', text: '#7F2D27' };

      case 'refunded':
      case 'partially_refunded':
        return { bg: '#EEE7F2', text: '#5B416B' };

      default:
        return { bg: '#F1F2F4', text: '#5F6066' };
    }
  };

  const { bg, text } = getStatusColor();
  const statusKey = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const formattedText = compact
    ? COMPACT_LABELS[statusKey] || status.replace(/_/g, ' ').toUpperCase()
    : status.replace(/_/g, ' ').toUpperCase();

  return (
    <View
      style={[
        styles.badge,
        compact && styles.compactBadge,
        { backgroundColor: bg },
      ]}
    >
      <Text
        style={[typography.labelSmall, styles.badgeText, { color: text, fontWeight: '700' }]}
        numberOfLines={compact ? 2 : undefined}
        ellipsizeMode="tail"
      >
        {formattedText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    maxWidth: 180,
  },
  compactBadge: {
    alignSelf: 'flex-end',
    maxWidth: 132,
  },
  badgeText: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
