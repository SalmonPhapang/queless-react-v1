import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../config/supabaseClient';
import { subscribeToWebPush, unsubscribeFromWebPush } from './webPushService';

const ORDER_CHANNEL_ID = 'order-updates';

const isAuthorized = (status: Notifications.NotificationPermissionsStatus): boolean =>
  status.granted ||
  status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

/**
 * Flutter's PermissionRequestScreen asks for location and notifications before
 * entering MainScreen. This is the React Native equivalent: create the Android
 * channel first (Android 13 will not prompt without one), then ask only when
 * permission has not already been granted.
 */
export const notificationPermissionService = {
  async hasPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return typeof Notification !== 'undefined' && Notification.permission === 'granted';
    }
    try {
      return isAuthorized(await Notifications.getPermissionsAsync());
    } catch (error) {
      console.warn('Could not read notification permission:', error);
      return false;
    }
  },

  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return subscribeToWebPush();

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(ORDER_CHANNEL_ID, {
          name: 'Order updates',
          description: 'Delivery progress and driver arrival updates',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#D13540',
        });
      }

      const existing = await Notifications.getPermissionsAsync();
      if (isAuthorized(existing)) return true;

      const result = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      return isAuthorized(result);
    } catch (error) {
      console.warn('Could not request notification permission:', error);
      return false;
    }
  },

  /**
   * Called BEFORE signOut so RLS still sees the authenticated user and the
   * delivery instruments are removed from the database as well as the device.
   */
  async revoke(): Promise<void> {
    if (Platform.OS === 'web') {
      await unsubscribeFromWebPush();
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase
      .from('user_fcm_tokens')
      .delete()
      .eq('user_id', data.user.id)
      .eq('provider', 'expo');
    if (error) console.warn('Could not remove Expo push token:', error.message);
  },
};
