import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/theme/theme';
import { AppNavigator } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { flushPendingAuthDeepLink, handleAuthDeepLink } from './src/utils/deepLinks';
import { flushPendingNotificationTap, handleCurrentNotificationUrl } from './src/utils/notificationLinks';

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
    fonts: (isDark ? DarkTheme : DefaultTheme).fonts,
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
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
