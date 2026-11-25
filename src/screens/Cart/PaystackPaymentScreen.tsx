import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Text,
  Platform,
  TouchableOpacity,
  Animated,
  Easing,
  AppState,
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
import { getPaymentPollingPlan, needsApprovalPolling } from '../../utils/paymentMethod';

type PaymentPhase = 'gateway' | 'waiting' | 'success' | 'failed';

const formatCountdown = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} min ${remainder.toString().padStart(2, '0')} sec`;
};

const RequestSentState: React.FC<{
  message: string;
  waitingLabel: string;
  methodLabel: string;
  isCapitecPay: boolean;
  isInstantEft: boolean;
  amount?: number;
  reference?: string;
  onOpenRequest?: () => void;
}> = ({ message, waitingLabel, methodLabel, isCapitecPay, isInstantEft, amount, reference, onOpenRequest }) => {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0.9)).current;
  const float = useRef(new Animated.Value(0)).current;
  const [remainingSeconds, setRemainingSeconds] = useState(300);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -6,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    floatLoop.start();

    const timer = setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => {
      pulseLoop.stop();
      floatLoop.stop();
      clearInterval(timer);
    };
  }, [pulse, float]);

  const steps = isCapitecPay
    ? [
        { title: 'Open your Capitec app', body: 'Tap the push notification, or open the app.' },
        { title: 'Approve payment', body: 'Confirm the request on the confirmation screen.' },
        { title: 'We’ll finish the rest', body: 'This screen updates as soon as payment is approved.' },
      ]
    : [
        { title: 'Open the payment window', body: 'We opened a secure window for your payment.' },
        {
          title: 'Complete payment',
          body: isInstantEft
            ? 'Approve the transfer in your banking app.'
            : 'Enter your card details in the secure window.',
        },
        { title: 'We’ll finish the rest', body: 'This screen updates as soon as payment is complete.' },
      ];

  return (
    <View style={[styles.stateScreen, { backgroundColor: colors.surface }]}>
      <ScrollView
        contentContainerStyle={[
          styles.stateContent,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.requestAnimation}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                backgroundColor: colors.primaryContainer,
                transform: [{ scale: pulse }],
                opacity: 0.75,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.iconBadge,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.divider,
                transform: [{ translateY: float }],
              },
            ]}
          >
            <Ionicons name="paper-plane-outline" size={38} color={colors.secondary} />
          </Animated.View>
        </View>

        <Text style={[typography.headlineSmall, { color: colors.onSurface, marginTop: 18, fontWeight: '700' }]}>
          Request sent
        </Text>
        <Text
          style={[
            typography.bodyMedium,
            { color: colors.subtext, marginTop: 8, textAlign: 'center', lineHeight: 22 },
          ]}
        >
          {message}
        </Text>

        <View
          style={[
            styles.countdownPill,
            { backgroundColor: colors.cardBackground, borderColor: colors.divider },
          ]}
        >
          <Ionicons name="time-outline" size={16} color={colors.secondary} style={{ marginRight: 8 }} />
          <Text style={[typography.labelMedium, { color: colors.onSurface }]}>
            You have {formatCountdown(remainingSeconds)} {isCapitecPay ? 'to approve' : 'to complete'}
          </Text>
        </View>

        <View
          style={[
            styles.requestCard,
            { backgroundColor: colors.cardBackground, borderColor: colors.divider },
          ]}
        >
          <View style={styles.requestRow}>
            <Text style={[typography.bodyMedium, { color: colors.subtext }]}>Order total</Text>
            <Text style={[typography.titleSmall, { color: colors.onSurface, fontWeight: '700' }]}>
              {amount === undefined ? '—' : appConfig.formatCurrency(amount)}
            </Text>
          </View>
          <View style={styles.requestRow}>
            <Text style={[typography.bodyMedium, { color: colors.subtext }]}>Payment</Text>
            <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{methodLabel}</Text>
          </View>
          {reference ? (
            <View style={styles.requestRow}>
              <Text style={[typography.bodyMedium, { color: colors.subtext }]}>Reference</Text>
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>
                {reference.slice(-6).toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.stepsBlock}>
          {steps.map((step, index) => (
            <View style={styles.stepRow} key={step.title}>
              <View style={[styles.stepNumber, { backgroundColor: colors.secondary }]}>
                <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
                  {index + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.titleSmall, { color: colors.onSurface }]}>{step.title}</Text>
                <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]}>
                  {step.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.waitingRow}>
          <View style={[styles.statusDot, { backgroundColor: colors.secondary }]} />
          <Text style={[typography.labelMedium, { color: colors.subtext }]}>{waitingLabel}</Text>
        </View>

        {isCapitecPay && (
          <View style={styles.fallbackBox}>
            <Text style={[typography.labelMedium, { color: colors.onSurface }]}>
              Didn’t receive the notification?
            </Text>
            <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4, lineHeight: 19 }]}>
              1. Sign in to your Capitec app{'\n'}2. Tap Transact{'\n'}3. Tap Capitec Pay and approve the payment
            </Text>
          </View>
        )}

        {onOpenRequest && (
          <TouchableOpacity style={styles.textAction} onPress={onOpenRequest} activeOpacity={0.8}>
            <Text style={[typography.bodySmall, { color: colors.secondary }]}>
              Didn’t see the payment window? Open it again
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
    <View
      style={[
        styles.stateScreen,
        { backgroundColor: colors.surface, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
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

const FailedState: React.FC<{
  title: string;
  message: string;
  onTryAgain: () => void;
  onCancel: () => void;
  cancelling: boolean;
  cancelError?: string;
}> = ({
  title,
  message,
  onTryAgain,
  onCancel,
  cancelling,
  cancelError,
}) => {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.stateScreen,
        { backgroundColor: colors.surface, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={[styles.successCircle, { backgroundColor: '#F59E0B' }]}>
        <Ionicons name="alert" size={42} color="#FFFFFF" />
      </View>
      <Text
        style={[
          typography.headlineSmall,
          { color: colors.onSurface, marginTop: 20, fontWeight: '700', textAlign: 'center' },
        ]}
      >
        {title}
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.subtext, marginTop: 8, textAlign: 'center' }]}>
        {message}
      </Text>
      <TouchableOpacity
        style={[styles.primaryAction, { backgroundColor: colors.secondary, opacity: cancelling ? 0.6 : 1 }]}
        onPress={onTryAgain}
        disabled={cancelling}
        activeOpacity={0.85}
      >
        <Text style={[typography.labelLarge, { color: '#FFFFFF', fontWeight: '700' }]}>Try again</Text>
      </TouchableOpacity>
      {cancelError ? (
        <Text
          style={[
            typography.bodySmall,
            { color: colors.error, textAlign: 'center', marginTop: 12, paddingHorizontal: 8 },
          ]}
        >
          {cancelError}
        </Text>
      ) : null}
      <TouchableOpacity
        style={[styles.secondaryAction, { borderColor: colors.divider }]}
        onPress={onCancel}
        disabled={cancelling}
        activeOpacity={0.85}
      >
        {cancelling ? (
          <ActivityIndicator size="small" color={colors.subtext} />
        ) : (
          <Text style={[typography.labelLarge, { color: colors.onSurface, fontWeight: '600' }]}>
            Cancel order
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export const PaystackPaymentScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { colors, typography } = useTheme();
  const { authorizationUrl, reference, orderId, paymentId, paymentMethod, amount } = route.params || {};
  const isCapitecPay = needsApprovalPolling(paymentMethod);
  const isNativePayment = Platform.OS !== 'web';
  // Native Capitec checkout is Paystack-owned: no duplicate app header or hint.
  const isNativeCapitecPay = isCapitecPay && isNativePayment;
  const methodLabel = isCapitecPay
    ? 'Capitec Pay'
    : paymentMethod === 'instantEft'
      ? 'Instant EFT'
      : 'Card';
  const waitingLabel = isCapitecPay ? 'Waiting for approval…' : 'Waiting for confirmation…';
  const defaultRequestMessage = isCapitecPay
    ? 'We’ve sent a request to your Capitec app. Approve it there and we’ll confirm your order automatically.'
    : 'We’ve opened a secure payment window. Complete it there and we’ll confirm your order automatically.';

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
  // never actually loaded.
  const webViewOrigins = [
    ...(callbackOrigin ? [callbackOrigin] : []),
    'https://*',
    'http://*',
  ];

  const [phase, setPhase] = useState<PaymentPhase>(Platform.OS === 'web' ? 'waiting' : 'gateway');
  const [requestMessage, setRequestMessage] = useState(defaultRequestMessage);
  const [failTitle, setFailTitle] = useState('Payment not completed');
  const [failMessage, setFailMessage] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const verificationStarted = useRef(false);
  const navigatingAway = useRef(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Capitec Pay requeries must start ~90s after the request was sent and stay
  // at least 10s apart. The screen opens when the request is created, so this
  // timestamp is the earliest safe check time.
  const startedAtRef = useRef(Date.now());
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);
  const pollCancelledRef = useRef(false);
  const terminalRef = useRef(false);
  const checkingRef = useRef(false);
  const checkPaymentRef = useRef<() => Promise<void>>(async () => {});
  const startPollingRef = useRef<(options?: { immediate?: boolean }) => void>(() => {});

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

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

  const settlePaid = async () => {
    clearPollTimer();
    pollCancelledRef.current = true;
    terminalRef.current = true;
    await cartService.clearCart();

    if (isNativePayment) {
      // On mobile Paystack owns the checkout UI. Once any method is verified,
      // leave the WebView and open tracking directly — no app-owned success
      // screen and no custom "request sent" page in front of the gateway.
      goToTracking();
      return;
    }

    setPhase('success');
  };

  const failVerification = (title: string, message: string) => {
    clearPollTimer();
    pollCancelledRef.current = true;
    terminalRef.current = true;
    verificationStarted.current = false;
    setCancelError('');
    setFailTitle(title);
    setFailMessage(message);
    setPhase('failed');
  };

  const scheduleCheck = (delayMs: number) => {
    clearPollTimer();
    pollTimerRef.current = setTimeout(() => {
      void checkPaymentRef.current();
    }, Math.max(1_000, delayMs));
  };

  // verify-paystack-split also requeries Capitec Pay, so this single check
  // covers both transaction status and Capitec approval status.
  const checkPayment = async () => {
    if (!paymentId || pollCancelledRef.current || checkingRef.current) return;
    checkingRef.current = true;

    const plan = getPaymentPollingPlan(paymentMethod, Date.now() - startedAtRef.current);
    // An early check (for example when the customer returns from the Capitec
    // app) must still honour the plan's first delay. Only later checks use the
    // short interval; the server independently enforces Capitec's 90s requery.
    const nextDelay = pollAttemptsRef.current === 0 ? plan.firstDelayMs : plan.intervalMs;

    try {
      const result = await paymentService.verifyPaystackPayment(paymentId, reference);
      if (result.paid) {
        await settlePaid();
        return;
      }

      if (pollAttemptsRef.current >= plan.maxAttempts) {
        failVerification(
          'Payment not completed',
          'We have not confirmed this payment yet. Your cart is saved — you can try again.'
        );
        return;
      }

      pollAttemptsRef.current += 1;
      setRequestMessage(
        isCapitecPay ? 'Still waiting for your approval…' : 'We’re checking again in a moment…'
      );
      scheduleCheck(nextDelay);
    } catch (e: any) {
      if (pollAttemptsRef.current >= plan.maxAttempts) {
        failVerification(
          'Could not verify payment',
          e?.message ||
            'We could not confirm the payment. Your cart is saved — check your Orders tab before paying again.'
        );
        return;
      }

      pollAttemptsRef.current += 1;
      setRequestMessage('We’re still checking — please keep this screen open.');
      scheduleCheck(nextDelay);
    } finally {
      checkingRef.current = false;
    }
  };
  checkPaymentRef.current = checkPayment;

  const startPolling = (options: { showWaitingUi?: boolean; immediate?: boolean } = {}) => {
    if (!paymentId || terminalRef.current) return;
    const alreadyStarted = verificationStarted.current;
    if (alreadyStarted && !options.immediate) return;

    verificationStarted.current = true;
    pollCancelledRef.current = false;
    if (!alreadyStarted) pollAttemptsRef.current = 0;

    if (options.showWaitingUi !== false) {
      overlayOpacity.setValue(1);
      setPhase('waiting');
      setRequestMessage(defaultRequestMessage);
    }

    if (options.immediate) {
      // A resume from the Capitec app can mean approval already happened.
      // Check now; the server will skip an early requery if it is too soon.
      clearPollTimer();
      void checkPaymentRef.current();
      return;
    }

    const plan = getPaymentPollingPlan(paymentMethod, Date.now() - startedAtRef.current);
    scheduleCheck(plan.firstDelayMs);
  };
  startPollingRef.current = startPolling;

  const startVerification = () => startPolling({ showWaitingUi: Platform.OS === 'web' });

  // Block the callback navigation itself: returning false stops the WebView
  // from rendering the raw callback/response HTML at all.
  const shouldStartLoadWithRequest = (request: { url?: string }) => {
    if (isCallbackUrl(request?.url || '')) {
      startVerification();
      return false;
    }
    return true;
  };

  const handleNavigationStateChange = (navState: any) => {
    if (isCallbackUrl(navState?.url)) {
      startVerification();
    }
  };

  const openPaymentWindow = () => {
    if (!authorizationUrl || typeof window === 'undefined') return;
    window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    // Mobile never shows a custom waiting page: the WebView stays visible and
    // verification runs silently behind it. Web still uses the callback-driven
    // request-sent screen.
    if (authorizationUrl) startVerification();
    // startVerification is intentionally keyed to the request identifiers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorizationUrl, paymentId]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    // Capitec approval happens in the banking app, so there is no WebView
    // callback to trigger verification. Coming back to the foreground is the
    // reliable signal that the customer may have approved the request.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') startPollingRef.current({ immediate: true });
    });
    return () => subscription.remove();
  }, []);

  // The request is non-dismissible until it settles, so a back gesture can no
  // longer expose the empty checkout behind it.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      if (navigatingAway.current) return;
      if (phase === 'waiting') {
        event.preventDefault();
        return;
      }
      if (phase === 'success') {
        event.preventDefault();
        navigateHome();
      }
    });
    return unsubscribe;
  }, [navigation, phase]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return undefined;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (phase === 'waiting') return true;
        if (phase === 'success') {
          navigateHome();
          return true;
        }
        return false;
      });
      return () => subscription.remove();
    }, [phase])
  );

  const onBack = () => navigation.goBack();

  const handleCancelPayment = async () => {
    if (cancelling) return;
    if (!paymentId || !orderId) {
      setCancelError('We could not identify this payment. Check your Orders tab.');
      return;
    }

    setCancelling(true);
    setCancelError('');
    clearPollTimer();
    pollCancelledRef.current = true;

    try {
      const result = await paymentService.cancelUnpaidPayment({ paymentId, orderId });
      if (result.paid) {
        // The cancellation check found a completed transaction. Let the server
        // settle the order before showing success; a transient error here is
        // safe because the webhook is still authoritative.
        try {
          await paymentService.verifyPaystackPayment(paymentId, reference);
        } catch {
          // Ignore: the order will settle from the webhook as well.
        }
        await settlePaid();
        return;
      }
      navigateHome();
    } catch (e: any) {
      setCancelError(e?.message || 'We could not cancel this order. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (phase === 'waiting' && Platform.OS === 'web') {
    return (
      <RequestSentState
        message={requestMessage}
        waitingLabel={waitingLabel}
        methodLabel={methodLabel}
        isCapitecPay={isCapitecPay}
        isInstantEft={paymentMethod === 'instantEft'}
        amount={amount}
        reference={reference}
        onOpenRequest={Platform.OS === 'web' ? openPaymentWindow : undefined}
      />
    );
  }
  if (phase === 'success') return <SuccessState onTrackOrder={goToTracking} />;
  if (phase === 'failed') {
    return (
      <FailedState
        title={failTitle}
        message={failMessage}
        onTryAgain={onBack}
        onCancel={handleCancelPayment}
        cancelling={cancelling}
        cancelError={cancelError}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {!isNativeCapitecPay && (
        <Header title={isCapitecPay ? 'Capitec Pay' : 'Secure Payment'} showBack onBackPress={onBack} />
      )}

      {isCapitecPay && !isNativeCapitecPay && (
        <View style={[styles.capitecHint, { backgroundColor: colors.cardBackground }]}>
          <Text style={[typography.bodySmall, { color: colors.subtext }]}>
            Choose Capitec Pay, then approve the request in your Capitec app.
          </Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <PlatformWebView
          source={{ uri: authorizationUrl || 'about:blank' }}
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
  capitecHint: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
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
  stateContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestAnimation: {
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
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  requestCard: {
    width: '100%',
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  stepsBlock: {
    width: '100%',
    marginTop: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  fallbackBox: {
    width: '100%',
    marginTop: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(120,120,128,0.2)',
    padding: 14,
  },
  textAction: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
  secondaryAction: {
    marginTop: 12,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 220,
  },
});
