export interface Address {
  id: string;
  userId: string;
  label: string;
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  ageVerified: boolean;
  idDocumentUrl?: string;
  addresses: Address[];
  favoriteProducts: string[];
  createdAt: string;
  updatedAt: string;
}
