import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '../src/models/order';
import type { PaymentStatus } from '../src/models/statuses';
import {
  ASSISTANT_DISCLOSURE,
  buildFaqReply,
  buildTicketDescription,
  buildTicketSubject,
  detectSupportTopic,
  paymentReply,
  replyForTopic,
  SUPPORT_UNAVAILABLE_REPLY,
  supportCategoryFromIssueLabel,
} from '../src/utils/supportChat';

const makeOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 'order-123',
    orderNumber: 'QLE-ABC123',
    userId: 'user-1',
    storeId: 'store-1',
    storeName: 'Queless Kitchen',
    items: [],
    subtotal: 100,
    deliveryFee: 20,
    discount: 0,
    total: 120,
    status: 'out_for_delivery',
    deliveryAddress: {} as Order['deliveryAddress'],
    createdAt: '2026-11-21T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
    paymentStatus: 'completed',
    driver: { name: 'Thabo', phone: '' },
    ...overrides,
  }) as Order;

test('support intents stay inside the v1 scope and route humans safely', () => {
  assert.equal(detectSupportTopic('Where is my order?'), 'order_status');
  assert.equal(detectSupportTopic('My driver is late'), 'delivery');
  assert.equal(detectSupportTopic('I was charged twice'), 'payment');
  assert.equal(detectSupportTopic('Please cancel order QLE-ABC123'), 'cancellation');
  assert.equal(detectSupportTopic('I want a refund'), 'other');
  assert.equal(detectSupportTopic('Can I speak to a human?'), 'other');
  assert.equal(detectSupportTopic('Find me a burger'), null);
});

test('issue chips map to ticket categories', () => {
  assert.equal(supportCategoryFromIssueLabel('Order status'), 'order_status');
  assert.equal(supportCategoryFromIssueLabel('Delivery'), 'delivery');
  assert.equal(supportCategoryFromIssueLabel('Payment'), 'payment');
  assert.equal(supportCategoryFromIssueLabel('Cancellation'), 'cancellation');
  assert.equal(supportCategoryFromIssueLabel('Something else'), 'other');
});

test('support replies are read-only and never promise a refund or cancellation', () => {
  const order = makeOrder();
  const cancellation = replyForTopic('cancellation', order);
  assert.match(cancellation, /can open a ticket/i);
  assert.doesNotMatch(cancellation, /I have cancelled|I cancelled|refund issued/i);

  const paid = paymentReply(order);
  assert.match(paid, /confirmed/i);
  assert.doesNotMatch(paid, /I have refunded|you will be refunded/i);

  const failed = paymentReply(makeOrder({ paymentStatus: 'failed' as PaymentStatus }));
  assert.match(failed, /did \*\*not\*\* go through/i);

  const delivered = replyForTopic('cancellation', makeOrder({ status: 'delivered' }));
  assert.match(delivered, /can't be cancelled/i);
});

test('assistant identity is warm and honest about being virtual', () => {
  assert.match(ASSISTANT_DISCLOSURE, /virtual support assistant/i);
  assert.match(ASSISTANT_DISCLOSURE, /Q/);
});

test('unavailable fallback is honest and points to an in-app ticket', () => {
  assert.match(SUPPORT_UNAVAILABLE_REPLY, /virtual support assistant/i);
  assert.match(SUPPORT_UNAVAILABLE_REPLY, /won't guess/i);
  assert.match(SUPPORT_UNAVAILABLE_REPLY, /in-app support ticket/i);
  assert.doesNotMatch(SUPPORT_UNAVAILABLE_REPLY, /ai_prod|added to cart|refund issued|cancelled/i);
});

test('no support reply promises a refund, compensation or a delivery outcome', () => {
  const statuses = ['pending', 'awaiting_payment', 'preparing', 'out_for_delivery', 'delivered'] as const;
  const payments: PaymentStatus[] = ['pending', 'awaiting_payment', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'];
  const replies: string[] = [];
  for (const status of statuses) {
    for (const paymentStatus of payments) {
      const order = makeOrder({ status, paymentStatus });
      replies.push(
        replyForTopic('order_status', order),
        replyForTopic('delivery', order),
        replyForTopic('payment', order),
        replyForTopic('cancellation', order),
      );
    }
  }
  for (const reply of replies) {
    assert.doesNotMatch(reply, /I (have|will) (cancel|refund|issue|promise)|you will be refunded|guaranteed delivery|compensation approved/i);
  }
});

test('ticket payloads carry read-only order context, but no address or owner identity', () => {
  const order = makeOrder();
  const subject = buildTicketSubject('delivery', order);
  const description = buildTicketDescription('delivery', 'Driver drove past my street.', order);
  assert.match(subject, /Delivery/);
  assert.match(subject, /QLE-ABC123/);
  assert.match(description, /Driver drove past my street/);
  assert.match(description, /Status: Out for Delivery/);
  assert.match(description, /Payment: completed/);
  assert.doesNotMatch(description, /deliveryAddress|street address|user-1/i);
  assert.doesNotMatch(description, /I (have|will) cancel|refund issued|replacement approved/i);
});

test('FAQ and order-issue routing stay separate', () => {
  const articles = [
    { question: 'How long does delivery take?', answer: 'Most deliveries take 30-60 minutes.' },
    { question: 'How do I track my order?', answer: 'Use the Orders tab.' },
  ];
  assert.match(buildFaqReply('How long does delivery take?', articles) ?? '', /30-60 minutes/);
  assert.match(buildFaqReply('track my order', articles) ?? '', /Orders tab/);
  assert.equal(buildFaqReply('Do you sell candles?', articles), null);

  assert.equal(detectSupportTopic('How long does delivery take?'), 'delivery');
  assert.equal(detectSupportTopic('Track my order'), 'order_status');
  assert.equal(detectSupportTopic('I was charged twice'), 'payment');
  assert.equal(detectSupportTopic('Please cancel order QLE-ABC123'), 'cancellation');
  assert.equal(detectSupportTopic('Find me a burger'), null);
});
