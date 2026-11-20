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
import { aiChatService, QChatMessage, QChatSelectableOrder } from '../../services/aiChatService';
import { ProductCard } from '../../components/ProductCard';
import { addProductToCart } from '../../utils/cartActions';
import { cartService } from '../../services/cartService';
import { Product } from '../../models/product';
import { appConfig } from '../../config/appConfig';
import { authService } from '../../services/authService';
import { orderService } from '../../services/orderService';
import { Order } from '../../models/order';
import { orderStatusHelpers, orderStatusMeta } from '../../models/statuses';

export const QAiChatScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const conversationId = useRef(`q_conv_${Date.now()}`).current;
  const listRef = useRef<FlatList<QChatMessage>>(null);

  const [messages, setMessages] = useState<QChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: "👋 Hi there! I'm Q, your personal food & store assistant. Ask me anything about dishes, diet filters, budget meals, track an active order, or report an issue with a recent order!",
      timestamp: new Date().toISOString(),
      suggestions: [
        '📦 Track active order',
        '⚠️ I have an issue with an order',
        '🍔 Best burgers near me',
        '🍕 Pizza & fast food',
        '🥗 Halal & veggie options',
        '💰 Meals under R100',
        '⏱️ Quick delivery',
        '👨‍👩‍👧 Family meals',
      ],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
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

  const ISSUE_OPTIONS = [
    'Missing items',
    'Wrong items received',
    'Damaged/spilled items',
    'Order arrived very late',
    'Food quality issue',
    'Charged incorrectly',
    'Did not receive order',
    'Driver or delivery issue',
    'Other issue',
  ];

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
  }, [messages.length, loading]);

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

  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

  const isTrackIntent = (n: string) =>
    n === 'track active order' ||
    n === 'track my order' ||
    n === 'track order' ||
    n === 'refresh active orders' ||
    (n.includes('track') && n.includes('order')) ||
    n.includes('where is my order') ||
    n.includes('where my order') ||
    n.includes('order status') ||
    n.includes('delivery status') ||
    n.includes('active order');

  const isIssueIntent = (n: string) =>
    n === 'i have an issue with an order' ||
    n === 'i have an issue with another order' ||
    n === 'report an order issue' ||
    n.includes('issue with') ||
    n.includes('order issue') ||
    n.includes('problem with') ||
    n.includes('complaint') ||
    n.includes('support') ||
    n.includes('refund') ||
    n.includes('missing item') ||
    n.includes('missing items') ||
    n.includes('wrong item') ||
    n.includes('wrong order') ||
    n.includes('damaged') ||
    n.includes('spilled') ||
    n.includes('not delivered') ||
    n.includes('never arrived') ||
    n.includes('did not receive') ||
    n.includes('charged incorrectly') ||
    n.includes('late order') ||
    n.includes('food quality') ||
    n.includes('driver issue');

  const toSelectableOrder = (order: Order): QChatSelectableOrder => ({
    id: order.id,
    orderNumber: order.orderNumber || order.id.substring(0, 8).toUpperCase(),
    storeName: order.storeName || 'Store',
    status: order.status,
    statusLabel: orderStatusMeta[order.status]?.displayName || order.status,
    total: order.total,
    createdAt: order.createdAt,
  });

  const getCurrentUserOrders = async (): Promise<{ userId: string; orders: Order[] } | null> => {
    const user = await authService.getCurrentSessionUser();
    if (!user?.id) return null;
    const orders = await orderService.getUserOrders(user.id);
    return { userId: user.id, orders };
  };

  const buildActiveOrdersReply = (orders: Order[]): QChatMessage => {
    const active = orders.filter((o) => !orderStatusHelpers.isTerminal(o.status));
    if (active.length === 0) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: "You don't have any active orders right now. If you recently placed one, it may take a moment to appear.",
        timestamp: new Date().toISOString(),
        suggestions: [
          'I have an issue with an order',
          '🍔 Browse burgers',
          '🍕 Pizza & fast food',
          '💰 Meals under R100',
          '⏱️ Quick delivery',
        ],
      };
    }
    const lines = active.slice(0, 5).map((o) => {
      const label = orderStatusMeta[o.status]?.displayName || o.status;
      return `• #${o.orderNumber || o.id.substring(0, 8).toUpperCase()} from ${o.storeName || 'Store'} — ${label} (${appConfig.formatCurrency(o.total)})`;
    });
    return {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: `I found ${active.length} active order${active.length === 1 ? '' : 's'}:\n${lines.join('\n')}\n\nTap below to open live tracking.`,
      timestamp: new Date().toISOString(),
      trackActions: active.slice(0, 5).map((o) => ({
        label: `Track #${o.orderNumber || o.id.substring(0, 8).toUpperCase()}`,
        orderId: o.id,
      })),
      suggestions: ['I have an issue with an order', 'Refresh active orders'],
    };
  };

  const buildRecentOrdersIssueReply = (orders: Order[]): QChatMessage => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = orders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return Number.isFinite(t) ? t >= sevenDaysAgo : false;
    });
    if (recent.length === 0) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: "I couldn't find any orders from the last 7 days to report an issue for.",
        timestamp: new Date().toISOString(),
        suggestions: ['Track active order', '🍔 Browse burgers', '💰 Meals under R100'],
      };
    }
    return {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: "Select the order you had an issue with (from the last 7 days):",
      timestamp: new Date().toISOString(),
      selectableOrders: recent.slice(0, 8).map(toSelectableOrder),
      suggestions: ['Track active order', 'I have an issue with another order'],
    };
  };

  const handleSelectIssueOrder = (order: QChatSelectableOrder) => {
    const userMsg: QChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: `Issue with order #${order.orderNumber} (${order.storeName})`,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: QChatMessage = {
      id: `msg_${Date.now() + 1}`,
      sender: 'assistant',
      text: `What's the issue with order #${order.orderNumber} from ${order.storeName}? Choose one option below:`,
      timestamp: new Date().toISOString(),
      issueOptions: ISSUE_OPTIONS,
      suggestedAction: { type: 'view_order', payload: { issueOrder: order } },
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  };

  const handleSelectIssueType = (issue: string, order: QChatSelectableOrder) => {
    const userMsg: QChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: issue,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: QChatMessage = {
      id: `msg_${Date.now() + 1}`,
      sender: 'assistant',
      text: `Thanks — I've prepared a support request for order #${order.orderNumber} (${order.storeName}). You can add more details in the chat (e.g. what was missing or how you'd like us to help) and our support team can use this once ticket submission is connected.`,
      timestamp: new Date().toISOString(),
      supportDraft: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeName: order.storeName,
        issue,
      },
      trackActions: [{ label: `View order #${order.orderNumber}`, orderId: order.id }],
      suggestions: ['Track active order', 'I have an issue with another order', '🍔 Browse burgers', '💰 Meals under R100'],
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  };

  const findLatestIssueDraft = (): { orderId: string; orderNumber: string; storeName: string; issue: string } | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const draft = messages[i].supportDraft;
      if (draft) return draft;
    }
    return null;
  };

  const handleSupportIntent = async (intent: 'track' | 'issue') => {
    setLoading(true);
    try {
      const result = await getCurrentUserOrders();
      if (!result) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}`,
            sender: 'assistant',
            text: 'Please sign in to view and track your orders or report an issue. You can sign in from the Profile tab.',
            timestamp: new Date().toISOString(),
            suggestions: ['🍔 Browse burgers', '🍕 Pizza & fast food', '💰 Meals under R100', '⏱️ Quick delivery'],
          },
        ]);
        return;
      }
      const reply = intent === 'track' ? buildActiveOrdersReply(result.orders) : buildRecentOrdersIssueReply(result.orders);
      setMessages((prev) => [...prev, reply]);
    } catch (e) {
      console.warn('Order support flow error:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          sender: 'assistant',
          text: "I couldn't load your orders right now. Please check your connection and try again.",
          timestamp: new Date().toISOString(),
          suggestions: ['Track active order', 'I have an issue with an order', '🍔 Browse burgers', '💰 Meals under R100'],
        },
      ]);
    } finally {
      setLoading(false);
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

    const normalized = normalize(text);

    if (isTrackIntent(normalized)) {
      await handleSupportIntent('track');
      return;
    }
    if (isIssueIntent(normalized)) {
      await handleSupportIntent('issue');
      return;
    }

    const issueDraft = findLatestIssueDraft();
    if (issueDraft) {
      const detailMsg: QChatMessage = {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: `Got it — I've added your note to the support draft for order #${issueDraft.orderNumber} (${issueDraft.storeName}, "${issueDraft.issue}"). Our team can review this once ticket submission is connected.`,
        timestamp: new Date().toISOString(),
        supportDraft: { ...issueDraft },
        trackActions: [{ label: `View order #${issueDraft.orderNumber}`, orderId: issueDraft.orderId }],
        suggestions: ['Track active order', 'I have an issue with another order', '🍔 Browse burgers', '💰 Meals under R100'],
      };
      setMessages((prev) => [...prev, detailMsg]);
      return;
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
      console.warn('AI Chat Error:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          sender: 'assistant',
          text: "I couldn't process that right now. Please try again, or tell me if you'd like to track an active order or report an order issue.",
          timestamp: new Date().toISOString(),
          suggestions: ['Track active order', 'I have an issue with an order', '🍔 Best burgers near me', '💰 Meals under R100'],
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
    const added = await addProductToCart({
      navigation,
      product,
      storeId: product.storeId,
      storeName: 'Recommended Store',
      aiAssisted: true,
      aiConversationId: conversationId,
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
      {/* Q Header */}
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
          <View style={[styles.sparkleIcon, { backgroundColor: colors.secondary }]}>
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
          </View>
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={[typography.titleMedium, { color: colors.onSurface }]} numberOfLines={1}>
              Q AI Assistant
            </Text>
            <Text style={[typography.labelSmall, { color: colors.secondary }]} numberOfLines={1}>
              Online • Smart Assistant
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.budgetButton, { backgroundColor: colors.primaryContainer, marginLeft: 8, marginRight: 6 }]}
          onPress={() => navigation.navigate('BudgetMeals')}
          activeOpacity={0.8}
        >
          <Ionicons name="wallet-outline" size={16} color={colors.secondary} />
          <Text style={[typography.labelSmall, { color: colors.secondary, marginLeft: 4, fontWeight: '700' }]}>
            Budget
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips Bar */}
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

      {/* Chat Messages */}
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

            {/* Suggested Products attached to message */}
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

            {/* Action Buttons */}
            {item.suggestedAction && item.suggestedAction.type === 'view_order' && item.suggestedAction.payload?.orderId && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
                onPress={() => navigation.navigate('OrderTracking', { orderId: item.suggestedAction?.payload.orderId })}
              >
                <Ionicons name="map-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={[typography.titleSmall, { color: '#FFFFFF' }]}>Track Order</Text>
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
                    onPress={() => handleSelectIssueOrder(order)}
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
                    onPress={() => handleSelectIssueType(opt, item.suggestedAction!.payload.issueOrder as QChatSelectableOrder)}
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
                  SUPPORT REQUEST (DRAFT)
                </Text>
                <Text style={[typography.bodySmall, { color: colors.onSurface }]}>
                  Order #{item.supportDraft.orderNumber} · {item.supportDraft.storeName}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 2 }]}>
                  Issue: {item.supportDraft.issue}
                </Text>
              </View>
            )}

            {/* Suggestion Chips */}
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

      {/* Input Field Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.appBarBackground, borderTopColor: colors.divider }]}>
        <TextInput
          style={[styles.input, { color: colors.onSurface, backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
          placeholder="Ask Q: track orders, report issues, find meals..."
          placeholderTextColor={colors.subtext}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
        />

        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: colors.secondary }]}
          onPress={() => handleSend()}
          disabled={loading || !inputText.trim()}
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
  budgetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sparkleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    maxWidth: '85%',
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
    fontWeight: '700',
  },
});
