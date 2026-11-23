import { navigationRef, navigateFromOutside } from '../navigation/navigationRef';

export type NotificationTarget =
  | { screen: 'OrderTracking' | 'PayOrder'; params: { orderId: string } }
  | { screen: 'NotificationInbox' };

let pendingTarget: NotificationTarget | null = null;

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function targetForOrder(orderId: string, status: string): NotificationTarget {
  // Unpaid orders are paid from PayOrder; tracking is only for paid orders.
  return status.toLowerCase() === 'awaiting_payment'
    ? { screen: 'PayOrder', params: { orderId } }
    : { screen: 'OrderTracking', params: { orderId } };
}

/** Parse the query string used by push-sw.js and browser notification taps. */
export function parseNotificationUrl(url: string | null | undefined): NotificationTarget | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, 'http://localhost');
    const kind = parsed.searchParams.get('notification');
    if (!kind) return null;
    if (kind === 'order') {
      const orderId = firstString(
        parsed.searchParams.get('orderId'),
        parsed.searchParams.get('order_id'),
      );
      if (orderId) {
        return targetForOrder(orderId, parsed.searchParams.get('status') ?? '');
      }
    }
    return { screen: 'NotificationInbox' };
  } catch {
    return null;
  }
}

/** Parse the data attached to an Expo notification tap. */
export function parseNotificationData(
  data: Record<string, unknown> | null | undefined,
): NotificationTarget | null {
  if (!data) return null;

  const fromUrl = parseNotificationUrl(firstString(data.url));
  if (fromUrl) return fromUrl;

  const orderId = firstString(data.order_id, data.orderId);
  if (orderId) return targetForOrder(orderId, firstString(data.status));

  const type = firstString(data.type, data.event);
  if (!type && !firstString(data.title, data.body)) return null;
  return { screen: 'NotificationInbox' };
}

function deliver(target: NotificationTarget): void {
  if (!navigationRef.isReady()) {
    pendingTarget = target;
    return;
  }
  if (target.screen === 'NotificationInbox') {
    navigateFromOutside('NotificationInbox');
  } else {
    navigateFromOutside(target.screen, target.params);
  }
}

export function handleNotificationUrl(url: string | null | undefined): void {
  const target = parseNotificationUrl(url);
  if (target) deliver(target);
}

export function handleNotificationData(data: Record<string, unknown> | null | undefined): void {
  const target = parseNotificationData(data);
  if (target) deliver(target);
}

/** Web cold start: `/?notification=order&orderId=...` arrives as the page URL. */
export function handleCurrentNotificationUrl(): void {
  if (typeof window === 'undefined') return;
  const target = parseNotificationUrl(window.location.href);
  if (!target) return;
  deliver(target);

  // Remove the one-shot parameters so a refresh does not reopen the screen.
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('notification');
    url.searchParams.delete('orderId');
    url.searchParams.delete('order_id');
    url.searchParams.delete('status');
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    // Layout navigation is best-effort; the queued target still works.
  }
}

/** Called from NavigationContainer.onReady after a cold-start notification. */
export function flushPendingNotificationTap(): void {
  if (!navigationRef.isReady() || !pendingTarget) return;
  const target = pendingTarget;
  pendingTarget = null;
  deliver(target);
}
