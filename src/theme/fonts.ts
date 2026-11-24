// Importing each cut directly keeps Metro from emitting every weight/italic in
// the package; only the four weights used by the app are bundled.
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useFonts } from 'expo-font';

/** Single family used by every semantic text style and by React Navigation. */
export const APP_FONT_FAMILY = 'Plus Jakarta Sans';

/**
 * Plus Jakarta Sans ships as static cuts, so the supported weights are grouped
 * under one family name. Using expo-font directly (instead of the package's
 * own map hook) lets `fontWeight` select the right face on native and web.
 */
export function useAppFonts(): [boolean, Error | null] {
  return useFonts([
    {
      fontFamily: APP_FONT_FAMILY,
      fontDefinitions: [
        { path: PlusJakartaSans_400Regular, weight: 400 },
        { path: PlusJakartaSans_600SemiBold, weight: 600 },
        { path: PlusJakartaSans_700Bold, weight: 700 },
        { path: PlusJakartaSans_800ExtraBold, weight: 800 },
      ],
    },
  ]);
}

/** Keeps navigation headers visually identical to the rest of the app. */
export const NAVIGATION_FONTS = {
  regular: { fontFamily: APP_FONT_FAMILY, fontWeight: '400' },
  medium: { fontFamily: APP_FONT_FAMILY, fontWeight: '600' },
  bold: { fontFamily: APP_FONT_FAMILY, fontWeight: '700' },
  heavy: { fontFamily: APP_FONT_FAMILY, fontWeight: '800' },
} as const;
