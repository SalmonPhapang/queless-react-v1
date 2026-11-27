import { Platform } from 'react-native';
import { supabase } from '../config/supabaseClient';
import { getNotificationsModule } from '../utils/nativeNotifications';

export interface RealtimeNotificationRow {
  id: string;
  title: string;
  body: string;
  type: string;
  order_id?: string | null;
}

/**
 * The inbox is durable, but a row written while the app is open should refresh
 * the UI immediately. This mirrors the driver app's realtime bridge and also
 * gives non-push builds a visible order update fallback.
 */
export function startNotificationRealtime(
  userId: string,
  onInsert: (row: RealtimeNotificationRow) => void,
): () => void {
  const channel = supabase
    .channel(`customer-notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as Partial<RealtimeNotificationRow> | null;
        if (!row?.id) return;
        onInsert({
          id: row.id,
          title: row.title ?? 'Queless',
          body: row.body ?? '',
          type: row.type ?? 'order',
          order_id: row.order_id ?? null,
        });
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Only used when no Expo/Web Push instrument was registered for this user. */
export async function showLocalOrderNotification(
  row: RealtimeNotificationRow,
): Promise<void> {
  const notifications = getNotificationsModule();
  if (!notifications) return;

  try {
    await notifications.scheduleNotificationAsync({
      content: {
        title: row.title,
        body: row.body,
        sound: true,
        data: row.order_id
          ? { type: 'order_status', order_id: row.order_id }
          : { type: 'order_status' },
      },
      trigger: Platform.OS === 'android' ? { channelId: 'order-updates' } : null,
    });
  } catch (error) {
    console.warn('Could not show fallback order notification:', error);
  }
}
