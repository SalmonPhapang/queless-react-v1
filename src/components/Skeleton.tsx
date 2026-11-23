import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, View, ViewStyle } from 'react-native';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useTheme } from '../theme/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}) => {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.divider,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const StoreCardSkeleton: React.FC<{ horizontal?: boolean }> = ({ horizontal = false }) => {
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.cardBackground,
        overflow: 'hidden',
        marginVertical: 6,
        marginHorizontal: layout.isWeb && !horizontal ? 6 : horizontal ? 0 : 16,
        width: horizontal ? layout.horizontalStoreCardWidth ?? 260 : undefined,
        maxWidth: !horizontal ? layout.cardMaxWidth : undefined,
        alignSelf: !horizontal && layout.isWeb ? ('center' as const) : undefined,
        marginRight: horizontal ? 12 : undefined,
      }}
    >
      <Skeleton
        width="100%"
        height={layout.isWeb ? undefined : 140}
        borderRadius={0}
        style={layout.isWeb ? { aspectRatio: 16 / 9 } : undefined}
      />
      <View style={{ padding: 12 }}>
        <Skeleton width="70%" height={18} borderRadius={6} style={{ marginBottom: 8 }} />
        <Skeleton width="50%" height={14} borderRadius={6} style={{ marginBottom: 10 }} />
        <Skeleton width="80%" height={14} borderRadius={6} />
      </View>
    </View>
  );
};

export const ProductCardSkeleton: React.FC = () => {
  const { colors } = useTheme();
  const layout = useResponsiveLayout();
  return (
    <View
      style={{
        flex: 1,
        margin: 8,
        maxWidth: layout.cardMaxWidth,
        alignSelf: layout.isWeb ? ('center' as const) : undefined,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.cardBackground,
        overflow: 'hidden',
      }}
    >
      <Skeleton
        width="100%"
        height={layout.isWeb ? undefined : 140}
        borderRadius={0}
        style={layout.isWeb ? { aspectRatio: 4 / 3 } : undefined}
      />
      <View style={{ padding: 12 }}>
        <Skeleton width="80%" height={16} borderRadius={6} style={{ marginBottom: 8 }} />
        <Skeleton width="40%" height={14} borderRadius={6} style={{ marginBottom: 12 }} />
        <Skeleton width="60%" height={32} borderRadius={8} />
      </View>
    </View>
  );
};

export const OrderCardSkeleton: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.divider,
        backgroundColor: colors.cardBackground,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Skeleton width="60%" height={18} borderRadius={6} style={{ marginBottom: 8 }} />
          <Skeleton width="80%" height={14} borderRadius={6} />
        </View>
        <Skeleton width={72} height={28} borderRadius={14} />
      </View>
      <Skeleton width="100%" height={1} borderRadius={0} style={{ marginVertical: 12 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width={80} height={18} borderRadius={6} />
        <Skeleton width={100} height={36} borderRadius={10} />
      </View>
    </View>
  );
};
