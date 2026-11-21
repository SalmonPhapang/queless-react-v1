import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { Header } from '../../components/Header';
import { Skeleton } from '../../components/Skeleton';
import { supportService, SupportTicket } from '../../services/supportService';
import { SUPPORT_TOPIC_LABELS, type SupportTopic } from '../../utils/supportChat';

const statusLabel = (status: SupportTicket['status']) => {
  switch (status) {
    case 'pending':
      return 'In review';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    default:
      return 'Open';
  }
};

export const SupportTicketsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    try {
      setTickets(await supportService.listSupportTickets());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="My support tickets" showBack onBackPress={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.listContent}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            >
              <Skeleton width="70%" height={16} borderRadius={6} style={{ marginBottom: 8 }} />
              <Skeleton width="100%" height={14} borderRadius={6} style={{ marginBottom: 6 }} />
              <Skeleton width="45%" height={12} borderRadius={6} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              colors={[colors.secondary]}
            />
          }
          ListHeaderComponent={
            tickets.length > 0 ? (
              <Text style={[typography.bodySmall, { color: colors.subtext, marginBottom: 12 }]}>
                Human teammates review these in the app. Q is a virtual assistant and cannot change an order or issue a refund from here.
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => {
            const isOpen = expanded === item.id;
            const category = SUPPORT_TOPIC_LABELS[item.category as SupportTopic] ?? 'Support';
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
                onPress={() => setExpanded(isOpen ? null : item.id)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.statusPill, { backgroundColor: colors.primaryContainer }]}>
                    <Text style={[typography.labelSmall, { color: colors.secondary, fontWeight: '700' }]}>
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                  <Text style={[typography.labelSmall, { color: colors.subtext }]}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                <Text style={[typography.titleSmall, { color: colors.onSurface, fontWeight: '700', marginTop: 10 }]}>
                  {item.subject}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4 }]}>
                  {category} · Ticket #{item.id.substring(0, 8).toUpperCase()}
                </Text>

                {isOpen ? (
                  <View style={[styles.detail, { borderTopColor: colors.divider }]}>
                    <Text style={[typography.bodySmall, { color: colors.onSurface, lineHeight: 20 }]}>
                      {item.description}
                    </Text>
                    {item.messages.map((message) => (
                      <View key={message.id} style={[styles.message, { backgroundColor: colors.surface }]}>
                        <Text style={[typography.labelSmall, { color: colors.secondary, fontWeight: '700' }]}>
                          {message.authorRole === 'customer'
                            ? 'You'
                            : message.authorRole === 'support_agent'
                              ? 'Support teammate'
                              : message.authorRole === 'assistant'
                                ? 'Q'
                                : 'System'}
                        </Text>
                        <Text style={[typography.bodySmall, { color: colors.onSurface, marginTop: 3 }]}>
                          {message.body}
                        </Text>
                      </View>
                    ))}
                    {item.orderId ? (
                      <TouchableOpacity
                        style={[styles.orderButton, { backgroundColor: colors.secondary }]}
                        onPress={() => navigation.navigate('OrderTracking', { orderId: item.orderId })}
                      >
                        <Ionicons name="receipt-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={[typography.titleSmall, { color: '#FFFFFF' }]}>View linked order</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="ticket-outline" size={48} color={colors.subtext} />
              <Text style={[typography.titleMedium, { color: colors.onSurface, marginTop: 12 }]}>
                No support tickets yet
              </Text>
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 6, textAlign: 'center' }]}>
                Ask Q about an order, delivery or payment, then create a ticket when you need a human teammate.
              </Text>
              <TouchableOpacity
                style={[styles.askButton, { backgroundColor: colors.secondary, marginTop: 18 }]}
                onPress={() => navigation.navigate('QAiChat')}
              >
                {refreshing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[typography.titleSmall, { color: '#FFFFFF' }]}>Ask Q</Text>}
              </TouchableOpacity>
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
    paddingBottom: 32,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  detail: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  message: {
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
    paddingHorizontal: 24,
  },
  askButton: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 22,
  },
});
