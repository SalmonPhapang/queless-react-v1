import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { authService } from '../../services/authService';
import { appConfig } from '../../config/appConfig';
import { User } from '../../models/user';
import { Header } from '../../components/Header';

interface EditProfileScreenProps {
  navigation: any;
}

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation }) => {
  const { colors, typography } = useTheme();

  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    const current = await authService.getCurrentSessionUser();
    setUser(current);
    setFullName(current?.fullName ?? '');
    setPhone(current?.phone ?? '');
  }, []);

  // Reload on focus so a phone number confirmed by OTP is reflected when the
  // verification screen pops back to this one.
  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Missing details', 'Please enter your full name');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Missing details', 'Please enter your phone number');
      return;
    }
    if (!user) {
      Alert.alert('Profile Error', 'Your session has expired. Please sign in again and try again.');
      return;
    }

    const normalizedPhone = appConfig.normalizePhoneNumber(phone);
    const currentPhone = user.phone ? appConfig.normalizePhoneNumber(user.phone) : '';
    const needsPhoneVerification =
      appConfig.features.phoneOtp && normalizedPhone !== currentPhone;

    setIsSaving(true);
    try {
      if (needsPhoneVerification) {
        // Confirm the new number on the account first; only write it to the
        // public profile after the code has been accepted.
        await authService.requestPhoneVerification(normalizedPhone);
        navigation.navigate('VerifyPhoneOtp', {
          phone: normalizedPhone,
          mode: 'profile',
          pendingUserId: user.id,
          pendingFullName: fullName.trim(),
          pendingPhone: normalizedPhone,
        });
        return;
      }

      await authService.updateUserProfile(user.id, {
        fullName: fullName.trim(),
        phone: normalizedPhone,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Update Failed', e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Edit Profile" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[typography.bodyLarge, { color: colors.subtext }]}>
          Keep your account details up to date.
        </Text>

        <Text style={[typography.labelMedium, styles.label, { color: colors.subtext }]}>
          FULL NAME
        </Text>
        <View style={[styles.inputRow, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Ionicons name="person-outline" size={18} color={colors.subtext} />
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            placeholderTextColor={colors.subtext}
            autoCapitalize="words"
          />
        </View>

        <Text style={[typography.labelMedium, styles.label, { color: colors.subtext }]}>
          EMAIL ADDRESS
        </Text>
        <View
          style={[
            styles.inputRow,
            { backgroundColor: colors.cardBackground, borderColor: colors.divider, opacity: 0.6 },
          ]}
        >
          <Ionicons name="mail-outline" size={18} color={colors.subtext} />
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            value={user?.email ?? ''}
            editable={false}
          />
        </View>

        <Text style={[typography.labelMedium, styles.label, { color: colors.subtext }]}>
          PHONE NUMBER
        </Text>
        <View style={[styles.inputRow, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}>
          <Ionicons name="call-outline" size={18} color={colors.subtext} />
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="082 000 0000"
            placeholderTextColor={colors.subtext}
            keyboardType="phone-pad"
          />
        </View>
        <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 6 }]}>
          {appConfig.features.phoneOtp
            ? 'We will text you a code to verify this number before saving.'
            : 'We use this number for delivery updates and driver contact.'}
        </Text>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.secondary }]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '800' }]}>
              Save Changes
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  label: {
    marginTop: 24,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
  },
  saveButton: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
});
