import { supabase } from '../config/supabaseClient';
import { UserNotification, userNotificationFromJson } from '../models/userNotification';

export const notificationInboxService = {
  async getUserNotifications(userId: string): Promise<UserNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Fetch Notifications Error:', error.message);
      return [];
    }
    if (!data) return [];

    return data.map((item) => userNotificationFromJson(item));
  },

  async markAsRead(notificationId: string): Promise<void> {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  },

  async markAllAsRead(userId: string): Promise<void> {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
  },
};
