import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { authService } from '../../services/authService';
import { appConfig } from '../../config/appConfig';

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Required Fields', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await authService.signIn(email.trim(), password);
      navigation.replace('Onboarding');
    } catch (e: any) {
      Alert.alert('Login Failed', e.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneCode = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone Required', 'Enter the mobile number linked to your account.');
      return;
    }

    setLoading(true);
    try {
      const normalizedPhone = appConfig.normalizePhoneNumber(phone);
      await authService.sendPhoneLoginOtp(normalizedPhone);
      navigation.navigate('VerifyPhoneOtp', {
        phone: normalizedPhone,
        mode: 'login',
      });
    } catch (e: any) {
      Alert.alert('Could not send code', e.message || 'Check the phone number and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 24) },
        ]}
      >
        <View style={styles.headerBox}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Queless app logo"
          />
          <Text style={[typography.headlineLarge, { color: colors.onSurface, marginTop: 16 }]}>
            Welcome Back
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.subtext, marginTop: 4, textAlign: 'center' }]}>
            {mode === 'email'
              ? 'Sign in to continue ordering delicious meals'
              : "We'll text you a one-time code to sign in"}
          </Text>
        </View>

        <View style={styles.form}>
          {appConfig.features.phoneOtp && (
            <View style={[styles.segment, { backgroundColor: colors.primaryContainer }]}>
              <TouchableOpacity
                style={[
                  styles.segmentItem,
                  mode === 'email' && { backgroundColor: colors.cardBackground },
                ]}
                onPress={() => setMode('email')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    typography.labelMedium,
                    {
                      color: mode === 'email' ? colors.onSurface : colors.subtext,
                      fontWeight: '700',
                    },
                  ]}
                >
                  Email
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentItem,
                  mode === 'phone' && { backgroundColor: colors.cardBackground },
                ]}
                onPress={() => setMode('phone')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    typography.labelMedium,
                    {
                      color: mode === 'phone' ? colors.onSurface : colors.subtext,
                      fontWeight: '700',
                    },
                  ]}
                >
                  Phone
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'email' ? (
            <>
              <Text style={[typography.labelMedium, { color: colors.onSurface, marginBottom: 6 }]}>
                Email Address
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Ionicons name="mail-outline" size={20} color={colors.subtext} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.onSurface }]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.subtext}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <Text style={[typography.labelMedium, { color: colors.onSurface, marginTop: 16, marginBottom: 6 }]}>
                Password
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.subtext} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.onSurface }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.subtext}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.subtext} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => navigation.navigate('ForgotPassword')}
                activeOpacity={0.7}
              >
                <Text style={[typography.labelMedium, { color: colors.secondary }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleEmailLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[typography.titleMedium, { color: colors.onPrimary, fontWeight: '700' }]}>
                    Sign In
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[typography.labelMedium, { color: colors.onSurface, marginBottom: 6 }]}>
                Phone Number
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
                <Ionicons name="call-outline" size={20} color={colors.subtext} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.onSurface }]}
                  placeholder="082 123 4567"
                  placeholderTextColor={colors.subtext}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 8 }]}>
                Standard SMS rates may apply. The code expires after a few minutes.
              </Text>

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.secondary }]}
                onPress={handleSendPhoneCode}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
                    Send Code
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.footerRow}>
            <Text style={[typography.bodyMedium, { color: colors.subtext }]}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={[typography.titleSmall, { color: colors.secondary, fontWeight: '700' }]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    justifyContent: 'center',
    flexGrow: 1,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  segmentItem: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 96,
    height: 96,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 6,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 10,
  },
  primaryButton: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
});
