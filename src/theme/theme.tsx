import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors, ThemeColors } from './colors';
import { Typography } from './typography';

export type ThemeScheme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  typography: typeof Typography;
  toggleTheme: () => void;
  setScheme: (scheme: ThemeScheme) => void;
}

const THEME_STORAGE_KEY = '@queless_theme';

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: DarkColors,
  typography: Typography,
  toggleTheme: () => {},
  setScheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [scheme, setSchemeState] = useState<ThemeScheme>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setSchemeState(stored);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  const persist = (next: ThemeScheme) => {
    setSchemeState(next);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => undefined);
  };

  const isDark = scheme === 'system' ? systemScheme === 'dark' : scheme === 'dark';

  const toggleTheme = () => persist(isDark ? 'light' : 'dark');
  const setScheme = (next: ThemeScheme) => persist(next);

  const colors = isDark ? DarkColors : LightColors;

  // Render only once the stored preference is known, so the app does not flash
  // the wrong theme on launch.
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ isDark, colors, typography: Typography, toggleTheme, setScheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
