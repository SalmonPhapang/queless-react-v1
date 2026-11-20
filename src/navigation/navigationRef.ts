import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Navigate from outside React (deep links, notification taps). */
export function navigateFromOutside(
  name: keyof RootStackParamList,
  params?: Record<string, unknown>
): void {
  if (!navigationRef.isReady()) return;
  // React Navigation's overloads collapse to `never` for a generic route key.
  (navigationRef as any).navigate(name, params);
}
