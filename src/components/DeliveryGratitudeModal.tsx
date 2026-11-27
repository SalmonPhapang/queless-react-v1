import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { navigateFromOutside } from '../navigation/navigationRef';
import { useTheme } from '../theme/theme';
import type { DeliveryCompletion } from '../services/deliveryCompletionService';

interface Props {
  completion: DeliveryCompletion | null;
  onDismiss: () => void;
}

export const DeliveryGratitudeModal: React.FC<Props> = ({ completion, onDismiss }) => {
  const { colors, typography } = useTheme();

  const viewOrders = () => {
    navigateFromOutside('MainTabs', { screen: 'OrdersTab' });
    onDismiss();
  };

  return (
    <Modal
      visible={!!completion}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="checkmark-circle" size={56} color={colors.secondary} />
          </View>

          <Text style={[typography.labelSmall, { color: colors.secondary, fontWeight: '700', marginTop: 16 }]}>
            DELIVERY COMPLETE
          </Text>
          <Text style={[typography.titleMedium, { color: colors.onSurface, marginTop: 6, textAlign: 'center' }]}>
            Thank you for choosing Queless
          </Text>
          <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 10, textAlign: 'center', lineHeight: 20 }]}>
            {completion?.storeName
              ? `Your order from ${completion.storeName}`
              : 'Your order'}{' '}
            has been delivered. We are grateful to be part of your day and hope you enjoy every bite.
          </Text>
          {!!completion?.orderNumber && (
            <Text style={[typography.labelSmall, { color: colors.subtext, marginTop: 8 }]}>
              Order #{completion.orderNumber}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.secondary, marginTop: 22 }]}
            onPress={viewOrders}
            activeOpacity={0.85}
          >
            <Text style={[typography.labelMedium, { color: colors.onPrimary, fontWeight: '800' }]}>
              View my orders
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onDismiss} activeOpacity={0.8}>
            <Text style={[typography.labelMedium, { color: colors.subtext, fontWeight: '700' }]}>
              Keep browsing
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  iconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtn: {
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 13,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
});
