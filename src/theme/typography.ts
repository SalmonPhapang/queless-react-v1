import { TextStyle } from 'react-native';
import { APP_FONT_FAMILY } from './fonts';

const text = (style: TextStyle): TextStyle => ({
  fontFamily: APP_FONT_FAMILY,
  ...style,
});

export const Typography: Record<string, TextStyle> = {
  displayLarge: text({
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 48,
  }),
  headlineLarge: text({
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  }),
  headlineMedium: text({
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  }),
  titleLarge: text({
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  }),
  titleMedium: text({
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  }),
  titleSmall: text({
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  }),
  bodyLarge: text({
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  }),
  bodyMedium: text({
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  }),
  bodySmall: text({
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  }),
  labelLarge: text({
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  }),
  labelMedium: text({
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  }),
  labelSmall: text({
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
  }),
};
