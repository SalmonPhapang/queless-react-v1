import { PaymentStatus } from './statuses';

export type PaymentMethodType = 'card' | 'cashOnDelivery' | 'eft' | 'instantEft' | 'capitecPay';

export interface PaystackInitResponse {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  paymentMethod: PaymentMethodType;
  status: PaymentStatus;
  reference?: string;
  createdAt: string;
}
