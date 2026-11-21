import { supabase } from '../config/supabaseClient';
import { appConfig } from '../config/appConfig';
import { PaystackInitResponse, PaymentRecord } from '../models/payment';
import { paymentStatusFromDatabaseValue } from '../models/statuses';
import { PaymentMethodCode } from '../utils/paymentMethod';
import { orderService } from './orderService';

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

interface PaymentRow {
  id: string;
  order_id: string;
  user_id: string;
  amount: number | string;
  payment_method: string;
  provider: string;
  status: string;
  payment_reference: string | null;
  transaction_id: string | null;
  created_at: string;
}

const mapPayment = (row: PaymentRow): PaymentRecord => ({
  id: row.id,
  orderId: row.order_id,
  userId: row.user_id,
  amount: Number(row.amount),
  paymentMethod: row.payment_method as PaymentRecord['paymentMethod'],
  status: row.status as PaymentRecord['status'],
  reference: row.payment_reference ?? undefined,
  createdAt: row.created_at,
});

export const paymentService = {
  /**
   * One payment row per order (the table enforces it). An existing unpaid row
   * is reused and given a fresh Paystack reference, because Paystack rejects a
   * duplicate reference when the customer retries.
   *
   * Cash on delivery settles immediately (no gateway). Card and Instant EFT
   * each use their own Paystack Checkout channel; Capitec Pay uses a
   * Capitec-only authorization URL.
   */
  async createPayment(params: {
    orderId: string;
    amount: number;
    method: PaymentMethodCode;
  }): Promise<PaymentRecord> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      throw new PaymentError('Please sign in to continue to payment.');
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', params.orderId)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      throw new PaymentError(existingError.message);
    }

    const existing = (existingRows as PaymentRow | null) ?? null;
    if (existing?.status === 'completed') return mapPayment(existing);

    const reference = `QUE${Date.now()}`;
    const now = new Date().toISOString();

    if (params.method === 'cashOnDelivery') {
      const settled = {
        status: 'completed',
        transaction_id: 'CASH_ON_DELIVERY',
        updated_at: now,
      };

      const row = existing
        ? await this.updatePayment(existing.id, settled)
        : await this.insertPayment({
            order_id: params.orderId,
            user_id: user.id,
            amount: params.amount,
            payment_method: params.method,
            provider: 'manual',
            status: 'completed',
            payment_reference: reference,
            transaction_id: settled.transaction_id,
            metadata: { payment_reference: reference, provider: 'manual' },
            created_at: now,
            updated_at: now,
          });

      await orderService.syncOrderAfterPayment(params.orderId, 'completed', user.id);
      return mapPayment(row);
    }

    const row = existing
      ? await this.updatePayment(existing.id, {
          status: 'pending',
          payment_reference: reference,
          transaction_id: null,
          updated_at: now,
        })
      : await this.insertPayment({
          order_id: params.orderId,
          user_id: user.id,
          amount: params.amount,
          payment_method: params.method,
          provider: 'paystack',
          status: 'pending',
          payment_reference: reference,
          metadata: { payment_reference: reference, provider: 'paystack' },
          created_at: now,
          updated_at: now,
        });

    return mapPayment(row);
  },

  async insertPayment(payload: Record<string, unknown>): Promise<PaymentRow> {
    const { data, error } = await supabase
      .from('payments')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw new PaymentError(error?.message || 'Could not start the payment.');
    }
    return data as PaymentRow;
  },

  async updatePayment(payloadId: string, updates: Record<string, unknown>): Promise<PaymentRow> {
    const { data, error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', payloadId)
      .select('*')
      .single();

    if (error || !data) {
      throw new PaymentError(error?.message || 'Could not update the payment.');
    }
    return data as PaymentRow;
  },

  /**
   * initialize-paystack-split takes the payment row id and reads the amount,
   * reference and user from the database. No mock checkout URL is returned: if
   * the function fails, checkout surfaces the real error.
   */
  async initializePaystackPayment(paymentId: string): Promise<PaystackInitResponse> {
    const { data, error } = await supabase.functions.invoke('initialize-paystack-split', {
      body: { payment_id: paymentId, is_debug: appConfig.env !== 'prod' },
    });

    if (error) {
      throw new PaymentError(error.message || 'Could not start the payment.');
    }
    const response = data as Record<string, any> | null;
    if (!response?.status || !response?.data?.authorization_url) {
      throw new PaymentError(
        response?.message || response?.error || 'We could not start the payment. Please try again.'
      );
    }

    return {
      authorizationUrl: response.data.authorization_url as string,
      accessCode: (response.data.access_code as string) ?? '',
      reference: (response.data.reference as string) ?? '',
    };
  },

  /**
   * verify-paystack-split is the authority: it checks the transaction with
   * Paystack and updates both the payment and the order rows server-side. The
   * client no longer writes orders.payment_status itself for card payments.
   */
  async verifyPaystackPayment(
    paymentId: string,
    reference?: string
  ): Promise<{ paid: boolean; paymentStatus: string; orderStatus: string }> {
    const { data, error } = await supabase.functions.invoke('verify-paystack-split', {
      body: {
        payment_id: paymentId,
        ...(reference ? { reference } : {}),
        is_debug: appConfig.env !== 'prod',
      },
    });

    if (error) {
      throw new PaymentError(error.message || 'Could not verify the payment.');
    }

    const response = data as Record<string, any> | null;
    if (!response?.status) {
      throw new PaymentError(response?.message || 'Payment could not be verified.');
    }

    // The edge function reports Paystack's own camelCase values
    // ('completed' / 'awaitingPayment'); normalise them to the shared model's
    // canonical database values so the app never mixes the two dialects.
    const paymentStatus = paymentStatusFromDatabaseValue(
      response.data?.payment_status as string | undefined
    );

    return {
      paid: paymentStatus === 'completed',
      paymentStatus,
      orderStatus: (response.data?.order_status as string) ?? 'awaiting_payment',
    };
  },

  /**
   * Cancel an order whose payment was never confirmed. The edge function
   * re-checks the transaction first; if it completed in the background the
   * caller gets `paid: true` and treats the flow as a success instead.
   */
  async cancelUnpaidPayment(params: {
    paymentId: string;
    orderId: string;
  }): Promise<{ paid: boolean; cancelled: boolean; alreadyCancelled: boolean }> {
    const { data, error } = await supabase.functions.invoke('cancel-unpaid-order', {
      body: {
        payment_id: params.paymentId,
        order_id: params.orderId,
        is_debug: appConfig.env !== 'prod',
      },
    });

    if (error) {
      const context = (error as any)?.context as Response | undefined;
      let serverMessage = '';
      if (context && typeof context.json === 'function') {
        try {
          const payload = (await context.json()) as { error?: string };
          serverMessage = payload?.error ?? '';
        } catch {
          // Fall through to the generic message below.
        }
      }
      const message = serverMessage || error.message || '';
      if (message.includes('Order can no longer be cancelled')) {
        throw new PaymentError('This order can no longer be cancelled from here. Check your Orders tab.');
      }
      if (message.includes('confirm the payment status')) {
        throw new PaymentError('We could not confirm the payment yet. Please try again.');
      }
      throw new PaymentError('We could not cancel this order. Please try again.');
    }

    const response = data as Record<string, any> | null;
    if (!response?.status) {
      throw new PaymentError(response?.error || 'We could not cancel this order. Please try again.');
    }

    return {
      paid: response.paid === true,
      cancelled: response.cancelled === true,
      alreadyCancelled: response.already_cancelled === true,
    };
  },

  async getPaymentByOrderId(orderId: string): Promise<PaymentRecord | null> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error || !data) return null;
    return mapPayment(data as PaymentRow);
  },
};
