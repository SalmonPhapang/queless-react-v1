export interface PromoCode {
  id: string;
  code: string;
  discountPercentage?: number;
  flatDiscount?: number;
  minSpend?: number;
  maxDiscount?: number;
  expiresAt?: string;
  isActive: boolean;
}
