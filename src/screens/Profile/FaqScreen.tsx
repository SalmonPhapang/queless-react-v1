import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { Header } from '../../components/Header';

const FAQS = [
  {
    question: 'How long does delivery take?',
    answer:
      "Most deliveries are completed within 30-60 minutes depending on your location and the store's preparation time.",
  },
  {
    question: 'What are the delivery hours?',
    answer:
      'Delivery hours vary by store and are subject to South African liquor laws. Generally, alcohol delivery is available during legal trading hours.',
  },
  {
    question: 'Is there a minimum order amount?',
    answer: 'Yes, most stores have a minimum order amount of R150 to qualify for delivery.',
  },
  {
    question: 'How do I track my order?',
    answer:
      'Once your order is confirmed, you can track it in real-time from the "Active Orders" section on your dashboard or under the "Orders" tab.',
  },
  {
    question: 'What if my items are missing or damaged?',
    answer:
      'Please contact our support team immediately through the app or call our hotline. We will investigate and process a refund or replacement as needed.',
  },
  {
    question: 'Do I need to show my ID?',
    answer:
      'Yes, South African law requires us to verify that the recipient is 18 years or older. Our drivers will ask to see a valid South African ID or Passport upon delivery.',
  },
];

interface FaqScreenProps {
  navigation: any;
}

export const FaqScreen: React.FC<FaqScreenProps> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Help & FAQ" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {FAQS.map((faq) => {
          const isOpen = expanded === faq.question;
          return (
            <View
              key={faq.question}
              style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            >
              <TouchableOpacity
                style={styles.questionRow}
                onPress={() => setExpanded(isOpen ? null : faq.question)}
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
