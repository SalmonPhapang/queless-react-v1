import { Platform } from 'react-native';
import { appConfig } from '../config/appConfig';
import { supabase } from '../config/supabaseClient';

/**
 * Browser Web Push for the React PWA.
 *
 * Native builds use Expo Push tokens. Browsers cannot use those tokens, so a
 * standard PushSubscription is created with the VAPID public key and stored in
 * `web_push_subscriptions`. The matching private key is only available to the
 * Supabase Edge Functions that send notifications.
 */

type StoredSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

export type WebPushMessage =
  | { type: 'push-received' }
  | { type: 'notification-tap'; url?: string };

const WEB_PUSH_ENDPOINT_KEY = 'queless_web_push_endpoint';

const isBrowser = () => Platform.OS === 'web' && typeof window !== 'undefined';

export function isWebPushSupported(): boolean {
  return (
    isBrowser() &&
    appConfig.push.webEnabled &&
    Boolean(appConfig.push.webPublicKey) &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isBrowser() || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
  } catch (error) {
    console.warn('Web push service worker registration failed:', error);
    return null;
  }
}

async function currentRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isBrowser() || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return registerWorker();
  }
}

async function saveSubscription(subscription: StoredSubscription): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return;

  const { error: saveError } = await supabase.from('web_push_subscriptions').upsert(
    {
      user_id: data.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      expiration_time: subscription.expirationTime ?? null,
      app_id: appConfig.push.appId,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  if (saveError) {
    console.warn('Could not save web push subscription:', saveError.message);
    return;
  }
  try {
    window.localStorage.setItem(WEB_PUSH_ENDPOINT_KEY, subscription.endpoint);
  } catch {
    // Storage can be disabled; the browser subscription is still authoritative.
  }
}

function toStored(subscription: PushSubscription): StoredSubscription | null {
  const json = subscription.toJSON() as StoredSubscription;
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return json;
}

/** Subscribe after an explicit user action (the onboarding prompt). */
export async function subscribeToWebPush(): Promise<boolean> {
  if (!isWebPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await registerWorker();
    if (!registration) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(appConfig.push.webPublicKey),
      });
    }

    const stored = toStored(subscription);
    if (!stored) return false;
    await saveSubscription(stored);
    return true;
  } catch (error) {
    console.warn('Web push subscription failed:', error);
    return false;
  }
}

/** Reuse an existing browser permission; never prompts on app startup. */
export async function syncWebPushSubscription(): Promise<void> {
  if (!isWebPushSupported() || Notification.permission !== 'granted') return;

  const registration = await currentRegistration();
  if (!registration) return;

  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const stored = toStored(subscription);
      if (stored) await saveSubscription(stored);
      return;
    }
    // Permission was granted previously but the subscription vanished. Reuse
    // it silently rather than prompting again.
    await subscribeToWebPush();
  } catch (error) {
    console.warn('Could not sync web push subscription:', error);
  }
}

/** Remove this browser's subscription and only its saved row. */
export async function unsubscribeFromWebPush(userId?: string): Promise<void> {
  if (!isBrowser() || !('serviceWorker' in navigator)) return;

  const { data } = await supabase.auth.getUser();
  const ownerId = userId || data.user?.id;
  if (!ownerId) return;

  let endpoint: string | null = null;
  try {
    const registration = await currentRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    endpoint = subscription?.endpoint ?? null;
    await subscription?.unsubscribe();
  } catch (error) {
    console.warn('Could not remove web push subscription:', error);
  }

  if (!endpoint) {
    try {
      endpoint = window.localStorage.getItem(WEB_PUSH_ENDPOINT_KEY);
    } catch {
      // Fall through: without an endpoint we must not issue a broad delete.
    }
  }
  if (!endpoint) return;

  const { error } = await supabase
    .from('web_push_subscriptions')
    .delete()
    .eq('user_id', ownerId)
    .eq('endpoint', endpoint)
    .eq('app_id', appConfig.push.appId);
  if (error) console.warn('Could not delete web push subscription row:', error.message);

  try {
    window.localStorage.removeItem(WEB_PUSH_ENDPOINT_KEY);
  } catch {
    // Best effort only.
  }
}

/** Messages posted by push-sw.js to the open app tab. */
export function onWebPushMessage(listener: (message: WebPushMessage) => void): () => void {
  if (!isBrowser() || !('serviceWorker' in navigator)) return () => undefined;
  const handler = (event: MessageEvent) => {
    const message = event.data as WebPushMessage | null;
    if (message?.type === 'push-received' || message?.type === 'notification-tap') {
      listener(message);
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
