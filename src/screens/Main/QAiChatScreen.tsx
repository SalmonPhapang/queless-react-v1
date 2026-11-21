import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import {
  aiChatService,
  ensureConversationId,
  QChatMessage,
  QChatSelectableOrder,
} from '../../services/aiChatService';
import { ProductCard } from '../../components/ProductCard';
import { addProductToCart } from '../../utils/cartActions';
import { cartService } from '../../services/cartService';
import { Product } from '../../models/product';
import { appConfig } from '../../config/appConfig';
import { authService } from '../../services/authService';
import { orderService } from '../../services/orderService';
import { supportService } from '../../services/supportService';
import { Order } from '../../models/order';
import { orderStatusHelpers, orderStatusMeta } from '../../models/statuses';
import {
  ASSISTANT_DISCLOSURE,
  ASSISTANT_NAME,
  ASSISTANT_PRESENCE,
  ASSISTANT_ROLE,
  buildFaqReply,
  buildTicketDescription,
  buildTicketSubject,
  detectShoppingIntent,
  detectSupportTopic,
  GENERAL_SUGGESTIONS,
  HUMAN_HANDOFF_REPLY,
  normalizeSupportText,
  orderLabel,
  replyForTopic,
  statusLabel,
  SUPPORT_ISSUE_OPTIONS,
  SUPPORT_TOPIC_LABELS,
  supportCategoryFromIssueLabel,
  type SupportTopic,
} from '../../utils/supportChat';

export const QAiChatScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const listRef = useRef<FlatList<QChatMessage>>(null);

  const [messages, setMessages] = useState<QChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: ASSISTANT_DISCLOSURE,
      timestamp: new Date().toISOString(),
      suggestions: GENERAL_SUGGESTIONS,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [ticketBusy, setTicketBusy] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      await cartService.initCart();
      const updateCount = (cart: { items?: { quantity: number }[] } | null) => {
        const count = (cart?.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
        setCartItemCount(count);
      };
      updateCount(cartService.getCartSync() as any);
      unsubscribe = cartService.subscribe((cart) => updateCount(cart as any));
    })();
    return () => {
      unsubscribe?.();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const FILTER_OPTIONS = [
    'Halal',
    'Vegetarian',
    'Vegan',
    'Gluten-free',
    'Spicy',
    'Healthy',
    'Under R100',
    'Under R150',
    'Dessert',
    'Drinks',
  ];

  const scrollToLatestMessage = (animated = true) => {
    if (messages.length === 0) return;
    const index = messages.length - 1;
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({ index, animated, viewPosition: 0, viewOffset: 8 });
      } catch {
        listRef.current?.scrollToEnd({ animated });
      }
    });
  };

  useEffect(() => {
    scrollToLatestMessage(true);
  }, [messages.length, loading, ticketBusy]);

  const renderFormattedMessageText = (text: string, baseColor: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0);
    if (parts.length <= 1 && !text.includes('**')) {
      return text;
    }
    return parts.map((part, idx) => {
      const isBold = part.startsWith('**') && part.endsWith('**') && part.length >= 4;
      const content = isBold ? part.slice(2, -2) : part;
      return (
        <Text
          key={`${idx}-${content.slice(0, 12)}`}
          style={isBold ? { fontWeight: '700', color: baseColor } : undefined}
        >
          {content}
        </Text>
      );
    });
  };

  const toSelectableOrder = (order: Order): QChatSelectableOrder => ({
    id: order.id,
    orderNumber: order.orderNumber || order.id.substring(0, 8).toUpperCase(),
    storeName: order.storeName || 'Store',
    status: order.status,
    statusLabel: orderStatusMeta[order.status]?.displayName || order.status,
    total: order.total,
    createdAt: order.createdAt,
  });

  const getCurrentUserOrders = async (): Promise<Order[] | null> => {
    const user = await authService.getCurrentSessionUser();
    if (!user?.id) return null;
    return orderService.getUserOrders(user.id);
  };

  const isRecent = (order: Order) => {
    const t = new Date(order.createdAt).getTime();
    return Number.isFinite(t) ? t >= Date.now() - 7 * 24 * 60 * 60 * 1000 : false;
  };

  const buildTopicReply = (topic: SupportTopic, orders: Order[]): QChatMessage => {
    const active = orders.filter((o) => !orderStatusHelpers.isTerminal(o.status));
    const recent = orders.filter(isRecent);
    const source = topic === 'order_status' || topic === 'delivery' ? active : recent;
    const visible = source.slice(0, 6);
    const id = `msg_${Date.now()}`;

    if (visible.length === 0) {
      return {
        id,
        sender: 'assistant',
        text:
          topic === 'order_status' || topic === 'delivery'
            ? "You don't have an active order right now. If you placed one recently, it may take a moment to appear — or I can open a ticket so a teammate can check."
            : "I couldn't find an order from the last 7 days. Tell me a bit more and I can still open a support ticket for you.",
        timestamp: new Date().toISOString(),
        suggestions: ['🙋 Speak to a human', '📚 Delivery & payment FAQs', '📦 Track my order'],
      };
    }

    const lines = visible.map((order) => {
      const prefix = `• ${orderLabel(order)} — **${statusLabel(order)}**`;
      if (topic === 'payment') return `${prefix} · payment ${order.paymentStatus ?? 'pending'}`;
      if (topic === 'delivery' && order.driver?.name) return `${prefix} · driver ${order.driver.name}`;
      return `${prefix} · ${appConfig.formatCurrency(order.total)}`;
    });

    const intro: Record<SupportTopic, string> = {
      order_status: "Here's what I can see for your active orders:",
      delivery:
        "Here's the latest I have for delivery. Open tracking for live movement — if something looks wrong, pick the order and I'll open a ticket.",
      payment:
        "I can see your recent payment states. I won't guess at bank or card details — pick the order and I'll help or open a ticket.",
      cancellation:
        "I can check whether an order looks cancellable, but I won't change it without your go-ahead. Pick the order below.",
      other:
        "I can bring in a human teammate. Pick the order this is about, or add more detail below and I'll open a ticket.",
    };

    return {
      id,
      sender: 'assistant',
      text: `${intro[topic]}\n${lines.join('\n')}`,
      timestamp: new Date().toISOString(),
      trackActions:
        topic === 'order_status' || topic === 'delivery'
          ? visible.map((o) => ({
              label: `Track #${o.orderNumber || o.id.substring(0, 8).toUpperCase()}`,
              orderId: o.id,
            }))
          : undefined,
      selectableOrders: visible.map(toSelectableOrder),
      suggestedAction: { type: 'view_order', payload: { supportTopic: topic } },
      suggestions: ['📚 Delivery & payment FAQs', '🙋 Speak to a human', '📦 Track my order'],
    };
  };

  const handleSelectIssueOrder = (order: QChatSelectableOrder, topic: SupportTopic = 'other') => {
    const userMsg: QChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: `Help with order #${order.orderNumber} (${order.storeName})`,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: QChatMessage = {
      id: `msg_${Date.now() + 1}`,
      sender: 'assistant',
      text: `What's going on with order #${order.orderNumber} from ${order.storeName}? Choose one option below, then add any detail and tap **Create support ticket**. I'm a virtual assistant; a human teammate will review the ticket.`,
      timestamp: new Date().toISOString(),
      issueOptions: SUPPORT_ISSUE_OPTIONS,
      suggestedAction: {
        type: 'view_order',
        payload: { issueOrder: order, supportTopic: topic },
      },
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  };

  const handleSelectIssueType = (
    issue: string,
    order: QChatSelectableOrder,
    contextTopic: SupportTopic
  ) => {
    const category = supportCategoryFromIssueLabel(issue);
    setMessages((prev) => [
      ...prev,
      {
        id: `usr_${Date.now()}`,
        sender: 'user',
        text: `${SUPPORT_TOPIC_LABELS[category]} · #${order.orderNumber}`,
        timestamp: new Date().toISOString(),
      },
      {
        id: `msg_${Date.now() + 1}`,
        sender: 'assistant',
        text: `Thanks — I've noted **${SUPPORT_TOPIC_LABELS[category]}** for order #${order.orderNumber}. Tell me a bit more below, then tap **Create support ticket**. A human teammate will pick it up from there.`,
        timestamp: new Date().toISOString(),
        supportDraft: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          storeName: order.storeName,
          issue,
          category: contextTopic === 'other' ? category : contextTopic,
          details: '',
        },
        trackActions: [{ label: `View order #${order.orderNumber}`, orderId: order.id }],
        suggestions: ['📚 Delivery & payment FAQs', '📦 Track my order', '🙋 Speak to a human'],
      },
    ]);
  };

  const findLatestIssueDraft = (): number => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const draft = messages[i].supportDraft;
      if (draft && !draft.ticketId) return i;
    }
    return -1;
  };

  const handleSupportIntent = async (topic: SupportTopic) => {
    setLoading(true);
    try {
      const orders = await getCurrentUserOrders();
      if (orders === null) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}`,
            sender: 'assistant',
            text: 'Please sign in to check your orders or open a support ticket. You can sign in from the Profile tab.',
            timestamp: new Date().toISOString(),
            suggestions: ['📚 Delivery & payment FAQs', '🙋 Speak to a human'],
          },
        ]);
        return;
      }
      setMessages((prev) => [...prev, buildTopicReply(topic, orders)]);
    } catch (e) {
      console.warn('Order support flow error:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          sender: 'assistant',
          text: "I couldn't load your orders right now. Please check your connection and try again — or tell me more and I'll still open a ticket.",
          timestamp: new Date().toISOString(),
          suggestions: ['🙋 Speak to a human', '📦 Track my order'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleHumanHandoff = () => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: HUMAN_HANDOFF_REPLY,
        timestamp: new Date().toISOString(),
        suggestions: ['📦 Track my order', '💳 Payment question', '🛵 Delivery help'],
      },
    ]);
    void handleSupportIntent('other');
  };

  const handleCreateTicket = async (draftIndex: number) => {
    const draft = messages[draftIndex]?.supportDraft;
    if (!draft || ticketBusy) return;
    setTicketBusy(true);
    try {
      const orders = await getCurrentUserOrders();
      const order = orders?.find((o) => o.id === draft.orderId) ?? null;
      const conversationId = await ensureConversationId();
      const ticket = await supportService.createSupportTicket({
        orderId: draft.orderId ?? null,
        conversationId,
        category: draft.category,
        subject: buildTicketSubject(draft.category, order),
        description: buildTicketDescription(draft.category, draft.details, order),
      });

      setMessages((prev) => {
        const next = [...prev];
        const existing = next[draftIndex];
        if (existing?.supportDraft) {
          next[draftIndex] = { ...existing, supportDraft: { ...existing.supportDraft, ticketId: ticket.id } };
        }
        return [
          ...next,
          {
            id: `msg_${Date.now()}`,
            sender: 'assistant',
            text: `Support request **#${ticket.id.substring(0, 8).toUpperCase()}** is open (status: ${ticket.status}). A human teammate will review it in the app. I'm a virtual assistant — thanks for your patience.`,
            timestamp: new Date().toISOString(),
            supportTicket: {
              id: ticket.id,
              status: ticket.status,
              subject: ticket.subject,
              category: ticket.category,
            },
            suggestions: ['🎫 View my tickets', '📦 Track my order', 'Ask another question'],
          },
        ];
      });
      showToast('Support ticket created');
    } catch (e) {
      console.warn('Support ticket error:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          sender: 'assistant',
          text: "I couldn't open the ticket just now. Your notes are still here — try again, or use the Profile tab to contact support another way.",
          timestamp: new Date().toISOString(),
          suggestions: ['Try again', '📦 Track my order', '🙋 Speak to a human'],
        },
      ]);
    } finally {
      setTicketBusy(false);
    }
  };

  const handleSend = async (textToSend?: string, filterOverride?: string | null) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMsg: QChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');

    const normalized = normalizeSupportText(text);
    const shoppingIntent = detectShoppingIntent(text);
    const topic = shoppingIntent ? null : detectSupportTopic(text);

    if (normalized === 'view my tickets' || normalized === 'my tickets' || normalized === 'tickets') {
      navigation.navigate('SupportTickets');
      return;
    }

    if (topic) {
      if (topic === 'other' && /\b(human|person|agent|support team|speak to someone|talk to someone|ticket)\b/.test(normalized)) {
        handleHumanHandoff();
        return;
      }
      await handleSupportIntent(topic);
      return;
    }

    if (normalized === 'create support ticket') {
      const openDraftIndex = findLatestIssueDraft();
      if (openDraftIndex >= 0) {
        await handleCreateTicket(openDraftIndex);
        return;
      }
    }

    const draftIndex = findLatestIssueDraft();
    if (draftIndex >= 0 && !shoppingIntent) {
      const existingMessage = messages[draftIndex];
      const existing = existingMessage.supportDraft!;
      setMessages((prev) => {
        const next = [...prev];
        next[draftIndex] = {
          ...existingMessage,
          supportDraft: {
            ...existing,
            details: `${existing.details ? `${existing.details}\n` : ''}${text}`,
          },
        };
        return [
          ...next,
          {
            id: `msg_${Date.now()}`,
            sender: 'assistant',
            text: `Got it — I've added that to the ticket notes for order #${existing.orderNumber}. Add anything else, then tap **Create support ticket**.`,
            timestamp: new Date().toISOString(),
            suggestions: ['Create support ticket', '📦 Track my order'],
          },
        ];
      });
      return;
    }

    if (normalized.includes('faq') || normalized.includes('help centre') || normalized.includes('help center')) {
      setLoading(true);
      try {
        const articles = await supportService.listSupportArticles();
        const answer = buildFaqReply(text, articles);
        if (answer) {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg_${Date.now()}`,
              sender: 'assistant',
              text: answer,
              timestamp: new Date().toISOString(),
              suggestions: ['🙋 Speak to a human', '📦 Track my order', '💳 Payment question'],
            },
          ]);
          return;
        }
      } catch (e) {
        console.warn('FAQ lookup failed:', e);
      } finally {
        setLoading(false);
      }
    }

    const effectiveFilter = filterOverride === undefined ? activeFilter : filterOverride;

    setLoading(true);
    try {
      const budgetFromFilter =
        effectiveFilter === 'under r100' ? 100 : effectiveFilter === 'under r150' ? 150 : undefined;
      const response = await aiChatService.sendMessage(text, [...messages, userMsg], {
        dietaryFilters: effectiveFilter ? [effectiveFilter] : [],
        budget: budgetFromFilter,
      });
      setMessages((prev) => [...prev, response]);
    } catch (e) {
      console.warn('Q AI Error:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          sender: 'assistant',
          text: "I couldn't process that right now. Please try again, or tell me what you need — I can help with meals and stores, or with an order, delivery or payment question.",
          timestamp: new Date().toISOString(),
          suggestions: GENERAL_SUGGESTIONS,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAiProductToCart = async (product: Product) => {
    if (!product.storeId) {
      showToast('This item cannot be added to cart right now');
      return;
    }
    const conversationId = await ensureConversationId();
    const added = await addProductToCart({
      navigation,
      product,
      storeId: product.storeId,
      storeName: 'Recommended Store',
      aiAssisted: true,
      aiConversationId: conversationId ?? undefined,
    });
    if (added) {
      showToast(`${product.name} added to cart`);
    }
  };

  const getFilterPrompt = (tag: string) => {
    const key = tag.toLowerCase();
    if (key === 'under r100') return 'Meals under R100';
    if (key === 'under r150') return 'Meals under R150';
    return `Show ${tag} options`;
  };

  const handleFilterPress = (tag: string) => {
    const key = tag.toLowerCase();
    if (activeFilter === key) {
      setActiveFilter(null);
      return;
    }
    setActiveFilter(key);
    void handleSend(getFilterPrompt(tag), key);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.appBarBackground,
            borderBottomColor: colors.divider,
            height: 60 + insets.top,
            paddingTop: insets.top,
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={[styles.assistantAvatar, { backgroundColor: colors.secondary }]}>
            <Ionicons name="person-circle-outline" size={22} color="#FFFFFF" />
          </View>
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={[typography.titleMedium, { color: colors.onSurface }]} numberOfLines={1}>
              {ASSISTANT_NAME} · {ASSISTANT_ROLE}
            </Text>
            <Text style={[typography.labelSmall, { color: colors.secondary }]} numberOfLines={1}>
              {ASSISTANT_PRESENCE}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.headerAction, { backgroundColor: colors.primaryContainer, marginLeft: 8 }]}
          onPress={() => navigation.navigate('BudgetMeals')}
          accessibilityLabel="Budget meals"
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Ionicons name="wallet-outline" size={18} color={colors.secondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.headerAction, { backgroundColor: colors.primaryContainer, marginLeft: 6, marginRight: 4 }]}
          onPress={() => navigation.navigate('SupportTickets')}
          accessibilityLabel="Support tickets"
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Ionicons name="ticket-outline" size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.filterBar, { borderBottomColor: colors.divider }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBarContent}
        >
          {FILTER_OPTIONS.map((tag) => {
            const key = tag.toLowerCase();
            const isActive = activeFilter === key;
            return (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? colors.secondary : colors.cardBackground,
                    borderColor: isActive ? colors.secondary : colors.divider,
                  },
                ]}
                onPress={() => handleFilterPress(tag)}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    { color: isActive ? '#FFFFFF' : colors.onSurface, fontWeight: '600' },
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollToLatestMessage(false)}
        onLayout={() => scrollToLatestMessage(false)}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, info.averageItemLength * info.index - 8),
            animated: false,
          });
          requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0, viewOffset: 8 });
          });
        }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.sender === 'user' ? styles.userBubble : styles.assistantBubble,
              item.sender === 'user'
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.cardBackground, borderColor: colors.divider },
            ]}
          >
            {item.sender === 'assistant' ? (
              <View style={styles.assistantIdentity}>
                <View style={[styles.miniAvatar, { backgroundColor: colors.secondary }]}>
                  <Text style={styles.miniAvatarText}>Q</Text>
                </View>
                <Text style={[typography.labelSmall, { color: colors.secondary, fontWeight: '700', marginLeft: 6 }]}>
                  {ASSISTANT_NAME} · Virtual assistant
                </Text>
              </View>
            ) : null}

            <Text
              style={[
                typography.bodyMedium,
                { color: item.sender === 'user' ? colors.onPrimary : colors.onSurface, lineHeight: 22 },
              ]}
            >
              {renderFormattedMessageText(
                item.text,
                item.sender === 'user' ? colors.onPrimary : colors.onSurface
              )}
            </Text>

            {item.suggestedProducts && item.suggestedProducts.length > 0 && (
              <View style={styles.productsBox}>
                {item.suggestedProducts.map((prod) => (
                  <View key={prod.id} style={styles.prodRow}>
                    <ProductCard
                      product={prod}
                      onPress={() => {}}
                      onAddToCart={handleAddAiProductToCart}
                      horizontal
                    />
                  </View>
                ))}
              </View>
            )}

            {item.suggestedAction && item.suggestedAction.type === 'view_order' && item.suggestedAction.payload?.issueOrder && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
                onPress={() =>
                  navigation.navigate('OrderTracking', {
                    orderId: item.suggestedAction?.payload.issueOrder.orderId,
                  })
                }
              >
                <Ionicons name="map-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={[typography.titleSmall, { color: '#FFFFFF' }]}>View order</Text>
              </TouchableOpacity>
            )}

            {item.trackActions && item.trackActions.length > 0 && (
              <View style={{ marginTop: 10 }}>
                {item.trackActions.map((action) => (
                  <TouchableOpacity
                    key={action.orderId + action.label}
                    style={[styles.actionBtn, { backgroundColor: colors.secondary, marginTop: 6 }]}
                    onPress={() => navigation.navigate('OrderTracking', { orderId: action.orderId })}
                  >
                    <Ionicons name="location-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={[typography.titleSmall, { color: '#FFFFFF' }]}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {item.selectableOrders && item.selectableOrders.length > 0 && (
              <View style={{ marginTop: 10 }}>
                {item.selectableOrders.map((order) => (
                  <TouchableOpacity
                    key={order.id}
                    style={[styles.orderChoice, { borderColor: colors.divider, backgroundColor: colors.surface }]}
                    onPress={() =>
                      handleSelectIssueOrder(
                        order,
                        (item.suggestedAction?.payload?.supportTopic as SupportTopic) ?? 'other'
                      )
                    }
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.titleSmall, { color: colors.onSurface, fontWeight: '700' }]}>
                        #{order.orderNumber} · {order.storeName}
                      </Text>
                      <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]}>
                        {order.statusLabel} · {appConfig.formatCurrency(order.total)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {item.issueOptions && item.issueOptions.length > 0 && item.suggestedAction?.payload?.issueOrder && (
              <View style={styles.suggestionsContainer}>
                {item.issueOptions.map((opt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.suggestionChip, { backgroundColor: colors.primaryContainer }]}
                    onPress={() =>
                      handleSelectIssueType(
                        opt,
                        item.suggestedAction!.payload.issueOrder as QChatSelectableOrder,
                        (item.suggestedAction!.payload.supportTopic as SupportTopic) ?? 'other'
                      )
                    }
                  >
                    <Text style={[typography.labelSmall, { color: colors.secondary, fontWeight: '600' }]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {item.supportDraft && (
              <View style={[styles.supportDraft, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
                <Text style={[typography.labelSmall, { color: colors.secondary, fontWeight: '700', marginBottom: 4 }]}>
                  {item.supportDraft.ticketId ? 'SUPPORT REQUEST · TICKET OPEN' : 'SUPPORT REQUEST · READY TO SEND'}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.onSurface }]}>
                  Order #{item.supportDraft.orderNumber} · {item.supportDraft.storeName}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]}>
                  Issue: {item.supportDraft.issue}
                </Text>
                {item.supportDraft.details ? (
                  <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4 }]}>
                    Notes: {item.supportDraft.details}
                  </Text>
                ) : null}
                {!item.supportDraft.ticketId ? (
                  <TouchableOpacity
                    style={[styles.secondaryActionBtn, { backgroundColor: colors.secondary, marginTop: 10 }]}
                    onPress={() => handleCreateTicket(messages.indexOf(item))}
                    disabled={ticketBusy}
                  >
                    {ticketBusy ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="send-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    )}
                    <Text style={[typography.titleSmall, { color: '#FFFFFF' }]}>Create support ticket</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {item.supportTicket && (
              <View style={[styles.ticketCard, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.secondary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[typography.titleSmall, { color: colors.onSurface, fontWeight: '700' }]}>
                    Ticket #{item.supportTicket.id.substring(0, 8).toUpperCase()} · {item.supportTicket.status}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]} numberOfLines={2}>
                    {item.supportTicket.subject}
                  </Text>
                </View>
              </View>
            )}

            {item.suggestions && item.suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {item.suggestions.map((sug, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.suggestionChip, { backgroundColor: colors.primaryContainer }]}
                    onPress={() => handleSend(sug)}
                  >
                    <Text style={[typography.labelSmall, { color: colors.secondary, fontWeight: '600' }]}>
                      {sug}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      />

      {toast ? (
        <View
          style={[
            styles.toast,
            {
              backgroundColor: colors.onSurface,
              bottom: (cartItemCount > 0 ? 144 : 84) + insets.bottom,
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
          <Text
            style={[typography.bodySmall, { color: colors.surface, marginLeft: 6, fontWeight: '600', flex: 1 }]}
            numberOfLines={2}
          >
            {toast}
          </Text>
        </View>
      ) : null}

      {cartItemCount > 0 ? (
        <TouchableOpacity
          style={[styles.fabCart, { backgroundColor: colors.secondary, bottom: 78 + insets.bottom }]}
          onPress={() => navigation.navigate('Cart')}
          activeOpacity={0.88}
        >
          <Ionicons name="cart" size={22} color="#FFFFFF" />
          <View style={[styles.fabBadge, { backgroundColor: colors.primary, borderColor: colors.secondary }]}>
            <Text style={styles.fabBadgeText}>{cartItemCount > 99 ? '99+' : String(cartItemCount)}</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <View style={[styles.inputBar, { backgroundColor: colors.appBarBackground, borderTopColor: colors.divider }]}>
        <TextInput
          style={[styles.input, { color: colors.onSurface, backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
          placeholder="Ask Q about meals, orders, delivery or payment..."
          placeholderTextColor={colors.subtext}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
        />

        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: colors.secondary }]}
          onPress={() => handleSend()}
          disabled={loading || ticketBusy || !inputText.trim()}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assistantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBar: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  filterBarContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 8,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    maxWidth: '90%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  assistantIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  miniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  productsBox: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  prodRow: {
    marginRight: 8,
    marginBottom: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 10,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  orderChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 6,
  },
  supportDraft: {
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  ticketCard: {
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 84,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 20,
  },
  fabCart: {
    position: 'absolute',
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 21,
  },
  fabBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  fabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
});
