import React, { useState } from 'react';
import { Image, ImageProps, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';

interface SmartImageProps extends ImageProps {
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackIconSize?: number;
  aspectRatio?: number;
}

export const SmartImage: React.FC<SmartImageProps> = ({
  source,
  style,
  fallbackIcon = 'restaurant-outline',
  fallbackIconSize = 40,
  aspectRatio,
  resizeMode,
  ...props
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const containerStyle = [
    styles.container,
    { backgroundColor: colors.primaryContainer },
    aspectRatio ? { aspectRatio } : null,
    style,
  ];

  const hasSource =
    typeof source === 'number' ||
    (Array.isArray(source)
      ? source.some((item) => !!item.uri)
      : !!source && 'uri' in source && !!source.uri);

  if (error || !hasSource) {
    const badgeSize = Math.max(fallbackIconSize * 1.9, 48);
    const haloSize = badgeSize * 1.5;
    return (
      <View style={[containerStyle, styles.centered, { backgroundColor: colors.primaryContainer }]}>
        <View
          style={{
            position: 'absolute',
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: colors.secondary,
            opacity: 0.08,
          }}
        />
        <View
          style={{
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: colors.cardBackground,
            borderWidth: 1,
            borderColor: colors.divider,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={fallbackIcon} size={fallbackIconSize * 0.95} color={colors.secondary} />
        </View>
        <Ionicons
          name="image-outline"
          size={Math.max(12, Math.round(fallbackIconSize * 0.55))}
          color={colors.subtext}
          style={{ position: 'absolute', bottom: 8, right: 8, opacity: 0.3 }}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Image
        source={source}
        resizeMode={resizeMode}
        style={StyleSheet.absoluteFill}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        {...props}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.centered, { backgroundColor: colors.primaryContainer }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallback: {
    padding: 8,
  },
});
