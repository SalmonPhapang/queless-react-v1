import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null = null;

if (Platform.OS !== 'web') {
  try {
    // expo-notifications eagerly imports expo-application. Stale Expo Go
    // clients and development builds without the native modules cannot load
    // it, so keep the failure local instead of crashing the whole app at
    // import time.
    notificationsModule = require('expo-notifications') as NotificationsModule;
  } catch (error) {
    console.warn('[notifications] Native module unavailable; push disabled:', error);
    notificationsModule = null;
  }
}

/** Null when the native notification modules are unavailable (e.g. Expo Go). */
export function getNotificationsModule(): NotificationsModule | null {
  return notificationsModule;
}
