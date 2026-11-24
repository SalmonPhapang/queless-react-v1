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

/**
 * Platform margin and customer price formula.
 * Source of truth: @queless/core (`floor(base * 1.125) + 0.99`).
 */
import { customerPriceFromBasePrice as coreCustomerPriceFromBasePrice } from '@queless/core/utils';
import { PRODUCT_FEE_RATE as CORE_PRODUCT_FEE_RATE } from '@queless/core/utils';

export const PRODUCT_FEE_RATE = CORE_PRODUCT_FEE_RATE;
export const customerPriceFromBasePrice = coreCustomerPriceFromBasePrice;
