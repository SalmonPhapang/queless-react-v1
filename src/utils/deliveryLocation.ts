import { Address } from '../models/user';

/** Saved addresses created before geocoding can contain 0/0 placeholders. */
export const hasUsableCoordinates = (address: Address | null | undefined): boolean => {
  if (!address) return false;
  const { latitude, longitude } = address;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return !(latitude === 0 && longitude === 0);
};

/**
 * The Flutter app falls back to the default address, then the first saved one.
 * Keeping this as a pure helper makes that order explicit and testable.
 */
export const pickDeliveryAddress = (addresses: Address[]): Address | null => {
  if (addresses.length === 0) return null;
  return (
    addresses.find((address) => address.isDefault) ??
    addresses[0] ??
    null
  );
};
