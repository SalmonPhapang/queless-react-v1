import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Store } from '../models/store';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useTheme } from '../theme/theme';
import { SmartImage } from './SmartImage';
import { appConfig } from '../config/appConfig';

interface StoreCardProps {
  store: Store;
  onPress: (store: Store) => void;
  horizontal?: boolean;
  /** Short recommendation reason, e.g. "Frequently order here". */
  badge?: string;
}

export const StoreCard: React.FC<StoreCardProps> = ({ store, onPress, horizontal = false, badge }) => {
  const { colors, typography } = useTheme();
  const layout = useResponsiveLayout();

  const webCardStyle = layout.isWeb
    ? horizontal
      ? { width: layout.horizontalStoreCardWidth }
      : { marginHorizontal: 6, maxWidth: layout.cardMaxWidth, alignSelf: 'center' as const, flex: 1 }
    : undefined;
  const webImageStyle = layout.isWeb ? { height: undefined, aspectRatio: 16 / 9 } : undefined;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        horizontal ? styles.horizontalCard : styles.fullCard,
        webCardStyle,
        { backgroundColor: colors.cardBackground, borderColor: colors.divider },
      ]}
      onPress={() => onPress(store)}
      activeOpacity={0.85}
    >
      <View style={[styles.imageContainer, webImageStyle]}>
        <SmartImage
          source={{ uri: store.imageUrl }}
          style={styles.image}
          resizeMode={layout.isWeb ? 'contain' : undefined}
          fallbackIcon="storefront-outline"
          fallbackIconSize={48}
        />
        {!store.isOpen && (
          <View style={styles.closedOverlay}>
            <Text style={[typography.labelSmall, { color: '#FFFFFF', fontWeight: '700' }]}>CLOSED</Text>
          </View>
        )}
        {store.isAlcohol && (
          <View style={[styles.badgeContainer, { backgroundColor: '#7C3AED' }]}>
            <Text style={[typography.labelSmall, { color: '#FFFFFF' }]}>18+ Liquor</Text>
          </View>
        )}
        {!!badge && (
          <View style={[styles.reasonBadge, { backgroundColor: colors.primaryContainer }]}>
            <Text style={[typography.labelSmall, { color: colors.secondary }]} numberOfLines={1}>
              {badge}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.headerRow}>
          <Text style={[typography.titleMedium, { color: colors.onSurface, flex: 1 }]} numberOfLines={1}>
            {store.name}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={[typography.labelMedium, { color: colors.onSurface, marginLeft: 2 }]}>
              {store.rating.toFixed(1)}
            </Text>
          </View>
        </View>

        <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]} numberOfLines={1}>
          {store.cuisineTypes.join(' • ') || store.category}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={colors.subtext} />
            <Text style={[typography.bodySmall, { color: colors.subtext, marginLeft: 4 }]}>
              {store.deliveryTimeMin}-{store.deliveryTimeMax} min
            </Text>
          </View>

          <Text style={[typography.bodySmall, { color: colors.subtext, marginHorizontal: 6 }]}>•</Text>

          <View style={styles.metaItem}>
            <Ionicons name="bicycle-outline" size={14} color={colors.subtext} />
            <Text style={[typography.bodySmall, { color: colors.subtext, marginLeft: 4 }]}>
              {store.deliveryFee === 0 ? 'FREE' : appConfig.formatCurrency(store.deliveryFee)}
            </Text>
          </View>

          {store.distance !== undefined && (
            <>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginHorizontal: 6 }]}>•</Text>

              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={14} color={colors.subtext} />
                <Text style={[typography.bodySmall, { color: colors.subtext, marginLeft: 4 }]}>
                  {store.distance} km
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const absoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 6,
  },
  fullCard: {
    marginHorizontal: 16,
  },
  horizontalCard: {
    width: 260,
    marginRight: 12,
  },
  imageContainer: {
    height: 140,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closedOverlay: {
    ...absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reasonBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    maxWidth: '70%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  infoContainer: {
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
