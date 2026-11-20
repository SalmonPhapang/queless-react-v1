import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { authService } from '../../services/authService';

export const ResetPasswordScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(newPassword);
      Alert.alert('Success', 'Your password has been updated. Please sign in.', [
        { text: 'OK', onPress: () => navigation.replace('Login') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
      </TouchableOpacity>

      <Text style={[typography.headlineLarge, { color: colors.onSurface, marginTop: 24 }]}>
        Set New Password
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.subtext, marginTop: 6, marginBottom: 24 }]}>
        Type your new password below to reset your credentials.
      </Text>

      <View style={styles.form}>
        <Text style={[typography.labelMedium, { color: colors.onSurface, marginBottom: 6 }]}>
          New Password
        </Text>
        <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.subtext} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            placeholder="Minimum 6 characters"
            placeholderTextColor={colors.subtext}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>

        <Text style={[typography.labelMedium, { color: colors.onSurface, marginTop: 14, marginBottom: 6 }]}>
          Confirm New Password
        </Text>
        <View style={[styles.inputContainer, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.subtext} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            placeholder="Re-enter new password"
            placeholderTextColor={colors.subtext}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.secondary }]}
          onPress={handleUpdatePassword}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
              Update Password
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
});
