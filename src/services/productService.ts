import { supabase } from '../config/supabaseClient';
import { Product } from '../models/product';
import { storeService } from './storeService';

/**
 * Port of lib/services/product_service.dart. The Flutter version fronts the
 * same table with CacheService; here Supabase queries are used directly and a
 * failed request degrades to an empty list so screens can render their empty
 * state instead of crashing.
 */
export const productService = {
  async getAllProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Error loading products:', error?.message);
      return [];
    }
    return data.map((row) => storeService.mapProductRecord(row));
  },

  async getProductsByCategory(category: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category', category)
      .order('name', { ascending: true });

    if (error || !data) {
      console.warn('Error loading products by category:', error?.message);
      return [];
    }
    return data.map((row) => storeService.mapProductRecord(row));
  },

  async getProductsByStore(storeId: string): Promise<Product[]> {
    return storeService.getStoreProducts(storeId);
  },

  async getProductsByType(productType: 'alcohol' | 'food'): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_type', productType)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Error loading products by type:', error?.message);
      return [];
    }
    return data.map((row) => storeService.mapProductRecord(row));
  },

  async getFeaturedProducts(limit: number = 6): Promise<Product[]> {
    const { data, error } = await supabase.from('products').select('*').limit(limit);
    if (error || !data) {
      console.warn('Error loading featured products:', error?.message);
      return [];
    }
    return data.map((row) => storeService.mapProductRecord(row));
  },

  async getLocalBrandProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_local_brand', true)
      .order('name', { ascending: true });

    if (error || !data) {
      console.warn('Error loading local brand products:', error?.message);
      return [];
    }
    return data.map((row) => storeService.mapProductRecord(row));
  },

  async getProductsByIds(productIds: string[]): Promise<Product[]> {
    if (productIds.length === 0) return [];

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (error || !data) {
      console.warn('Error loading favourite products:', error?.message);
      return [];
    }
    return data.map((row) => storeService.mapProductRecord(row));
  },

  async getProductById(productId: string): Promise<Product | null> {
    return storeService.getProductById(productId);
  },

  async searchProducts(query: string): Promise<Product[]> {
    const products = await this.getAllProducts();
    const lowerQuery = query.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(lowerQuery) ||
        (product.brand?.toLowerCase().includes(lowerQuery) ?? false) ||
        product.description.toLowerCase().includes(lowerQuery) ||
        product.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  },
};
