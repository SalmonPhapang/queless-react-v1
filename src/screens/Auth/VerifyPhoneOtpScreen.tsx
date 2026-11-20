import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { authService } from '../../services/authService';

type OtpMode = 'login' | 'signup' | 'profile';

interface VerifyPhoneOtpParams {
  phone?: string;
  /** login = passwordless sign-in, signup/profile = confirm a phone on an account. */
  mode?: OtpMode;
  /** When set, a successful verification also saves the pending profile edit. */
  pendingUserId?: string;
  pendingFullName?: string;
  pendingPhone?: string;
}

export const VerifyPhoneOtpScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const params: VerifyPhoneOtpParams = route.params ?? {};
  const phone = params.phone || '';
  const mode: OtpMode = params.mode ?? (params.pendingUserId ? 'profile' : 'login');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!code || code.length < 4) {
      Alert.alert('Invalid Code', 'Please enter a valid OTP code.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        // Passwordless sign-in: verifying the SMS code establishes the session.
        await authService.verifyPhoneLoginOtp(phone, code.trim());
        navigation.replace('Onboarding');
        return;
      }

      // signup/profile confirm a new number on the signed-in account without
      // replacing the existing session.
      await authService.confirmPhoneVerification(phone, code.trim());

      if (mode === 'profile') {
        const current = await authService.getCurrentSessionUser();
        const userId = params.pendingUserId ?? current?.id;
        if (!userId) {
          throw new Error('Your session expired. Please sign in again and retry.');
        }
        await authService.updateUserProfile(userId, {
          fullName: params.pendingFullName,
          phone: params.pendingPhone || phone,
        });
        Alert.alert('Saved', 'Your phone number has been verified and your profile updated.');
        navigation.goBack();
        return;
      }

      Alert.alert('Verified!', 'Your phone number has been verified successfully.');
      navigation.replace('Onboarding');
    } catch (e: any) {
      Alert.alert('Verification Failed', e?.message || 'That code is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, paddingTop: insets.top + 16 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
          <Ionicons name="shield-checkmark" size={36} color={colors.secondary} />
        </View>

        <Text style={[typography.headlineLarge, { color: colors.onSurface, marginTop: 20 }]}>
          Verify Phone OTP
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.subtext, textAlign: 'center', marginTop: 8 }]}>
          We sent a 6-digit verification code to {phone || 'your phone'}
        </Text>

        <TextInput
          style={[
            styles.otpInput,
            { color: colors.onSurface, backgroundColor: colors.cardBackground, borderColor: colors.divider },
          ]}
          placeholder="123456"
          placeholderTextColor={colors.subtext}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.secondary }]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
              Verify & Complete
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    marginTop: 40,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpInput: {
    width: '80%',
    height: 56,
    borderWidth: 1.5,
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    marginTop: 32,
  },
  primaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
});
