import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useTheme } from '../theme/theme';
import { authService } from '../services/authService';
import { cartService } from '../services/cartService';

const STARTUP_TIMEOUT_MS = 10_000;

const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    ),
  ]);

interface SplashScreenProps {
  navigation: any;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const splashHidden = useRef(false);

  // The native splash is held from index.js. Hide it only when the first real
  // screen is ready (or when the retry UI needs to be visible).
  const hideNativeSplash = useCallback(async () => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    try {
      await ExpoSplashScreen.hideAsync();
    } catch {
      // Ignore platforms where the native splash is not available (web).
    }
  }, []);

  const checkAuth = useCallback(async () => {
    setError(null);
    try {
      // Cart restoration is best-effort; a failed cache must not block login.
      const cartReady = withTimeout(
        Promise.resolve().then(() => cartService.initCart()),
        STARTUP_TIMEOUT_MS,
        'Loading your cart'
      ).catch((e) => {
        console.warn('Cart init failed', e);
      });

      const [user, onboardingComplete] = await Promise.all([
        withTimeout(
          authService.getCurrentSessionUser(),
          STARTUP_TIMEOUT_MS,
          'Loading your session'
        ),
        withTimeout(
          AsyncStorage.getItem('onboarding_complete'),
          STARTUP_TIMEOUT_MS,
          'Loading app state'
        ),
        cartReady,
      ]);

      const target =
        !user ? 'Auth' : onboardingComplete !== 'true' ? 'Onboarding' : 'MainTabs';

      navigation.replace(target);
      // Give the destination screen one paint before uncovering it.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => void hideNativeSplash())
      );
    } catch (e: any) {
      setError(
        e?.message ||
          'We could not start the app. Check your internet connection and try again.'
      );
      void hideNativeSplash();
    }
  }, [hideNativeSplash, navigation]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth, attempt]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.brandContainer}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Queless logo"
        />
        <Text style={[typography.displayLarge, { color: colors.onSurface, marginTop: 16, letterSpacing: 1 }]}>
          Queless
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.subtext, marginTop: 4 }]}>
          Instant Food & Groceries Delivery
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={[typography.bodySmall, { color: colors.error, textAlign: 'center' }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.secondary }]}
            onPress={() => setAttempt((value) => value + 1)}
            activeOpacity={0.85}
          >
            <Text style={[typography.titleSmall, { color: '#FFFFFF', fontWeight: '700' }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ActivityIndicator size="large" color={colors.secondary} style={styles.loader} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  brandContainer: { alignItems: 'center' },
  logo: {
    width: 108,
    height: 108,
    borderRadius: 24,
  },
  loader: { position: 'absolute', bottom: 60 },
  errorBox: { position: 'absolute', bottom: 48, left: 32, right: 32, alignItems: 'center' },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
});
