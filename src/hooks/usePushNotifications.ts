import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { appConfig } from '../config/appConfig';
import { supabase } from '../config/supabaseClient';
import { emitPushReceived } from '../services/pushEvents';
import {
  onWebPushMessage,
  syncWebPushSubscription,
  unsubscribeFromWebPush,
} from '../services/webPushService';
import { handleNotificationData, handleNotificationUrl } from '../utils/notificationLinks';

const CUSTOMER_PUSH_TOKEN_KEY = 'queless_customer_push_token';

/**
 * Single owner of the notification lifecycle:
 *  - native: Expo Push token + foreground presentation + tap routing
 *  - web: browser PushSubscription sync + service-worker messages + tap routing
 *
 * Permission is asked once from LocationPermissionScreen. This hook never
 * prompts on startup, and it removes delivery instruments on sign-out.
 */

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

async function registerExpoToken(userId: string): Promise<void> {
  if (!appConfig.enableNotifications) return;
  try {
    const permission = await Notifications.getPermissionsAsync();
    const authorized =
      permission.granted ||
      permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!authorized) return;

    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId: appConfig.push.easProjectId,
    });
    if (!data) return;

    const { error } = await supabase.from('user_fcm_tokens').upsert(
      {
        user_id: userId,
        token: data,
        provider: 'expo',
        app_id: appConfig.push.appId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' },
    );
    if (error) {
      console.warn('Could not save Expo push token:', error.message);
      return;
    }
    await AsyncStorage.setItem(CUSTOMER_PUSH_TOKEN_KEY, data);
  } catch (error) {
    console.warn('Could not register Expo push token:', error);
  }
}

async function removeExpoToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  let token = await AsyncStorage.getItem(CUSTOMER_PUSH_TOKEN_KEY);
  if (!token && appConfig.enableNotifications) {
    // The cache can be missing after an app upgrade. Derive the same token
    // rather than falling back to a broad provider-wide delete.
    try {
      const { data } = await Notifications.getExpoPushTokenAsync({
        projectId: appConfig.push.easProjectId,
      });
      token = data || null;
    } catch (error) {
      console.warn('Could not derive Expo push token for removal:', error);
    }
  }

  if (token) {
    const { error } = await supabase
      .from('user_fcm_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token)
      .eq('provider', 'expo')
      .eq('app_id', appConfig.push.appId);
    if (error) console.warn('Could not remove Expo push token:', error.message);
  }

  await AsyncStorage.removeItem(CUSTOMER_PUSH_TOKEN_KEY);
}

export function usePushNotifications(): void {
  useEffect(() => {
    let disposed = false;
    let signedInUserId: string | null = null;
    const disposers: Array<() => void> = [];

    const syncForUser = (userId: string | null) => {
      if (disposed) return;
      signedInUserId = userId;
      if (!userId) return;
      if (Platform.OS === 'web') {
        void syncWebPushSubscription();
      } else {
        void registerExpoToken(userId);
      }
    };

    const revokeForUser = (userId: string | null) => {
      const id = userId || signedInUserId;
      signedInUserId = null;
      if (Platform.OS === 'web') {
        void unsubscribeFromWebPush(id ?? undefined);
      } else if (id) {
        void removeExpoToken(id);
      }
    };

    if (Platform.OS === 'web') {
      disposers.push(
        onWebPushMessage((message) => {
          if (message.type === 'push-received') emitPushReceived();
          if (message.type === 'notification-tap') handleNotificationUrl(message.url);
        }),
      );
    } else {
      const received = Notifications.addNotificationReceivedListener(() => emitPushReceived());
      disposers.push(() => received.remove());
      const response = Notifications.addNotificationResponseReceivedListener((event) => {
        handleNotificationData(event.notification.request.content.data);
      });
      disposers.push(() => response.remove());

      // A tap that launched the app can arrive before the listener above is
      // registered. Handle and clear the stored response once on startup.
      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse) {
        handleNotificationData(lastResponse.notification.request.content.data);
        Notifications.clearLastNotificationResponse();
      }
    }

    void supabase.auth.getUser().then(({ data }) => syncForUser(data.user?.id ?? null));

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        revokeForUser(session?.user?.id ?? null);
        return;
      }
      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        syncForUser(session?.user?.id ?? null);
      }
    });
    disposers.push(() => authListener.subscription.unsubscribe());

    return () => {
      disposed = true;
      disposers.forEach((dispose) => dispose());
    };
  }, []);
}
