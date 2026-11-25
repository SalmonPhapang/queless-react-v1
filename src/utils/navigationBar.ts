import { Platform } from 'react-native';

type NavigationBarModule = typeof import('expo-navigation-bar');

let navigationBarModule: NavigationBarModule | null = null;

if (Platform.OS === 'android') {
  try {
    // Metro still bundles the module, but Expo Go and stale native clients do
    // not include the native class installed by the config plugin.
    navigationBarModule = require('expo-navigation-bar') as NavigationBarModule;
  } catch {
    navigationBarModule = null;
  }
}

/**
 * Declarative Android navigation bar override. Null when the native module is
 * unavailable, so callers can render nothing instead of crashing on startup.
 */
export const NavigationBarComponent = navigationBarModule?.NavigationBar ?? null;

/** Runtime re-hide for route transitions and app resume. Safe no-op on web/iOS. */
export function hideAndroidNavigationBar(): void {
  if (!navigationBarModule) return;
  try {
    navigationBarModule.NavigationBar.setHidden(true);
  } catch {
    // The native module disappeared after load; keep the app usable.
  }
}
