import { supabase } from '../config/supabaseClient';
import { Product } from '../models/product';
import { Store } from '../models/store';
import { storeService } from './storeService';
import { appConfig } from '../config/appConfig';

// The deployed `ai-chat` function persists conversation turns itself, so the
// client only needs to carry the conversation id between calls.
let conversationId: string | null = null;

const extractBudgetAmount = (text: string): number | null => {
  const patterns = [
    /(?:under|below|less than|max(?:imum)?|upto|up to|within)\s*r?\s*(\d+(?:[.,]\d+)?)/i,
    /r\s*(\d+(?:[.,]\d+)?)\s*(?:or less|and under|budget|max)?/i,
    /(\d+(?:[.,]\d+)?)\s*(?:rand|zar|bucks)\b/i,
    /\bfor\s*r?\s*(\d+(?:[.,]\d+)?)\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const n = Number(m[1].replace(',', '.'));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
};

const isMealBudgetIntent = (text: string): boolean => {
  const lower = text.toLowerCase();
  const hasBudgetWord = /\b(under|below|less than|budget|cheap|affordable|deal|deals|max|within)\b/.test(lower) || /\br\s?\d+/.test(lower) || /\d+\s*(rand|zar)\b/.test(lower);
  if (!hasBudgetWord) return false;
  return /\b(meal|meals|food|eat|eating|lunch|dinner|breakfast|snack|snacks|dish|dishes|hungry|craving|burger|pizza|chicken|wings|wrap|stew|pap|kota|combo|plate|family)\b/.test(lower) || /under|below|less than|max|budget/.test(lower);
};

const fetchProductsUnderBudget = async (budget: number, messageText: string, limit = 12): Promise<Product[]> => {
  try {
    let query = supabase
      .from('products')
      .select('*')
      .lte('price', budget)
      .gt('price', 0)
      .order('price', { ascending: false })
      .limit(limit * 2);

    const lower = messageText.toLowerCase();
    // "meals/food" oriented budget asks should prefer food items
    if (/\b(meal|meals|food|eat|eating|lunch|dinner|breakfast|hungry|craving|burger|pizza|chicken|wings|wrap|stew|pap|kota|combo|plate)\b/.test(lower)) {
      query = query.eq('product_type', 'food');
    }

    const { data, error } = await query;
    if (error || !data) return [];
    const products = data.map((row: any) => storeService.mapProductRecord(row));
    // keep variety: stable-ish shuffle not needed, but ensure unique ids and cap
    const seen = new Set<string>();
    const unique = products.filter((p) => {
      if (!p?.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    return unique.slice(0, limit);
  } catch {
    return [];
  }
};

export interface QChatSelectableOrder {
  id: string;
  orderNumber: string;
  storeName: string;
  status: string;
  statusLabel: string;
  total: number;
  createdAt: string;
}

export interface QChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedProducts?: Product[];
  suggestedStores?: Store[];
  suggestedAction?: {
    type: 'add_to_cart' | 'view_order' | 'view_store';
    payload: any;
  };
  suggestions?: string[];
  dietaryFilters?: string[];
  /** Interactive support/order tracking UI rendered by the chat screen. */
  trackActions?: { label: string; orderId: string }[];
  selectableOrders?: QChatSelectableOrder[];
  issueOptions?: string[];
  supportDraft?: { orderId: string; orderNumber: string; storeName: string; issue: string };
}

export const aiChatService = {
  async sendMessage(
    messageText: string,
    history: QChatMessage[],
    options?: {
      dietaryFilters?: string[];
      budget?: number;
      servings?: number;
    }
  ): Promise<QChatMessage> {
    const budget = extractBudgetAmount(messageText);
    const budgetIntent = budget !== null && isMealBudgetIntent(messageText);
    const budgetProducts = budgetIntent ? await fetchProductsUnderBudget(budget as number, messageText, 12) : [];

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: messageText,
          ...(conversationId ? { conversation_id: conversationId } : {}),
        },
      });

      if (!error && data?.reply) {
        if (typeof data.conversation_id === 'string') {
          conversationId = data.conversation_id;
        }

        // ai-chat returns structured `cards` (products/stores/recipes) instead
        // of trusting the model's prose, so the app can render tappable cards.
        const cards = data.cards ?? {};
        let suggestedProducts: Product[] = Array.isArray(cards.products)
          ? cards.products.map((row: Record<string, unknown>) => storeService.mapProductRecord(row))
          : [];
        let text = String(data.reply || '');

        if (budgetIntent) {
          const seenIds = new Set(suggestedProducts.map((p: Product) => p.id));
          const extras = budgetProducts.filter((p: Product) => !seenIds.has(p.id));
          suggestedProducts = [...suggestedProducts, ...extras].filter((p: Product) => Number(p.price) <= (budget as number));
          if (suggestedProducts.length === 0) {
            suggestedProducts = budgetProducts.slice(0, 12);
          } else {
            suggestedProducts = suggestedProducts.slice(0, 12);
          }
          if (suggestedProducts.length === 0) {
            text = `I couldn't find meals under **${appConfig.formatCurrency(budget as number)}** right now. Try a higher budget or ask me for popular meals and deals.`;
          } else if (!/under\s*\*?\s*r?\s*\d/i.test(text.toLowerCase()) && !text.includes(appConfig.formatCurrency(budget as number))) {
            text = `Here are **${suggestedProducts.length}** meal option${suggestedProducts.length === 1 ? '' : 's'} under **${appConfig.formatCurrency(budget as number)}** I found for you:`;
          }
        }

        return {
          id: `msg_${Date.now()}`,
          sender: 'assistant',
          text,
          timestamp: new Date().toISOString(),
          suggestedProducts,
          suggestedStores: Array.isArray(cards.stores)
            ? cards.stores.map((row: Record<string, unknown>) => storeService.mapStoreRecord(row))
            : [],
          suggestions: budgetIntent
            ? [
                `💰 Meals under ${appConfig.formatCurrency(budget as number)}`,
                '🍔 Best burgers near me',
                '🍕 Pizza & fast food',
                '🥗 Halal & veggie options',
                '⏱️ Quick delivery',
                '📦 Track active order',
              ]
            : undefined,
        };
      }
    } catch (e) {
      console.warn('Q AI Edge Function error:', e);
    }

    // Smart fallback AI response engine for local/offline/dev mode
    const lower = messageText.toLowerCase();

    if (lower.includes('burger') || lower.includes('food') || lower.includes('hungry') || lower.includes('craving')) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: `Here are some popular meals you might like for "${messageText}":`,
        timestamp: new Date().toISOString(),
        suggestedProducts: [
          {
            id: 'ai_prod_1',
            name: 'Smokey Bacon & Cheese Burger',
            category: 'burgers',
            description: 'Flame-grilled patty with melted cheddar and crispy bacon',
            basePrice: 85.0,
            price: 95.63,
            imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
            isLocalBrand: true,
            tags: ['Bestseller'],
            productType: 'food',
            stock: 50,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            optionGroups: [],
          },
          {
            id: 'ai_prod_2',
            name: 'Gourmet Truffle Fries',
            category: 'snacks',
            description: 'Hand-cut fries tossed in parmesan and truffle oil',
            basePrice: 45.0,
            price: 50.63,
            imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500',
            isLocalBrand: true,
            tags: ['Side'],
            productType: 'food',
            stock: 30,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            optionGroups: [],
          },
        ],
        suggestions: [
          '🍔 More burger options',
          '🍕 Pizza & fast food',
          '🥗 Halal & veggie options',
          '💰 Meals under R100',
          '⏱️ Quick delivery',
          '👨‍👩‍👧 Family meals',
        ],
      };
    }

    if (lower.includes('pizza') || lower.includes('chicken') || lower.includes('wings') || lower.includes('wrap') || lower.includes('fast food')) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: `Looking for ${messageText}? I can help you find tasty options nearby. Try browsing stores or tell me your budget and dietary needs.`,
        timestamp: new Date().toISOString(),
        suggestions: [
          '🍕 Show pizza deals',
          '🍗 Chicken & wings',
          '💰 Meals under R100',
          '⏱️ Quick delivery',
          '🥗 Halal & veggie options',
          '👨‍👩‍👧 Family meals',
        ],
      };
    }

    if (lower.includes('halal') || lower.includes('vegetarian') || lower.includes('veggie') || lower.includes('vegan') || lower.includes('healthy') || lower.includes('gluten')) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: `I can help with dietary-friendly options like "${messageText}". Use the filter chips above or tell me what you’re in the mood for and your budget.`,
        timestamp: new Date().toISOString(),
        suggestions: [
          '🥗 Halal meals near me',
          '🥦 Vegetarian options',
          '🌱 Vegan meals',
          '💰 Healthy under R150',
          '🍔 Best burgers near me',
          '⏱️ Quick delivery',
        ],
      };
    }

    if (lower.includes('quick') || lower.includes('fast') || lower.includes('near') || lower.includes('close')) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: `Want something quick? I can suggest popular nearby options and fast meals. Tell me what you feel like (burgers, pizza, chicken, etc.) or your budget.`,
        timestamp: new Date().toISOString(),
        suggestions: [
          '⏱️ Quick delivery meals',
          '🍔 Best burgers near me',
          '🍕 Pizza & fast food',
          '💰 Meals under R100',
          '👨‍👩‍👧 Family meals',
          '🥗 Halal & veggie options',
        ],
      };
    }

    if (lower.includes('family') || lower.includes('group') || lower.includes('share') || lower.includes('kids')) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: `Planning for a family or group? Tell me how many people and your budget, and I can suggest shareable meals and deals.`,
        timestamp: new Date().toISOString(),
        suggestions: [
          '👨‍👩‍👧 Family meals under R250',
          '🍕 Pizza & sharing deals',
          '🍔 Burger combos',
          '🥤 Drinks & sides',
          '💰 Meals under R100',
          '⏱️ Quick delivery',
        ],
      };
    }

    if (lower.includes('status') || lower.includes('where is my order') || lower.includes('where my order') || lower.includes('track') || lower.includes('delivery status')) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: "I can help you track an active order. Tap **Track active order** below and I'll find your current order(s), show their status, and link you to live tracking.",
        timestamp: new Date().toISOString(),
        suggestions: [
          'Track active order',
          'I have an issue with an order',
          '🍔 Best burgers near me',
          '💰 Meals under R100',
        ],
      };
    }

    if (lower.includes('issue') || lower.includes('problem') || lower.includes('support') || lower.includes('complaint') || lower.includes('missing') || lower.includes('wrong') || lower.includes('damaged') || lower.includes('refund') || lower.includes('late') || lower.includes('not delivered') || lower.includes('did not receive')) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: "I'm here to help with an order issue. Tap **I have an issue with an order** below and I'll show your recent orders from the last 7 days (including active orders) so you can select one and report what went wrong.",
        timestamp: new Date().toISOString(),
        suggestions: [
          'I have an issue with an order',
          'Track active order',
          '🍔 Browse meals',
          '💰 Meals under R100',
        ],
      };
    }

    if (lower.includes('budget') || lower.includes('cheap') || lower.includes('under') || /\br\s?\d+/.test(lower) || lower.includes('deal')) {
      const fallbackBudget = budget ?? 100;
      const products = budgetProducts.length > 0 ? budgetProducts : await fetchProductsUnderBudget(fallbackBudget, messageText, 12);
      if (products.length > 0) {
        return {
          id: `msg_${Date.now()}`,
          sender: 'assistant',
          text: `Here are **${products.length}** meal option${products.length === 1 ? '' : 's'} under **${appConfig.formatCurrency(fallbackBudget)}** I found for you:`,
          timestamp: new Date().toISOString(),
          suggestedProducts: products,
          suggestions: [
            `💰 Meals under ${appConfig.formatCurrency(fallbackBudget)}`,
            '💸 Meals under R150',
            '💸 Meals under R200',
            '🍔 Best burgers near me',
            '🍕 Pizza & fast food',
            '🥗 Halal & veggie options',
            '⏱️ Quick delivery',
          ],
        };
      }
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: `I couldn't find meals under **${appConfig.formatCurrency(fallbackBudget)}** right now. Try a higher budget (for example **R150** or **R200**) or ask me for popular meals near you.`,
        timestamp: new Date().toISOString(),
        suggestions: [
          '💸 Meals under R150',
          '💸 Meals under R200',
          '🍔 Best burgers near me',
          '🍕 Pizza & fast food',
          '⏱️ Quick delivery',
          '📦 Track active order',
        ],
      };
    }

    if (lower.includes('drink') || lower.includes('dessert') || lower.includes('sweet') || lower.includes('ice cream') || lower.includes('cake')) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: `Craving something to drink or a sweet treat? I can help you find desserts, drinks, and snacks nearby.`,
        timestamp: new Date().toISOString(),
        suggestions: [
          '🍰 Desserts & treats',
          '🥤 Drinks & refreshments',
          '🍔 Best burgers near me',
          '💰 Meals under R100',
          '⏱️ Quick delivery',
          '👨‍👩‍👧 Family meals',
        ],
      };
    }

    return {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: `Hi! I'm Q, your personal food and store assistant. How can I help you today? I can find dishes, recommend stores near you, help plan meals on a budget, track an active order, or help with an order issue.`,
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
    };
  },
};
