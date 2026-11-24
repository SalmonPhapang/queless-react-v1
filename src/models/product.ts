export type ProductType = 'alcohol' | 'food';

export type ProductCategory =
  | 'beer'
  | 'wine'
  | 'spirits'
  | 'mixers'
  | 'snacks'
  | 'food'
  | 'burgers'
  | 'pizza'
  | 'chicken'
  | 'asian'
  | 'desserts'
  | 'drinks'
  | 'groceries';

export interface ProductOption {
  name: string;
  price: number;
}

export interface ProductOptionGroup {
  name: string;
  isRequired: boolean;
  multiSelect: boolean;
  options: ProductOption[];
}

export interface SelectedOption {
  groupName: string;
  optionName: string;
  priceAdjustment: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  brand?: string;
  description: string;
  basePrice: number;
  price: number;
  imageUrl: string;
  alcoholContent?: number;
  volume?: string;
  isLocalBrand: boolean;
  tags: string[];
  productType: ProductType;
  storeId?: string;
  stock: number;
  createdAt: string;
  updatedAt: string;
  optionGroups: ProductOptionGroup[];
}

/** Platform margin applied on top of the vendor's base price. */
export const PRODUCT_FEE_RATE = 0.125;

/**
 * Customer-facing price for a vendor base price.
 *
 * Mirrors the Flutter app and the server's budget planner:
 *   floor(base * (1 + feeRate)) + 0.99
 *
 * The database `products.price` column is the vendor base price. Never treat it
 * as the customer price or the platform margin is silently deducted from the
 * store instead of added to the order.
 */
export const customerPriceFromBasePrice = (basePrice: number): number => {
  const safeBase = Number.isFinite(basePrice) ? Math.max(basePrice, 0) : 0;
  return Math.floor(safeBase * (1 + PRODUCT_FEE_RATE)) + 0.99;
};
