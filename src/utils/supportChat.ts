import type { Order } from '../models/order';
import {
  canTrackOrder,
  isAwaitingPaymentOrder,
  isAwaitingPaymentStatus,
  orderStatusFromDatabaseValue,
  orderStatusMeta,
  orderStatusHelpers,
} from '../models/statuses';

export { canTrackOrder, isAwaitingPaymentOrder, isAwaitingPaymentStatus };

export type SupportTopic = 'order_status' | 'delivery' | 'payment' | 'cancellation' | 'other';

/** Paying is an action, not a ticket category — it never becomes a ticket type. */
export type AskQIntent = SupportTopic | 'pay_order';

export const ASSISTANT_NAME = 'Q';
export const ASSISTANT_ROLE = 'Shopping + support assistant';
export const ASSISTANT_PRESENCE = 'Virtual assistant • here to help';

export const ASSISTANT_DISCLOSURE =
  "Hi, I'm Q — a virtual support assistant for Queless. I can help you find meals and stores, check your order, delivery or payment, and open an in-app ticket when a human teammate needs to step in.";

export const HUMAN_HANDOFF_REPLY =
  "I can bring a human teammate in. I'll open a support ticket in the app with this chat and your order details attached, then they can take it from here. I'm a virtual assistant, not a real person.";

export const SUPPORT_UNAVAILABLE_REPLY =
  "I'm Q, your virtual support assistant, but I can't reach my live help right now so I won't guess about your order or invent products. Please try again in a moment, browse stores from the home tab, or open an in-app support ticket if you need a human teammate.";

export const SHOPPING_UNAVAILABLE_REPLY =
  "I'm Q, your virtual support assistant, but I can't reach live recommendations right now so I won't invent meals or prices. Please try again, or browse Food and Liquor from the home tab. I can still open an in-app ticket for order help.";

export const SUPPORT_TOPIC_LABELS: Record<SupportTopic, string> = {
  order_status: 'Order status',
  delivery: 'Delivery',
  payment: 'Payment',
  cancellation: 'Cancellation',
  other: 'Something else',
};

export const SUPPORT_ISSUE_OPTIONS: string[] = [
  SUPPORT_TOPIC_LABELS.order_status,
  SUPPORT_TOPIC_LABELS.delivery,
  SUPPORT_TOPIC_LABELS.payment,
  SUPPORT_TOPIC_LABELS.cancellation,
  SUPPORT_TOPIC_LABELS.other,
];

export const SUPPORT_SUGGESTIONS: string[] = [
  '📦 Track my order',
  '💳 Pay for my order',
  '🛵 Delivery help',
  '💳 Payment question',
  '🚫 Cancel an order',
  '🙋 Speak to a human',
  '📚 Delivery & payment FAQs',
];

export const PAY_ORDER_SUGGESTION = '💳 Pay for my order';

export const NO_UNPAID_ORDER_REPLY =
  "You don't have an order waiting for payment right now. If you just placed one, give it a moment — or ask me to track an existing order.";

export const SHOPPING_SUGGESTIONS: string[] = [
  '🍔 Best burgers near me',
  '💰 Meals under R100',
  '🥗 Halal & veggie options',
  '⏱️ Quick delivery',
];

export const GENERAL_SUGGESTIONS: string[] = [
  '🍔 Best burgers near me',
  '💰 Meals under R100',
  '📦 Track my order',
  '🛵 Delivery help',
  '💳 Payment question',
  '🙋 Speak to a human',
];

export function normalizeSupportText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(normalized: string, phrases: string[]): boolean {
  return phrases.some((phrase) => normalized.includes(phrase));
}

/**
 * Classify a customer message into the v1 support scope. Refunds and broad
 * complaints deliberately map to `other` so they become a human ticket rather
 * than an automated decision.
 */
export function detectSupportTopic(value: string): SupportTopic | null {
  const n = normalizeSupportText(value);
  if (!n) return null;

  if (includesAny(n, ['cancel', 'cancellation', 'stop my order', 'change my order'])) {
    return 'cancellation';
  }
  if (
    includesAny(n, [
      'refund',
      'complaint',
      'human',
      'person',
      'real person',
      'agent',
      'support team',
      'speak to someone',
      'talk to someone',
      'ticket',
      'escalate',
    ])
  ) {
    return 'other';
  }
  if (
    includesAny(n, [
      'payment',
      'paid',
      'pay',
      'charged',
      'charge',
      'card declined',
      'payment failed',
      'deducted',
      'amount',
      'invoice',
      'receipt',
    ])
  ) {
    return 'payment';
  }
  if (
    includesAny(n, [
      'delivery',
      'driver',
      'rider',
      'late',
      'not arrived',
      'never arrived',
      'did not arrive',
      'where is my driver',
      'where is the driver',
      'on my way',
      'arrived',
      'missing item',
      'missing items',
      'wrong item',
      'damaged',
      'spilled',
      'not delivered',
      'did not receive',
    ])
  ) {
    return 'delivery';
  }
  if (
    includesAny(n, [
      'track',
      'order status',
      'status of my order',
      'where is my order',
      'where my order',
      'active order',
      'my orders',
      'order update',
    ])
  ) {
    return 'order_status';
  }
  return null;
}

/**
 * Shopping questions still reach the same Q assistant. Explicit support
 * language wins so a refund/tracking question never falls through to catalog
 * search just because it mentions a meal or store.
 */
/**
 * "Pay for my order" is a distinct action from "track my order" and from a
 * general payment question. It is checked before the ticket-topic classifier.
 */
export function detectPayOrderIntent(value: string): boolean {
  const n = normalizeSupportText(value);
  return [
    'pay my order',
    'pay for my order',
    'pay for order',
    'pay order',
    'pay the order',
    'pay outstanding',
    'pay outstanding order',
    'pay unpaid order',
    'pay now',
    'complete payment',
    'complete my payment',
    'finish payment',
    'settle my order',
    'settle payment',
  ].some((phrase) => n.includes(phrase));
}

export function detectShoppingIntent(value: string): boolean {
  const n = normalizeSupportText(value);
  if (!n) return false;

  const supportOverride =
    /\b(refund|track|order status|where is my order|cancel|charge|charged|paid twice|pay my order|pay for my order|pay now|missing item|wrong item|damaged|spilled|not delivered|did not arrive|human|agent|ticket|support team|complaint)\b/;
  if (supportOverride.test(n)) return false;

  const shoppingTerms =
    /\b(browse|find|show|suggest|recommend|looking for|meal|meals|food|eat|burger|burgers|pizza|chicken|wings|snack|snacks|drink|drinks|dessert|store|stores|dish|dishes|cuisine|halal|veggie|vegetarian|vegan|gluten free|spicy|healthy|budget|cheap|affordable|recipe|recipes)\b/;
  const budgetTerm = /\br\s?\d+|\b\d+\s*rand\b|\bunder r\s?\d+\b/;
  return shoppingTerms.test(n) || budgetTerm.test(n);
}

export function supportCategoryFromIssueLabel(label: string): SupportTopic {
  const normalized = normalizeSupportText(label);
  const byLabel = (Object.keys(SUPPORT_TOPIC_LABELS) as SupportTopic[]).find(
    (topic) => normalizeSupportText(SUPPORT_TOPIC_LABELS[topic]) === normalized
  );
  return byLabel ?? 'other';
}

export function orderLabel(order: Pick<Order, 'orderNumber' | 'id' | 'storeName'>): string {
  const number = order.orderNumber || order.id.substring(0, 8).toUpperCase();
  const store = order.storeName || 'your store';
  return `#${number} from ${store}`;
}

export function statusLabel(order: Pick<Order, 'status'>): string {
  return orderStatusMeta[order.status]?.displayName || order.status;
}

export function isRecentOrder(order: Pick<Order, 'createdAt'>): boolean {
  const time = new Date(order.createdAt).getTime();
  return Number.isFinite(time) ? time >= Date.now() - 7 * 24 * 60 * 60 * 1000 : false;
}

export function unpaidOrderReply(order: Pick<Order, 'orderNumber' | 'id' | 'storeName'>): string {
  return `Order ${orderLabel(order)} is **Awaiting Payment**, so there's nothing to track yet. Complete payment from the order in your Orders tab, then ask me again — or I can open a support ticket if you're stuck.`;
}

export function orderStatusReply(order: Order): string {
  if (isAwaitingPaymentOrder(order)) return unpaidOrderReply(order);
  return `Order ${orderLabel(order)} is **${statusLabel(order)}**. Tap the tracking button below for live updates. If that doesn't match what you're seeing, I can open a ticket.`;
}

export function deliveryReply(order: Order): string {
  if (isAwaitingPaymentOrder(order)) return unpaidOrderReply(order);
  const driver = order.driver?.name?.trim();
  const who = driver ? ` Your driver is **${driver}**.` : '';
  return `Order ${orderLabel(order)} is **${statusLabel(order)}**.${who} Open live tracking for the latest location. If it's late or something is wrong with the delivery, I can open a ticket for a human teammate.`;
}

export function paymentReply(order: Order): string {
  const payment = order.paymentStatus ?? 'pending';
  const reference = orderLabel(order);
  switch (payment) {
    case 'completed':
      return `Payment for ${reference} is **confirmed**. If the amount looks wrong, I won't guess — I can open a ticket so a teammate can check the receipt.`;
    case 'failed':
      return `The payment for ${reference} did **not** go through. No money should have been taken. You can try paying again from the order; if you were charged anyway, I'll open a ticket.`;
    case 'refunded':
    case 'partially_refunded':
      return `A refund is recorded for ${reference}. Refund decisions need a human teammate, so I'll open a ticket if you'd like us to review it.`;
    case 'processing':
      return `Payment for ${reference} is still being confirmed. Please don't pay a second time yet — I can open a ticket if it stays this way.`;
    default:
      return `Payment for ${reference} is still **awaiting confirmation**. Please don't pay a second time yet. If you're stuck, I can open a ticket.`;
  }
}

export function cancellationReply(order: Order): string {
  const reference = orderLabel(order);
  if (orderStatusHelpers.isTerminal(order.status)) {
    return `Order ${reference} is already **${statusLabel(order)}**, so it can't be cancelled. If something is wrong, I can open a ticket for a human teammate.`;
  }
  if (order.status === 'awaiting_payment' || order.status === 'pending') {
    return `Order ${reference} is unpaid, so it can be cancelled safely. I won't cancel it without your say-so — use the cancellation option on the order, or ask me to open a ticket and I'll help.`;
  }
  if (order.status === 'out_for_delivery' || order.status === 'arrived') {
    return `Order ${reference} is **${statusLabel(order)}**. Cancellation may be limited at this stage. I can open a ticket so a teammate can check what's possible.`;
  }
  return `Order ${reference} is **${statusLabel(order)}**. I can open a ticket so a teammate can help with cancellation — I won't change the order by myself.`;
}

export function replyForTopic(topic: SupportTopic, order: Order): string {
  switch (topic) {
    case 'order_status':
      return orderStatusReply(order);
    case 'delivery':
      return deliveryReply(order);
    case 'payment':
      return paymentReply(order);
    case 'cancellation':
      return cancellationReply(order);
    default:
      return `I can see ${orderLabel(order)}. A human teammate can help from here — I'll open a ticket with this chat and the order details.`;
  }
}

/** Unpaid orders from newest to oldest, capped for a short chat reply. */
export function unpaidOrders(orders: Order[]): Order[] {
  return orders.filter(isAwaitingPaymentOrder).slice(0, 6);
}

export interface TopicOrderView {
  visible: Order[];
  trackable: Order[];
  awaitingPayment: Order[];
  text: string;
}

/**
 * Pure view model for Ask Q order lists. Tracking is only offered for orders
 * that have actually been paid — an awaiting_payment order is shown with an
 * explanation instead of a button that leads to a live tracking screen.
 */
export function buildTopicOrderView(
  topic: SupportTopic,
  orders: Order[],
  formatCurrency: (amount: number) => string
): TopicOrderView {
  const isTrackingTopic = topic === 'order_status' || topic === 'delivery';
  const active = orders.filter(
    (order) => !orderStatusHelpers.isTerminal(orderStatusFromDatabaseValue(order.status))
  );
  const source = isTrackingTopic ? active : orders.filter(isRecentOrder);
  const visible = source.slice(0, 6);
  const awaitingPayment = visible.filter(isAwaitingPaymentOrder);
  const trackable = visible.filter(canTrackOrder);

  const lines = visible.map((order) => {
    const prefix = `• ${orderLabel(order)} — **${statusLabel(order)}**`;
    if (isTrackingTopic && isAwaitingPaymentOrder(order)) {
      return `${prefix} · payment not completed — no tracking yet`;
    }
    if (topic === 'payment') return `${prefix} · payment ${order.paymentStatus ?? 'pending'}`;
    if (topic === 'delivery' && order.driver?.name) return `${prefix} · driver ${order.driver.name}`;
    return `${prefix} · ${formatCurrency(order.total)}`;
  });

  const intros: Record<SupportTopic, string> = {
    order_status: awaitingPayment.length
      ? "Here's what I can see. An order awaiting payment has no live tracking until payment is completed:"
      : "Here's what I can see for your active orders:",
    delivery: awaitingPayment.length
      ? "Here's the latest I have. An unpaid order has nothing to track yet — complete payment first. Paid orders can be opened for live movement."
      : "Here's the latest I have for delivery. Open tracking for live movement — if something looks wrong, pick the order and I'll open a ticket.",
    payment:
      "I can see your recent payment states. I won't guess at bank or card details — pick the order and I'll help or open a ticket.",
    cancellation:
      "I can check whether an order looks cancellable, but I won't change it without your go-ahead. Pick the order below.",
    other:
      "I can bring in a human teammate. Pick the order this is about, or add more detail below and I'll open a ticket.",
  };

  return {
    visible,
    trackable,
    awaitingPayment,
    text: `${intros[topic]}\n${lines.join('\n')}`,
  };
}

export function buildTicketSubject(topic: SupportTopic, order?: Order | null): string {
  const label = SUPPORT_TOPIC_LABELS[topic];
  return order ? `${label} · ${orderLabel(order)}` : `${label} · Queless support`;
}

export function buildTicketDescription(
  topic: SupportTopic,
  details: string,
  order?: Order | null
): string {
  const parts: string[] = [details.trim() || 'The customer asked for help from Ask Q.'];
  if (order) {
    parts.push(
      [
        `Order ${orderLabel(order)}`,
        `Status: ${statusLabel(order)}`,
        `Payment: ${order.paymentStatus ?? 'pending'}`,
        `Total: R${Number(order.total || 0).toFixed(2)}`,
      ].join('\n')
    );
  }
  parts.push(`Raised by Q (virtual support assistant). Category: ${SUPPORT_TOPIC_LABELS[topic]}.`);
  return parts.join('\n\n').slice(0, 4000);
}

export function buildFaqReply(question: string, articles: { question: string; answer: string }[]): string | null {
  const n = normalizeSupportText(question);
  if (!n || articles.length === 0) return null;
  const match = articles.find((article) => {
    const q = normalizeSupportText(article.question);
    return n.includes(q) || q.includes(n) || q.split(' ').every((word) => word.length > 3 && n.includes(word));
  });
  return match ? `${match.answer}\n\nThis came from the Queless help centre. Need more help? I can open a ticket.` : null;
}
