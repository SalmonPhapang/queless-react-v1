import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface HorizontalScrollIndicatorProps {
  totalCount: number;
  activeIndex: number;
}

export const HorizontalScrollIndicator: React.FC<HorizontalScrollIndicatorProps> = ({
  totalCount,
  activeIndex,
}) => {
  const { colors } = useTheme();

  if (totalCount <= 1) return null;

  return (
    <View style={styles.container}>
      {Array.from({ length: totalCount }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === activeIndex
              ? [styles.activeDot, { backgroundColor: colors.secondary }]
              : { backgroundColor: colors.divider },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  activeDot: {
    width: 16,
  },
});
