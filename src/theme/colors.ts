// Queless palette: paper-white surfaces, near-black type and a signal red accent.
//
// Reference direction: minimal shipping/delivery UI with cool neutrals and a
// single confident accent colour. Green is deliberately gone.
export const LightColors = {
  primary: '#141416',
  onPrimary: '#FFFFFF',
  primaryContainer: '#F2F3F5',
  onPrimaryContainer: '#141416',
  secondary: '#D13540',
  onSecondary: '#FFFFFF',
  tertiary: '#B92F39',
  onTertiary: '#FFFFFF',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#FCE8E6',
  onErrorContainer: '#5F1410',
  surface: '#F5F6F7',
  onSurface: '#141416',
  appBarBackground: '#FFFFFF',
  cardBackground: '#FFFFFF',
  divider: '#E6E7EA',
  subtext: '#7C7D83',
  shadow: '#000000',
  accent: '#D13540',
};

export const DarkColors = {
  primary: '#F0F0F1',
  onPrimary: '#17171A',
  primaryContainer: '#26262A',
  onPrimaryContainer: '#F0F0F1',
  secondary: '#D13540',
  onSecondary: '#FFFFFF',
  tertiary: '#E06A72',
  onTertiary: '#1A0B0D',
  error: '#F87171',
  onError: '#2A0A0A',
  errorContainer: '#5A1A1A',
  onErrorContainer: '#FFDAD6',
  surface: '#0F0F11',
  onSurface: '#ECECEE',
  appBarBackground: '#0F0F11',
  cardBackground: '#18181B',
  divider: '#2A2A2E',
  subtext: '#A0A0A8',
  shadow: '#000000',
  accent: '#D13540',
};

export type ThemeColors = typeof LightColors;
