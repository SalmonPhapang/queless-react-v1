import { supabase } from '../config/supabaseClient';
import { navigationRef } from '../navigation/navigationRef';

/**
 * A cold start delivers the initial URL before the navigator mounts. Without
 * queueing it, opening a recovery link from a closed app does nothing.
 */
let pendingUrl: string | null = null;

/**
 * Password recovery links come back as
 * com.queless.app://reset-password#access_token=...&refresh_token=...
 * (Supabase appends the session in the fragment). Without this the link opens
 * the app and nothing happens, so recovery is impossible.
 */
export async function handleAuthDeepLink(url: string | null): Promise<boolean> {
  if (!url) return false;
  if (!url.includes('reset-password') && !url.includes('type=recovery')) return false;

  if (!navigationRef.isReady()) {
    pendingUrl = url;
    return true;
  }

  const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
  const params = new URLSearchParams(fragment);

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const errorDescription = params.get('error_description');

  if (errorDescription) {
    console.warn('Password recovery link error:', errorDescription);
    return false;
  }

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      console.warn('Could not set recovery session:', error.message);
      return false;
    }
  }

  (navigationRef as any).navigate('Auth', { screen: 'ResetPassword' });
  return true;
}

/** Replays a link that arrived before the navigation container was ready. */
export async function flushPendingAuthDeepLink(): Promise<void> {
  const url = pendingUrl;
  pendingUrl = null;
  if (!url) return;
  await handleAuthDeepLink(url).catch((e) =>
    console.warn('Pending deep link failed', e)
  );
}
