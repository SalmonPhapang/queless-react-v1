export interface Store {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  cuisineTypes: string[];
  rating: number;
  totalReviews: number;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  deliveryFee: number;
  minimumOrder: number;
  isOpen: boolean;
  operatingHours: Record<string, any>;
  address: string;
  location: string;
  /** Parsed coordinates from `stores.location` ("lat,lng") text. */
  coordinates?: { latitude: number; longitude: number } | null;
  phone: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  nextOpeningTime?: string;
  distance?: number;
  isApproved: boolean;
  subaccountCode?: string;
  isAlcohol: boolean;
  acceptedPaymentMethods: string[];
}
