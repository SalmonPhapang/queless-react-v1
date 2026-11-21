import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { Header } from '../../components/Header';
import { supportService, SupportArticle } from '../../services/supportService';

const FALLBACK_ARTICLES: SupportArticle[] = [
  {
    slug: 'delivery-time',
    category: 'delivery',
    question: 'How long does delivery take?',
    answer: 'Most deliveries are completed within 30-60 minutes, depending on your location and the store’s preparation time. You can follow live progress from the Orders tab.',
    updatedAt: '',
  },
  {
    slug: 'delivery-hours',
    category: 'delivery',
    question: 'What are the delivery hours?',
    answer: 'Delivery hours vary by store and follow South African liquor laws. Alcohol delivery is only available during legal trading hours, and the driver will check ID on arrival.',
    updatedAt: '',
  },
  {
    slug: 'minimum-order',
    category: 'general',
    question: 'Is there a minimum order amount?',
    answer: 'Most stores have a minimum order amount of R150 before delivery. The exact amount is shown on the store page before you check out.',
    updatedAt: '',
  },
  {
    slug: 'track-order',
    category: 'order_status',
    question: 'How do I track my order?',
    answer: 'Open the Orders tab and select the order to see live status and driver location. You can also tap “Track my order” in Ask Q.',
    updatedAt: '',
  },
  {
    slug: 'missing-or-damaged',
    category: 'delivery',
    question: 'What if my items are missing or damaged?',
    answer: 'Tell Q which order it was and choose Delivery. Q will open an in-app support ticket with the order details, and a human teammate will review what happened. Q cannot promise a refund or replacement itself.',
    updatedAt: '',
  },
  {
    slug: 'age-verification',
    category: 'delivery',
    question: 'Do I need to show my ID?',
    answer: 'Yes. South African law requires the recipient to be 18 or older for alcohol. Drivers ask for a valid South African ID or passport on delivery.',
    updatedAt: '',
  },
  {
    slug: 'refund-request',
    category: 'payment',
    question: 'How do I request a refund?',
    answer: 'Refund decisions are handled by a human teammate. Ask Q to open a support ticket with your order number and what went wrong; Q will not promise a refund or start one automatically.',
    updatedAt: '',
  },
];

interface FaqScreenProps {
  navigation: any;
}

export const FaqScreen: React.FC<FaqScreenProps> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const [articles, setArticles] = useState<SupportArticle[]>(FALLBACK_ARTICLES);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const remote = await supportService.listSupportArticles();
        if (active && remote.length > 0) setArticles(remote);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Help & FAQ" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={[styles.askCard, { backgroundColor: colors.primaryContainer, borderColor: colors.divider }]}
          onPress={() => navigation.navigate('QAiChat')}
          activeOpacity={0.85}
        >
          <View style={[styles.askAvatar, { backgroundColor: colors.secondary }]}>
            <Text style={styles.askAvatarText}>Q</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[typography.titleSmall, { color: colors.onSurface, fontWeight: '700' }]}>
              Ask Q for order help
            </Text>
            <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]}>
              Order status, delivery, payment and cancellation — with a ticket when you need a human.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.secondary} />
            <Text style={[typography.bodySmall, { color: colors.subtext, marginLeft: 8 }]}>Loading help centre…</Text>
          </View>
        ) : null}

        {articles.map((faq) => {
          const isOpen = expanded === faq.slug;
          return (
            <View
              key={faq.slug}
              style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            >
              <TouchableOpacity
                style={styles.questionRow}
                onPress={() => setExpanded(isOpen ? null : faq.slug)}
                activeOpacity={0.8}
              >
                <Text style={[typography.titleMedium, { color: colors.onSurface, flex: 1, fontWeight: '700' }]}>
                  {faq.question}
                </Text>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.subtext}
                />
              </TouchableOpacity>

              {isOpen && (
                <Text style={[typography.bodyMedium, styles.answer, { color: colors.subtext }]}>
                  {faq.answer}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  askCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  askAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  answer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    lineHeight: 22,
  },
});
