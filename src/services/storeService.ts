import { supabase } from '../config/supabaseClient';
import { Store } from '../models/store';
import { Product, customerPriceFromBasePrice } from '../models/product';
import { locationService } from './locationService';
import { parseLatLngText } from '../utils/geo';
import { sortStoresByAvailabilityAndDistance } from '../utils/storeSort';

export const storeService = {
  async getStores(options?: {
    category?: string;
    searchQuery?: string;
    isAlcohol?: boolean;
    limit?: number;
    /** Only stores that accept delivery orders (checkout rejects the rest). */
    deliveryOnly?: boolean;
  }): Promise<Store[]> {
    let query = supabase.from('stores').select('*').eq('is_approved', true);

    if (options?.category && options.category !== 'All') {
      query = query.eq('category', options.category);
    }
    if (options?.isAlcohol !== undefined) {
      query = query.eq('is_alcohol', options.isAlcohol);
    }
    if (options?.deliveryOnly) {
      query = query.eq('delivery_enabled', true);
    }
    if (options?.searchQuery) {
      query = query.ilike('name', `%${options.searchQuery}%`);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data) return [];

    return sortStoresByAvailabilityAndDistance(data.map(this.mapStoreRecord));
  },

  async getStoreById(id: string): Promise<Store | null> {
    const { data, error } = await supabase.from('stores').select('*').eq('id', id).single();
    if (error || !data) return null;
    return this.mapStoreRecord(data);
  },

  async getStoreProducts(storeId: string, category?: string, searchQuery?: string): Promise<Product[]> {
    let query = supabase.from('products').select('*').eq('store_id', storeId);

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }
    if (searchQuery) {
      query = query.ilike('name', `%${searchQuery}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data) return [];

    return data.map(this.mapProductRecord);
  },

  async getProductById(productId: string): Promise<Product | null> {
    const { data, error } = await supabase.from('products').select('*').eq('id', productId).single();
    if (error || !data) return null;
    return this.mapProductRecord(data);
  },

  /** Stores with a real distance from the given point, nearest first. */
  async getNearbyStores(lat: number, lng: number, radiusKm: number = 20): Promise<Store[]> {
    const stores = await this.getStores({ deliveryOnly: true });
    const withDistance: Store[] = [];

    for (const store of stores) {
      const point = store.coordinates;
      if (!point) continue;

      withDistance.push({
        ...store,
        distance: locationService.calculateDistanceKm(
          lat,
          lng,
          point.latitude,
          point.longitude
        ),
      });
    }

    return sortStoresByAvailabilityAndDistance(
      withDistance.filter((store) => (store.distance ?? Infinity) <= radiusKm)
    );
  },

  mapStoreRecord(data: any): Store {
    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      imageUrl: data.image_url || '',
      category: data.category || 'General',
      cuisineTypes: data.cuisine_types || [],
      rating: Number(data.rating || 4.5),
      totalReviews: data.total_reviews || 0,
      deliveryTimeMin: data.delivery_time_min || 20,
      deliveryTimeMax: data.delivery_time_max || 40,
      deliveryFee: Number(data.delivery_fee || 15.0),
      minimumOrder: Number(data.minimum_order || 0.0),
      isOpen: data.is_open ?? true,
      operatingHours: data.operating_hours || {},
      address: data.address || '',
      location: data.location || '',
      // Server geo guard uses stores.location ("lat,lng") text.
      coordinates: parseLatLngText(data.location),
      phone: data.phone || '',
      tags: data.tags || [],
      createdAt: data.created_at || new Date().toISOString(),
      updatedAt: data.updated_at || new Date().toISOString(),
      nextOpeningTime: data.next_opening_time,
      distance: data.distance,
      isApproved: data.is_approved ?? true,
      subaccountCode: data.subaccount_code,
      isAlcohol: data.is_alcohol ?? false,
      acceptedPaymentMethods: data.accepted_payment_methods || ['eft'],
    };
  },

  mapProductRecord(data: any): Product {
    // products.price is the vendor's base price. The customer-facing price adds
    // the platform margin exactly like the Flutter app and budget planner.
    const basePrice = Number(data.price ?? data.base_price ?? 0);
    const priceWithFee = customerPriceFromBasePrice(basePrice);

    return {
      id: data.id,
      name: data.name,
      category: data.category || 'General',
      brand: data.brand,
      description: data.description || '',
      basePrice,
      price: priceWithFee,
      imageUrl: data.image_url || '',
      alcoholContent: data.alcohol_content,
      volume: data.volume,
      isLocalBrand: data.is_local_brand ?? false,
      tags: data.tags || [],
      productType: data.product_type || 'food',
      storeId: data.store_id,
      stock: data.stock || 100,
      createdAt: data.created_at || new Date().toISOString(),
      updatedAt: data.updated_at || new Date().toISOString(),
      optionGroups: (data.option_groups || []).map((og: any) => ({
        name: og.name,
        isRequired: og.is_required || og.isRequired || false,
        multiSelect: og.multi_select || og.multiSelect || false,
        options: (og.options || []).map((opt: any) => ({
          name: opt.name,
          price: Number(opt.price || 0),
        })),
      })),
    };
  },
};
