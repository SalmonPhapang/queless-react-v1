import { useMemo } from 'react';
import { Platform, StyleProp, useWindowDimensions, ViewStyle } from 'react-native';

export interface ResponsiveLayout {
  isWeb: boolean;
  width: number;
  /** Native keeps two columns; web expands on wider viewports. */
  columns: number;
  contentMaxWidth?: number;
  cardMaxWidth?: number;
  heroMaxWidth?: number;
  horizontalStoreCardWidth?: number;
  horizontalProductCardWidth?: number;
}

/**
 * Web-only layout metadata. On iOS/Android every value that affects layout is
 * either the existing native value or undefined, so native screens are unchanged.
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    if (Platform.OS !== 'web') {
      return {
        isWeb: false,
        width,
        columns: 2,
      };
    }

    if (width >= 1180) {
      return {
        isWeb: true,
        width,
        columns: 4,
        contentMaxWidth: 1180,
        cardMaxWidth: 280,
        heroMaxWidth: 900,
        horizontalStoreCardWidth: 280,
        horizontalProductCardWidth: 220,
      };
    }

    if (width >= 820) {
      return {
        isWeb: true,
        width,
        columns: 3,
        contentMaxWidth: 960,
        cardMaxWidth: 300,
        heroMaxWidth: 760,
        horizontalStoreCardWidth: 260,
        horizontalProductCardWidth: 210,
      };
    }

    if (width >= 560) {
      return {
        isWeb: true,
        width,
        columns: 2,
        contentMaxWidth: 760,
        cardMaxWidth: 340,
        heroMaxWidth: 640,
        horizontalStoreCardWidth: 240,
        horizontalProductCardWidth: 190,
      };
    }

    return {
      isWeb: true,
      width,
      columns: 2,
      horizontalStoreCardWidth: 260,
      horizontalProductCardWidth: 180,
    };
  }, [width]);
}

/** Centers web content at a readable width; native returns the original style. */
export function responsiveContentStyle(
  layout: ResponsiveLayout,
  style?: StyleProp<ViewStyle>
): StyleProp<ViewStyle> {
  if (!layout.isWeb || !layout.contentMaxWidth) return style ?? null;
  return [{ width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' }, style];
}
