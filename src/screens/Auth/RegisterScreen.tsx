import React, { useState } from 'react';
import {
  View,
  Text,
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

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !phone || !password) {
      Alert.alert('Missing Fields', 'Please fill in all details.');
      return;
    }

    setLoading(true);
    try {
      const normalizedPhone = appConfig.normalizePhoneNumber(phone.trim());
      await authService.signUp(email.trim(), password, fullName.trim(), normalizedPhone);

      // Phone OTP is opt-in while SMS delivery is not configured. The OTP
      // confirms the phone on the account that was just created.
      if (appConfig.features.phoneOtp) {
        try {
          await authService.requestPhoneVerification(normalizedPhone);
          navigation.navigate('VerifyPhoneOtp', {
            phone: normalizedPhone,
            mode: 'signup',
          });
        } catch {
          Alert.alert(
            'Verify later',
            'Your account was created, but we could not send the SMS code. You can verify your number in Edit Profile.'
          );
          navigation.replace('Onboarding');
        }
      } else {
        navigation.replace('Onboarding');
      }
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message || 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>

        <Text style={[typography.headlineLarge, { color: colors.onSurface, marginTop: 12 }]}>
          Create Account
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.subtext, marginTop: 4, marginBottom: 28 }]}>
          Sign up to explore nearby restaurants & stores
        </Text>

        <View style={styles.form}>
          <Text style={[typography.labelMedium, { color: colors.onSurface, marginBottom: 6 }]}>
            Full Name
          </Text>
          <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <Ionicons name="person-outline" size={20} color={colors.subtext} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.onSurface }]}
              placeholder="John Doe"
              placeholderTextColor={colors.subtext}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <Text style={[typography.labelMedium, { color: colors.onSurface, marginTop: 14, marginBottom: 6 }]}>
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

          <Text style={[typography.labelMedium, { color: colors.onSurface, marginTop: 14, marginBottom: 6 }]}>
            Phone Number (South Africa)
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

          <Text style={[typography.labelMedium, { color: colors.onSurface, marginTop: 14, marginBottom: 6 }]}>
            Password
          </Text>
          <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.subtext} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.onSurface }]}
              placeholder="Minimum 6 characters"
              placeholderTextColor={colors.subtext}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.secondary }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
                Continue
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={[typography.bodyMedium, { color: colors.subtext }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[typography.titleSmall, { color: colors.secondary, fontWeight: '700' }]}>
                Sign In
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
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
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
  primaryButton: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
});
