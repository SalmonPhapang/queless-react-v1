import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Platform,
  TouchableOpacity,
  Linking,
  Animated,
  Easing,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlatformWebView } from '../../components/PlatformWebView';
import { useTheme } from '../../theme/theme';
import { appConfig } from '../../config/appConfig';
import { paymentService } from '../../services/paymentService';
import { cartService } from '../../services/cartService';
import { Header } from '../../components/Header';
import { needsApprovalPolling } from '../../utils/paymentMethod';

type PaymentPhase = 'gateway' | 'verifying' | 'success' | 'failed';

const VerifyingState: React.FC<{ message?: string; onCancel?: () => void }> = ({ message, onCancel }) => {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0.85)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const rotateLoop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    pulseLoop.start();
    rotateLoop.start();
    return () => {
      pulseLoop.stop();
      rotateLoop.stop();
    };
  }, [pulse, rotate]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.stateScreen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={styles.animationWrap}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              backgroundColor: colors.primaryContainer,
              transform: [{ scale: pulse }],
              opacity: 0.7,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.iconBadge,
            { backgroundColor: colors.cardBackground, borderColor: colors.divider, transform: [{ rotate: spin }] },
          ]}
        >
          <Ionicons name="sync" size={34} color={colors.secondary} />
        </Animated.View>
      </View>
      <Text style={[typography.headlineSmall, { color: colors.onSurface, marginTop: 20, fontWeight: '700' }]}>
        Verifying payment
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.subtext, marginTop: 8, textAlign: 'center' }]}>
        {message || 'Please wait while we confirm your payment with Paystack…'}
      </Text>
      <ActivityIndicator size="small" color={colors.secondary} style={{ marginTop: 18 }} />
      {onCancel && (
        <TouchableOpacity
          style={[styles.cancelAction, { borderColor: colors.divider }]}
          onPress={onCancel}
          activeOpacity={0.85}
        >
          <Text style={[typography.labelMedium, { color: colors.subtext }]}>Back to checkout</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const SuccessState: React.FC<{ onTrackOrder: () => void }> = ({ onTrackOrder }) => {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <View style={[styles.stateScreen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <Animated.View style={[styles.successCircle, { backgroundColor: colors.secondary, transform: [{ scale }], opacity }]}>
        <Ionicons name="checkmark" size={46} color="#FFFFFF" />
      </Animated.View>
      <Text style={[typography.headlineSmall, { color: colors.onSurface, marginTop: 20, fontWeight: '700' }]}>
        Payment successful
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.subtext, marginTop: 8, textAlign: 'center' }]}>
        Your order has been confirmed. You can track its progress now.
      </Text>
      <TouchableOpacity
        style={[styles.primaryAction, { backgroundColor: colors.secondary }]}
        onPress={onTrackOrder}
        activeOpacity={0.85}
      >
        <Ionicons name="location-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={[typography.labelLarge, { color: '#FFFFFF', fontWeight: '700' }]}>Track order</Text>
      </TouchableOpacity>
    </View>
  );
};

const FailedState: React.FC<{ title: string; message: string; onBack: () => void }> = ({ title, message, onBack }) => {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.stateScreen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={[styles.successCircle, { backgroundColor: '#F59E0B' }]}>
        <Ionicons name="alert" size={42} color="#FFFFFF" />
      </View>
      <Text style={[typography.headlineSmall, { color: colors.onSurface, marginTop: 20, fontWeight: '700', textAlign: 'center' }]}>
        {title}
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.subtext, marginTop: 8, textAlign: 'center' }]}>
        {message}
      </Text>
      <TouchableOpacity
        style={[styles.primaryAction, { backgroundColor: colors.secondary }]}
        onPress={onBack}
        activeOpacity={0.85}
      >
        <Text style={[typography.labelLarge, { color: '#FFFFFF', fontWeight: '700' }]}>Back to checkout</Text>
      </TouchableOpacity>
    </View>
  );
};

export const PaystackPaymentScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { colors, typography } = useTheme();
  const { authorizationUrl, reference, paymentId, orderId, paymentMethod } = route.params || {};
  const isCapitecPay = needsApprovalPolling(paymentMethod);

  // The Supabase callback returns raw HTML, so it must be cancelled before the
  // WebView commits the navigation. It still needs to pass the whitelist so
  // onShouldStartLoadWithRequest has a chance to intercept it.
  const callbackOrigin = (() => {
    try {
      return new URL(appConfig.paystackCallbackUrl).origin.toLowerCase();
    } catch {
      return '';
    }
  })();
  // react-native-webview checks originWhitelist BEFORE onShouldStartLoadWithRequest
  // and otherwise tries to open the URL externally. The callback must pass the
  // whitelist so our interceptor can cancel it and start verification; it is
  // never actually loaded (see shouldStartLoadWithRequest below).
  const webViewOrigins = [
    ...(callbackOrigin ? [callbackOrigin] : []),
    'https://*',
    'http://*',
  ];

  const [phase, setPhase] = useState<PaymentPhase>('gateway');
  const [failTitle, setFailTitle] = useState('Payment not completed');
  const [failMessage, setFailMessage] = useState('');
  const [verifyMessage, setVerifyMessage] = useState<string | undefined>(undefined);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const handled = useRef(false);
  const navigatingAway = useRef(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Capitec Pay is approved in the banking app, so Paystack can confirm it
  // after the customer returns. The docs recommend waiting 90s before the
  // first requery and never polling faster than 10s.
  const startedAtRef = useRef(Date.now());
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);
  const pollCancelledRef = useRef(false);

  const clearPollTimer = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const isCallbackUrl = (url: string): boolean => {
    if (!url) return false;
    if (appConfig.paystackCallbackUrl && url.startsWith(appConfig.paystackCallbackUrl)) return true;

    try {
      const parsed = new URL(url);
      if (parsed.pathname.includes('/paystack-callback')) return true;
      if (parsed.searchParams.has('trxref') && !parsed.hostname.toLowerCase().includes('paystack')) {
        return true;
      }
    } catch {
      // fall through to the raw checks below
    }

    return url.includes('trxref=') || url.includes('/paystack-callback');
  };

  const navigateHome = () => {
    navigatingAway.current = true;
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs', params: { screen: 'FoodTab' } }],
    });
  };

  const goToTracking = () => {
    // Drop Cart/Checkout/Paystack from the stack so back from tracking goes Home.
    navigatingAway.current = true;
    navigation.reset({
      index: 1,
      routes: [
        { name: 'MainTabs', params: { screen: 'FoodTab' } },
        { name: 'OrderTracking', params: { orderId, fromCheckout: true } },
      ],
    });
  };

  const failVerification = (title: string, message: string) => {
    clearPollTimer();
    handled.current = false;
    setAwaitingApproval(false);
    setFailTitle(title);
    setFailMessage(message);
    setPhase('failed');
  };

  // verify-paystack-split also requeries Capitec Pay, so this single check
  // covers both Paystack's transaction status and the Capitec approval status.
  const checkPayment = async () => {
    if (!paymentId || pollCancelledRef.current) return;

    try {
      const result = await paymentService.verifyPaystackPayment(paymentId, reference);
      if (result.paid) {
        clearPollTimer();
        await cartService.clearCart();
        setPhase('success');
        return;
      }

      const maxAttempts = 30; // 10s minimum interval => up to ~5 minutes total
      if (isCapitecPay && pollAttemptsRef.current < maxAttempts) {
        pollAttemptsRef.current += 1;
        // First check happens 90s after opening checkout; later checks are 10s apart.
        const elapsed = Date.now() - startedAtRef.current;
        const delay = Math.max(10_000, 90_000 - elapsed);
        setAwaitingApproval(true);
        setVerifyMessage('Waiting for approval in your Capitec app…');
        pollTimerRef.current = setTimeout(() => {
          void checkPayment();
        }, delay);
        return;
      }

      failVerification(
        'Payment not completed',
        'Paystack has not confirmed this payment yet. Your cart is saved — you can try again.'
      );
    } catch (e: any) {
      failVerification(
        'Could not verify payment',
        e?.message ||
          'We could not confirm the payment. Your cart is saved — check your Orders tab before paying again.'
      );
    }
  };

  const finishPayment = async () => {
    if (handled.current || !paymentId) return;
    handled.current = true;
    pollCancelledRef.current = false;
    pollAttemptsRef.current = 0;
    // Cover the WebView synchronously so the callback HTML never flashes.
    overlayOpacity.setValue(1);
    setPhase('verifying');
    setVerifyMessage(undefined);
    setAwaitingApproval(false);
    await checkPayment();
  };

  const cancelWaiting = () => {
    pollCancelledRef.current = true;
    clearPollTimer();
    handled.current = false;
    setAwaitingApproval(false);
    navigatingAway.current = true;
    navigation.goBack();
  };

  // Block the callback navigation itself: returning false stops the WebView
  // from rendering Paystack's raw callback/response HTML at all.
  const shouldStartLoadWithRequest = (request: { url?: string }) => {
    if (isCallbackUrl(request?.url || '')) {
      void finishPayment();
      return false;
    }
    return true;
  };

  const handleNavigationStateChange = (navState: any) => {
    if (isCallbackUrl(navState?.url)) {
      void finishPayment();
    }
  };

  const openGateway = async () => {
    if (!authorizationUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(authorizationUrl);
      if (canOpen) {
        await Linking.openURL(authorizationUrl);
      } else if (typeof window !== 'undefined') {
        window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web' && authorizationUrl && phase === 'gateway') {
      void openGateway();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorizationUrl]);

  // Do not let the hardware/browser back button expose the empty checkout
  // behind a successful payment. Verification is also non-dismissible.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      if (navigatingAway.current) return;
      if (phase === 'verifying') {
        event.preventDefault();
        if (awaitingApproval) cancelWaiting();
        return;
      }
      if (phase === 'success') {
        event.preventDefault();
        navigateHome();
      }
    });
    return unsubscribe;
  }, [navigation, phase, awaitingApproval]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return undefined;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (phase === 'verifying') {
          if (awaitingApproval) cancelWaiting();
          return true;
        }
        if (phase === 'success') {
          navigateHome();
          return true;
        }
        return false;
      });
      return () => subscription.remove();
    }, [phase, awaitingApproval])
  );

  const onBack = () => navigation.goBack();

  // State screens are fully opaque and rendered without the gateway header so
  // no Paystack page/response text can show through while verifying.
  if (phase === 'verifying') {
    return (
      <VerifyingState
        message={verifyMessage}
        onCancel={awaitingApproval ? cancelWaiting : undefined}
      />
    );
  }
  if (phase === 'success') return <SuccessState onTrackOrder={goToTracking} />;
  if (phase === 'failed') return <FailedState title={failTitle} message={failMessage} onBack={onBack} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title={isCapitecPay ? 'Capitec Pay (Paystack)' : 'Paystack Secure Payment'} showBack onBackPress={onBack} />

      {isCapitecPay && (
        <View style={[styles.capitecHint, { backgroundColor: colors.cardBackground }]}>
          <Text style={[typography.bodySmall, { color: colors.subtext }]}>
            Choose Capitec Pay on the Paystack page, then approve the request in your Capitec app.
          </Text>
        </View>
      )}

      {Platform.OS === 'web' ? (
        <View style={[styles.webNotice, { backgroundColor: colors.cardBackground }]}>
          <Text style={[typography.titleMedium, { color: colors.onSurface }]}>Continue on Paystack</Text>
          <Text style={[typography.bodyMedium, { color: colors.subtext, marginTop: 8, textAlign: 'center' }]}>
            We opened the Paystack checkout in a new tab. Complete your payment there, then return here and tap
            Verify payment.
          </Text>
          <TouchableOpacity
            style={[styles.verifyButton, { backgroundColor: colors.secondary }]}
            onPress={openGateway}
            disabled={!authorizationUrl}
            activeOpacity={0.85}
          >
            <Text style={[typography.labelLarge, { color: '#FFFFFF', fontWeight: '700' }]}>Open Paystack</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.verifyButton, { backgroundColor: colors.secondary, marginTop: 12 }]}
            onPress={() => void finishPayment()}
            disabled={!paymentId}
            activeOpacity={0.85}
          >
            <Text style={[typography.labelLarge, { color: '#FFFFFF', fontWeight: '700' }]}>Verify payment</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <PlatformWebView
            source={{ uri: authorizationUrl || 'https://paystack.com' }}
            originWhitelist={webViewOrigins}
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={shouldStartLoadWithRequest}
            onNavigationStateChange={handleNavigationStateChange}
            startInLoadingState
            renderLoading={() => (
              <View style={[styles.loadingOverlay, { backgroundColor: colors.surface }]}>
                <ActivityIndicator size="large" color={colors.secondary} />
              </View>
            )}
            style={{ flex: 1 }}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.verifyCover, { opacity: overlayOpacity, backgroundColor: colors.surface }]}
          />
        </View>
      )}
    </View>
  );
};

const absoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingOverlay: {
    ...absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  webNotice: {
    flex: 1,
    margin: 24,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButton: {
    marginTop: 24,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
  },
  capitecHint: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
  },
  cancelAction: {
    marginTop: 16,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyCover: {
    ...absoluteFill,
    zIndex: 200,
    elevation: 200,
  },
  stateScreen: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 999,
    elevation: 999,
  },
  animationWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  iconBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAction: {
    marginTop: 28,
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minWidth: 220,
  },
});
