import { authService } from './authService';
import { locationService, LocationCoords } from './locationService';
import { Address } from '../models/user';
import { cleanText, formatAddress } from '../utils/address';
import { hasUsableCoordinates, pickDeliveryAddress } from '../utils/deliveryLocation';

export type DeliveryLocationSource = 'current' | 'saved' | 'none';

export interface DeliveryLocation {
  /** Usable point for distance ranking, or null when nothing can be located. */
  coords: LocationCoords | null;
  /** Saved address used for the fallback, when there was no GPS fix. */
  address: Address | null;
  /** Short label for the "Deliver to" header (e.g. street/house number). */
  shortLabel: string;
  /** Full human-readable address for details/modals. */
  fullAddress: string;
  /** Backward-compatible label (same as shortLabel). */
  label: string;
  source: DeliveryLocationSource;
}

const hasStreetNumber = (value: string): boolean => /\d/.test(value);

export const getDeliveryShortLabel = (value: string, fallback = 'Current location'): string => {
  const text = cleanText(value);
  if (!text) return fallback;
  if (text.toLowerCase() === 'current location') return fallback;

  const segments = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const first = segments[0] || text;
  if (hasStreetNumber(first)) return first;

  // No house/street number detected (common for coarse current-location results):
  // include the next segment for more useful context when available.
  if (segments[1]) return `${first}, ${segments[1]}`;
  return first || fallback;
};

/**
 * The delivery choice made on Home/Liquor Home is kept here so Checkout uses
 * the same address instead of silently falling back to the profile default.
 */
let activeLocation: DeliveryLocation | null = null;
/**
 * True when the user explicitly picked an address/current location. An explicit
 * saved address must not be replaced when another tab re-resolves the GPS fix.
 */
let explicitSelection = false;

const noneLocation = (): DeliveryLocation => ({
  coords: null,
  address: null,
  shortLabel: 'Add delivery address',
  fullAddress: 'No delivery address selected',
  label: 'Add delivery address',
  source: 'none',
});

const buildSavedLocation = (saved: Address): DeliveryLocation => {
  const fullAddress = formatAddress(saved, saved.label || 'Saved address');
  const street = cleanText(saved.streetAddress);
  const shortLabel =
    (street && hasStreetNumber(street) ? street : '') ||
    street ||
    cleanText(saved.label) ||
    getDeliveryShortLabel(fullAddress, 'Saved address');
  return {
    coords: hasUsableCoordinates(saved)
      ? { latitude: saved.latitude, longitude: saved.longitude }
      : null,
    address: saved,
    shortLabel,
    fullAddress,
    label: shortLabel,
    source: 'saved',
  };
};

export const deliveryLocationFromAddress = (saved: Address): DeliveryLocation =>
  buildSavedLocation(saved);

const buildCurrentLocationFrom = (
  coords: LocationCoords,
  fullAddress?: string
): DeliveryLocation => {
  const resolved = cleanText(fullAddress) || 'Current location';
  const shortLabel = getDeliveryShortLabel(resolved, 'Current location');
  return {
    coords,
    address: null,
    shortLabel,
    fullAddress: resolved,
    label: shortLabel,
    source: 'current',
  };
};

/** Build the active delivery location from a fix that was already obtained. */
export const deliveryLocationFromCurrent = (
  coords: LocationCoords,
  fullAddress?: string
): DeliveryLocation => buildCurrentLocationFrom(coords, fullAddress);

const buildCurrentLocation = async (
  options: { forceRefresh?: boolean } = {}
): Promise<DeliveryLocation> => {
  const current = await locationService.getCurrentLocation(options);
  if (!current) return noneLocation();

  const resolved = await locationService
    .getAddressFromCoordinates(current.latitude, current.longitude)
    .catch(() => 'Current location');
  return buildCurrentLocationFrom(current, resolved);
};

const setResolvedActive = (
  location: DeliveryLocation,
  explicit: boolean
): DeliveryLocation => {
  activeLocation = location;
  explicitSelection = explicit && location.source !== 'none';
  return location;
};

const resolveLocation = async (
  options: { forceRefresh?: boolean } = {}
): Promise<DeliveryLocation> => {
  // Once the user chooses a saved address, a later GPS fix in another tab must
  // not silently change the order's delivery address back to current location.
  if (explicitSelection && activeLocation?.source === 'saved') return activeLocation;

  const current = await buildCurrentLocation(options);
  if (current.source === 'current') {
    return setResolvedActive(
      current,
      explicitSelection && activeLocation?.source === 'current'
    );
  }

  // If the user explicitly chose current location but GPS is temporarily
  // unavailable, keep that choice instead of falling back to the profile default.
  if (explicitSelection && activeLocation) return activeLocation;

  const user = await authService.getCurrentSessionUser().catch(() => null);
  const saved = pickDeliveryAddress(user?.addresses ?? []);
  if (saved) return setResolvedActive(buildSavedLocation(saved), false);

  return setResolvedActive(current, false);
};

/**
 * Turns the active device-location choice into an Address the order can store.
 * There is no saved row for "current location", so the reverse-geocoded text
 * becomes the address fields and the GPS point stays authoritative for the
 * server geo guard.
 */
export const addressFromDeliveryLocation = (
  location: DeliveryLocation | null,
  userId = ''
): Address | null => {
  if (!location) return null;
  if (location.source === 'saved' && location.address) return location.address;
  if (location.source !== 'current' || !location.coords) return null;

  const segments = location.fullAddress
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const last = segments[segments.length - 1] || '';

  return {
    id: 'current_location',
    userId,
    label: 'Current location',
    streetAddress: segments[0] || location.shortLabel || 'Current location',
    city: segments[1] || '',
    province: segments[2] || '',
    postalCode: /^\d+$/.test(last) ? last : '',
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    isDefault: false,
  };
};

/**
 * Single resolution path for "where are we delivering?".
 *
 * 1. Try the device's current location.
 * 2. If that is unavailable, use the user's default address, then their first
 *    saved address (the same order Flutter uses).
 * 3. Otherwise return no point so callers can list all stores instead of
 *    inventing coordinates.
 *
 * An explicit choice from the address modal wins until the user changes it.
 * Every resolve keeps the shared active selection used by Checkout in sync.
 */
export const deliveryLocationService = {
  async resolve(options: { forceRefresh?: boolean } = {}): Promise<DeliveryLocation> {
    return resolveLocation(options);
  },

  /** Record an explicit choice from the Home delivery-address modal. */
  setActive(location: DeliveryLocation | null, explicit = true): void {
    activeLocation = location;
    explicitSelection = explicit && !!location && location.source !== 'none';
  },

  getActive(): DeliveryLocation | null {
    return activeLocation;
  },

  /** Address Checkout should send with the order (null means use fallback). */
  getActiveAddress(userId = ''): Address | null {
    return addressFromDeliveryLocation(activeLocation, userId);
  },
};
