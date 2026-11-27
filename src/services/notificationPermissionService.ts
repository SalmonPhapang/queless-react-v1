import type * as NotificationsTypes from 'expo-notifications';
import { Platform } from 'react-native';
import { appConfig } from '../config/appConfig';
import { supabase } from '../config/supabaseClient';
import { getNotificationsModule } from '../utils/nativeNotifications';
import { subscribeToWebPush, unsubscribeFromWebPush } from './webPushService';

const ORDER_CHANNEL_ID = 'order-updates';

const isAuthorized = (status: NotificationsTypes.NotificationPermissionsStatus): boolean => {
  const notifications = getNotificationsModule();
  return (
    status.granted ||
    (!!notifications && status.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL)
  );
};

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
    const notifications = getNotificationsModule();
    if (!notifications) return false;

    try {
      return isAuthorized(await notifications.getPermissionsAsync());
    } catch (error) {
      console.warn('Could not read notification permission:', error);
      return false;
    }
  },

  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return subscribeToWebPush();

    const notifications = getNotificationsModule();
    if (!notifications) return false;

    try {
      if (Platform.OS === 'android') {
        await notifications.setNotificationChannelAsync(ORDER_CHANNEL_ID, {
          name: 'Order updates',
          description: 'Delivery progress and driver arrival updates',
          importance: notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#D13540',
        });
      }

      const existing = await notifications.getPermissionsAsync();
      if (isAuthorized(existing)) return true;

      const result = await notifications.requestPermissionsAsync({
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
      .eq('provider', 'expo')
      // Admin/driver profiles can share a Supabase user id. Only remove the
      // customer audience so signing out of the customer app cannot revoke a
      // driver's delivery-alert token.
      .eq('app_id', appConfig.push.appId);
    if (error) console.warn('Could not remove Expo push token:', error.message);
  },
};
