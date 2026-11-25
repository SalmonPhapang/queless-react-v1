import React, { useEffect } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { NAVIGATION_FONTS, useAppFonts } from './src/theme/fonts';
import { ThemeProvider, useTheme } from './src/theme/theme';
import { AppNavigator } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { flushPendingAuthDeepLink, handleAuthDeepLink } from './src/utils/deepLinks';
import { flushPendingNotificationTap, handleCurrentNotificationUrl } from './src/utils/notificationLinks';

// Keep the branded splash visible until the custom font is ready, so text never
// flashes in the platform default font before Plus Jakarta Sans loads.
SplashScreen.preventAutoHideAsync();

function useFullscreen() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const hideSystemBars = () => {
      StatusBar.setHidden(true);
      if (Platform.OS === 'android') NavigationBar.setHidden(true);
    };
    const hideAfterTransitions = () => {
      hideSystemBars();
      timers.push(setTimeout(hideSystemBars, 250));
    };

    hideAfterTransitions();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') hideAfterTransitions();
    });

    return () => {
      subscription.remove();
      timers.forEach(clearTimeout);
    };
  }, []);
}

const Root: React.FC = () => {
  const { colors, isDark } = useTheme();
  usePushNotifications();

  useEffect(() => {
    handleCurrentNotificationUrl();

    Linking.getInitialURL()
      .then((url) => handleAuthDeepLink(url ?? null))
      .catch((e) => console.warn('Initial deep link failed', e));

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleAuthDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    fonts: NAVIGATION_FONTS,
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary: colors.secondary,
      background: colors.surface,
      card: colors.appBarBackground,
      text: colors.onSurface,
      border: colors.divider,
      notification: colors.error,
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => {
        void flushPendingAuthDeepLink();
        flushPendingNotificationTap();
      }}
    >
      <StatusBar hidden style="light" />
      <NavigationBar hidden />
      <AppNavigator />
    </NavigationContainer>
  );
};

export default function App() {
  const [fontsLoaded, fontsError] = useAppFonts();
  useFullscreen();

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontsError]);

  if (!fontsLoaded && !fontsError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
