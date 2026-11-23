import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/theme';
import { locationService } from '../../services/locationService';
import { notificationPermissionService } from '../../services/notificationPermissionService';
import { authService } from '../../services/authService';
import { appConfig } from '../../config/appConfig';

/**
 * Explains why Queless needs location and notifications before the OS prompts
 * appear. Asking cold on the first Home render is how apps get permanently
 * denied; this screen gives the customer context and a settings escape hatch.
 */
export const LocationPermissionScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const [busy, setBusy] = useState(false);
  // Native push stays behind its feature flag. Browser push is available on
  // web independently so the PWA can subscribe after the same prompt.
  const notificationsEnabled =
    appConfig.enableNotifications || (Platform.OS === 'web' && appConfig.push.webEnabled);

  const continueToApp = async () => {
    await AsyncStorage.setItem('location_prompt_seen', 'true');
    if (notificationsEnabled) {
      await AsyncStorage.setItem('notifications_prompt_seen', 'true');
    }
    const user = await authService.getCurrentSessionUser();
    if (user && !user.ageVerified) {
      navigation.replace('AgeVerification');
    } else {
      navigation.replace('MainTabs');
    }
  };

  const requestLocation = async () => {
    setBusy(true);
    try {
      const granted = await locationService.requestPermission();

      // Flutter's PermissionRequestScreen asks both before entering MainScreen.
      // Notification permission follows the location prompt so the two OS
      // dialogs never overlap.
      if (notificationsEnabled) {
        await notificationPermissionService.requestPermission();
      }

      if (!granted) {
        Alert.alert(
          'Location is off',
          'You can still browse, but nearby stores and delivery fees need your location. You can enable it later in Settings.',
          [
            { text: 'Continue', onPress: () => void continueToApp() },
            { text: 'Open settings', onPress: () => void locationService.openLocationSettings() },
          ]
        );
        return;
      }
      await continueToApp();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
        <Ionicons name="location-outline" size={56} color={colors.secondary} />
      </View>

      <Text style={[typography.headlineMedium, { color: colors.onSurface, textAlign: 'center', marginTop: 24 }]}>
        Help us serve you better
      </Text>
      <Text style={[typography.bodyMedium, { color: colors.subtext, textAlign: 'center', marginTop: 10, lineHeight: 22 }]}>
        Queless uses a couple of permissions to make every delivery accurate and on time.
      </Text>

      <View style={styles.permissionList}>
        <View style={styles.permissionRow}>
          <View style={[styles.permissionIcon, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="location-outline" size={22} color={colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.titleSmall, { color: colors.onSurface }]}>Location</Text>
            <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]}>
              Nearby stores and the correct delivery fee.
            </Text>
          </View>
        </View>

        {notificationsEnabled && (
          <View style={styles.permissionRow}>
            <View style={[styles.permissionIcon, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="notifications-outline" size={22} color={colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.titleSmall, { color: colors.onSurface }]}>Notifications</Text>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]}>
                Order status and driver arrival updates.
              </Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.secondary }]}
        onPress={() => void requestLocation()}
        disabled={busy}
        activeOpacity={0.85}
      >
        <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '800' }]}>
          {notificationsEnabled ? 'Allow location & notifications' : 'Allow location'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipBtn}
        onPress={() => void continueToApp()}
        activeOpacity={0.7}
      >
        <Text style={[typography.bodyMedium, { color: colors.subtext }]}>Not now</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionList: {
    alignSelf: 'stretch',
    marginTop: 32,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  skipBtn: { marginTop: 18, padding: 8 },
});
