import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { authService } from '../../services/authService';

export const AgeVerificationScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleConfirmAge = async () => {
    setLoading(true);
    try {
      const user = await authService.getCurrentSessionUser();
      if (user) {
        await authService.verifyAge(user.id);
      }
      Alert.alert('Verified', 'Age verification complete. You can now browse alcohol items.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Age verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={24} color={colors.onSurface} />
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={[styles.badgeCircle, { backgroundColor: '#7C3AED' }]}>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900' }}>18+</Text>
        </View>

        <Text style={[typography.headlineLarge, { color: colors.onSurface, marginTop: 20, textAlign: 'center' }]}>
          Age Verification
        </Text>

        <Text style={[typography.bodyMedium, { color: colors.subtext, textAlign: 'center', marginTop: 10, lineHeight: 22 }]}>
          In compliance with South African liquor laws, alcohol deliveries are strictly restricted to customers aged 18 and older.
        </Text>

        <View style={[styles.policyBox, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.secondary} style={{ marginRight: 10 }} />
          <Text style={[typography.bodySmall, { color: colors.onSurface, flex: 1 }]}>
            You will be asked to present a valid South African ID or Passport upon delivery.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
          onPress={handleConfirmAge}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[typography.titleMedium, { color: colors.onPrimary, fontWeight: '700' }]}>
              I am 18 or Older
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={[typography.labelMedium, { color: colors.subtext }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 8,
  },
  card: {
    alignItems: 'center',
  },
  badgeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  policyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    marginBottom: 24,
  },
  confirmBtn: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    marginTop: 16,
    padding: 8,
  },
});
