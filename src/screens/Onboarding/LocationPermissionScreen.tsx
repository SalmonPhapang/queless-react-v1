import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/theme';
import { locationService } from '../../services/locationService';
import { notificationPermissionService } from '../../services/notificationPermissionService';
import { authService } from '../../services/authService';
import { appConfig } from '../../config/appConfig';

// Native push stays behind its feature flag. Browser push is available on web
// independently, so the PWA gets its own tile and prompt as well.
const notificationsEnabled =
  appConfig.enableNotifications || (Platform.OS === 'web' && appConfig.push.webEnabled);

type PermissionKind = 'location' | 'notifications';

/**
 * Port of Flutter's PermissionRequestScreen: one screen, one tile per
 * permission, one OS prompt per tap, and Continue only once every shown
 * permission is granted. The two prompts are never fired from a single tap.
 */
export const LocationPermissionScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const [checking, setChecking] = useState(true);
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(!notificationsEnabled);
  const [requesting, setRequesting] = useState<PermissionKind | null>(null);

  const bothGranted = useCallback(
    (location: boolean, notifications: boolean) => location && notifications,
    []
  );

  const continueToApp = useCallback(async () => {
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
  }, [navigation]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const location = await locationService.hasPermission();
        const notifications = notificationsEnabled
          ? await notificationPermissionService.hasPermission()
          : true;
        if (!active) return;
        setLocationGranted(location);
        setNotificationsGranted(notifications);
        setChecking(false);
        // Flutter skips the screen entirely when both are already granted.
        if (bothGranted(location, notifications)) await continueToApp();
      } catch (error) {
        console.warn('Could not check permissions:', error);
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [bothGranted, continueToApp]);

  const request = async (kind: PermissionKind) => {
    setRequesting(kind);
    try {
      const granted =
        kind === 'location'
          ? await locationService.requestPermission()
          : await notificationPermissionService.requestPermission();

      const nextLocation = kind === 'location' ? granted : locationGranted;
      const nextNotifications = kind === 'notifications' ? granted : notificationsGranted;
      if (kind === 'location') setLocationGranted(granted);
      else setNotificationsGranted(granted);

      // Each tile asks on its own. Only when both are granted do we move on.
      if (bothGranted(nextLocation, nextNotifications)) await continueToApp();
    } finally {
      setRequesting(null);
    }
  };

  const tile = (
    icon: React.ComponentProps<typeof Ionicons>['name'],
    title: string,
    description: string,
    granted: boolean,
    kind: PermissionKind
  ) => (
    <View style={[styles.tile, { backgroundColor: colors.primaryContainer }]}>
      <View style={[styles.tileIcon, { backgroundColor: colors.surface }]}>
        <Ionicons name={icon} size={22} color={colors.secondary} />
      </View>
      <View style={styles.tileText}>
        <Text style={[typography.titleSmall, { color: colors.onSurface }]}>{title}</Text>
        <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 3, lineHeight: 17 }]}>
          {description}
        </Text>
        {!granted && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void request(kind)}
            disabled={requesting !== null}
            activeOpacity={0.8}
          >
            <Text style={[typography.labelLarge, { color: colors.secondary, marginTop: 10 }]}>
              {requesting === kind ? 'Requesting…' : 'Allow Access'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {granted && <Ionicons name="checkmark-circle" size={24} color={colors.success} />}
    </View>
  );

  if (checking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <ActivityIndicator color={colors.secondary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[typography.headlineMedium, styles.title, { color: colors.onSurface }]}>
        Help us serve you better
      </Text>
      <Text style={[typography.bodyMedium, styles.subtitle, { color: colors.subtext }]}>
        To provide the best delivery experience, we need a few permissions.
      </Text>

      <View style={styles.tiles}>
        {tile(
          'location-outline',
          'Location Access',
          'We use your location to find nearby stores and track your delivery in real-time.',
          locationGranted,
          'location'
        )}
        {notificationsEnabled &&
          tile(
            'notifications-outline',
            'Notifications',
            'Stay updated on your order status, driver arrival, and exclusive local deals.',
            notificationsGranted,
            'notifications'
          )}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        style={[
          styles.primaryBtn,
          {
            backgroundColor: colors.secondary,
            opacity: bothGranted(locationGranted, notificationsGranted) ? 1 : 0.45,
          },
        ]}
        onPress={() => void continueToApp()}
        disabled={!bothGranted(locationGranted, notificationsGranted) || requesting !== null}
        activeOpacity={0.85}
      >
        <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '800' }]}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.skipBtn}
        onPress={() => void continueToApp()}
        disabled={requesting !== null}
        activeOpacity={0.7}
      >
        <Text style={[typography.bodyMedium, { color: colors.subtext }]}>Not now</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: 10, lineHeight: 22 },
  tiles: { marginTop: 32, gap: 14 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  tileIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileText: { flex: 1 },
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  skipBtn: { marginTop: 16, padding: 8, alignSelf: 'center' },
});
