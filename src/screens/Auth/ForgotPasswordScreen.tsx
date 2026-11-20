import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { authService } from '../../services/authService';

export const ForgotPasswordScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetRequest = async () => {
    if (!email) {
      Alert.alert('Required', 'Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      await authService.sendPasswordResetEmail(email.trim());
      Alert.alert(
        'Check Your Email',
        'Password reset link has been sent to your email.',
        [{ text: 'OK', onPress: () => navigation.navigate('ResetPassword', { email }) }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
      </TouchableOpacity>

      <View style={styles.headerBox}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
          <Ionicons name="key" size={32} color={colors.secondary} />
        </View>
        <Text style={[typography.headlineLarge, { color: colors.onSurface, marginTop: 16 }]}>
          Forgot Password?
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.subtext, textAlign: 'center', marginTop: 8 }]}>
          Enter your registered email address to receive password recovery instructions.
        </Text>
      </View>

      <View style={styles.form}>
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

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleResetRequest}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[typography.titleMedium, { color: colors.onPrimary, fontWeight: '700' }]}>
              Send Instructions
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
    paddingTop: 50,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerBox: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 24,
  },
});
