import { Address } from './user';
import { SelectedOption } from './product';
import { DriverInfo, TrackingUpdate } from './core/orderCommon';
import { OrderStatus, PaymentStatus } from './statuses';

export interface OrderItem {
  productId: string;
  productName: string;
  productImageUrl: string;
  quantity: number;
  pricePerUnit: number;
  basePricePerUnit: number;
  basePriceAdjustment: number;
  totalPrice: number;
  selectedOptions: SelectedOption[];
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  storeId: string;
  storeName?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  deliveryAddress: Address;
  createdAt: string;
  updatedAt: string;
  aiAssisted?: boolean;
  aiConversationId?: string;
  paymentMethod?: string;
  paymentStatus?: PaymentStatus;
  trackingUpdates?: TrackingUpdate[];
  driverId?: string;
  driver?: DriverInfo | null;
}
