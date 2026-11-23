import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartService } from '../services/cartService';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { Cart } from '../models/cart';
import { useTheme } from '../theme/theme';
import { appConfig } from '../config/appConfig';

interface CartBannerProps {
  onPressCart: () => void;
}

export const CartBanner: React.FC<CartBannerProps> = ({ onPressCart }) => {
  const { colors, typography } = useTheme();
  const layout = useResponsiveLayout();
  const [cart, setCart] = useState<Cart | null>(cartService.getCartSync());

  useEffect(() => {
    const unsubscribe = cartService.subscribe((updatedCart) => {
      setCart(updatedCart);
    });
    return unsubscribe;
  }, []);

  if (!cart || cart.items.length === 0) return null;

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartService.calculateSubtotal();

  return (
    <View
      style={[
        styles.container,
        layout.isWeb && {
          left: '50%',
          right: undefined,
          width: '100%',
          maxWidth: layout.contentMaxWidth ?? 760,
          transform: [{ translateX: '-50%' }],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: colors.secondary }]}
        onPress={onPressCart}
        activeOpacity={0.9}
      >
        <View style={styles.badge}>
          <Text style={[typography.labelMedium, { color: colors.secondary, fontWeight: '700' }]}>
            {totalItems}
          </Text>
        </View>

        <View style={styles.info}>
          <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
            View Cart
          </Text>
          <Text style={[typography.bodySmall, { color: 'rgba(255,255,255,0.9)' }]}>
            {cart.storeName || 'Store'}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
            {appConfig.formatCurrency(subtotal)}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" style={{ marginLeft: 4 }} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  badge: {
    backgroundColor: '#FFFFFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
