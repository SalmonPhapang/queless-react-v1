import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { notificationInboxService } from '../../services/notificationInboxService';
import { authService } from '../../services/authService';
import { UserNotification } from '../../models/userNotification';
import { Header } from '../../components/Header';
import { Skeleton } from '../../components/Skeleton';

export const NotificationInboxScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();

  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    try {
      const user = await authService.getCurrentSessionUser();
      if (!user?.id) {
        setNotifications([]);
        return;
      }
      const data = await notificationInboxService.getUserNotifications(user.id);
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifs();
    setRefreshing(false);
  };

  const handleMarkRead = async (id: string) => {
    await notificationInboxService.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Notification Inbox" showBack onBackPress={() => navigation.goBack()} />

      {loading ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[styles.notifCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            >
              <Skeleton width={36} height={36} borderRadius={18} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Skeleton width="60%" height={16} borderRadius={6} style={{ marginBottom: 8 }} />
                <Skeleton width="90%" height={14} borderRadius={6} style={{ marginBottom: 6 }} />
                <Skeleton width="40%" height={12} borderRadius={6} />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.secondary]} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.notifCard,
              {
                backgroundColor: item.isRead ? colors.cardBackground : colors.primaryContainer,
                borderColor: colors.divider,
              },
            ]}
            onPress={() => handleMarkRead(item.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.secondary }]}>
              <Ionicons name="notifications" size={18} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.titleSmall, { color: colors.onSurface }]}>{item.title}</Text>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4 }]}>
                {item.body}
              </Text>
              <Text style={[typography.labelSmall, { color: colors.subtext, marginTop: 6 }]}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.secondary }]} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.subtext} />
            <Text style={[typography.titleMedium, { color: colors.onSurface, marginTop: 12 }]}>
              Inbox is empty
            </Text>
          </View>
        }
      />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  notifCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
});
