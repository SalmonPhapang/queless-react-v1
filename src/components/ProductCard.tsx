import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Product } from '../models/product';
import { useTheme } from '../theme/theme';
import { SmartImage } from './SmartImage';
import { appConfig } from '../config/appConfig';

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  horizontal?: boolean;
  /** Short recommendation reason, e.g. "You reorder this". */
  badge?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  onAddToCart,
  horizontal = false,
  badge,
}) => {
  const { colors, typography } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        horizontal ? styles.horizontalCard : styles.gridCard,
        { backgroundColor: colors.cardBackground, borderColor: colors.divider },
      ]}
      onPress={() => onPress(product)}
      activeOpacity={0.85}
    >
      <View style={styles.imageContainer}>
        <SmartImage
          source={{ uri: product.imageUrl }}
          style={styles.image}
          fallbackIcon="fast-food-outline"
          fallbackIconSize={36}
        />
        {!!badge && (
          <View style={[styles.badgeContainer, { backgroundColor: colors.primaryContainer }]}>
            <Text style={[typography.labelSmall, { color: colors.secondary }]} numberOfLines={1}>
              {badge}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={[typography.titleMedium, { color: colors.onSurface }]} numberOfLines={1}>
          {product.name}
        </Text>

        <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]} numberOfLines={2}>
          {product.description}
        </Text>

        <View style={styles.footerRow}>
          <Text style={[typography.titleMedium, { color: colors.secondary, fontWeight: '700' }]}>
            {appConfig.formatCurrency(product.price)}
          </Text>

          {onAddToCart && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.secondary }]}
              onPress={() => onAddToCart(product)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    margin: 6,
  },
  gridCard: {
    flex: 1,
  },
  horizontalCard: {
    width: 180,
    marginRight: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 110,
  },
  badgeContainer: {
    position: 'absolute',
    top: 6,
    left: 6,
    maxWidth: '85%',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  content: {
    padding: 10,
    justifyContent: 'space-between',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
