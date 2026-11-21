import { supabase } from '../config/supabaseClient';
import { Product } from '../models/product';
import { Store } from '../models/store';
import { storeService } from './storeService';
import { authService } from './authService';
import { appConfig } from '../config/appConfig';
import {
  GENERAL_SUGGESTIONS,
  detectShoppingIntent,
  SHOPPING_UNAVAILABLE_REPLY,
  SUPPORT_UNAVAILABLE_REPLY,
  type SupportTopic,
} from '../utils/supportChat';

// The deployed `ai-chat` function persists conversation turns itself, so the
// client only needs to carry the canonical backend conversation id.
let conversationId: string | null = null;

/** Canonical backend conversation id, used to link support tickets and cart attribution. */
export const getConversationId = (): string | null => conversationId;

/**
 * Ensures we have a real `ai_conversations.id` before linking a support ticket
 * or an AI-assisted cart. Never falls back to a client-generated fake id.
 */
export const ensureConversationId = async (): Promise<string | null> => {
  if (conversationId) return conversationId;
  const user = await authService.getCurrentSessionUser();
  if (!user?.id) return null;

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ user_id: user.id, title: 'Ask Q' })
    .select('id')
    .single();

  if (error || !data?.id) return null;
  conversationId = String(data.id);
  return conversationId;
};

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
  /** Pay-now shortcuts for orders whose payment is still outstanding. */
  payActions?: { label: string; orderId: string; amount?: number }[];
  selectableOrders?: QChatSelectableOrder[];
  issueOptions?: string[];
  supportDraft?: {
    orderId?: string;
    orderNumber: string;
    storeName: string;
    issue: string;
    category: SupportTopic;
    details: string;
    ticketId?: string;
  };
  supportTicket?: {
    id: string;
    status: string;
    subject: string;
    category: SupportTopic;
  };
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

    // Honest local fallback when the AI edge function is unreachable. Never invent
    // products or imply a ticket/order action was performed.
    const shoppingIntent = detectShoppingIntent(messageText);
    return {
      id: `msg_${Date.now()}`,
      sender: 'assistant',
      text: shoppingIntent ? SHOPPING_UNAVAILABLE_REPLY : SUPPORT_UNAVAILABLE_REPLY,
      timestamp: new Date().toISOString(),
      suggestions: GENERAL_SUGGESTIONS,
    };
  },
};
