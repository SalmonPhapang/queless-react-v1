import { Address } from '../models/user';

const EMPTY_VALUES = new Set(['', 'undefined', 'null', 'nan']);

/** Turns database values such as undefined/null/"undefined" into safe text. */
export const cleanText = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  return EMPTY_VALUES.has(text.toLowerCase()) ? '' : text;
};

const cleanNumber = (value: unknown): number => {
  const text = cleanText(value);
  if (!text) return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pick = (record: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' || cleanText(value) !== '') return value;
  }
  return undefined;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
};

export const emptyAddress = (userId = ''): Address => ({
  id: '',
  userId,
  label: '',
  streetAddress: '',
  city: '',
  province: '',
  postalCode: '',
  latitude: 0,
  longitude: 0,
  isDefault: false,
});

/**
 * Supabase stores addresses as jsonb using snake_case, while older clients and
 * the app model use camelCase. Normalise both shapes here so no screen renders
 * the literal word "undefined".
 */
export const mapAddressRecord = (raw: unknown, userId = ''): Address | null => {
  let source = raw;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      return null;
    }
  }

  const record = asRecord(source);
  const streetAddress = cleanText(pick(record, 'streetAddress', 'street_address'));
  const city = cleanText(pick(record, 'city'));
  const label = cleanText(pick(record, 'label', 'name'));
  if (!streetAddress && !city && !label) return null;

  const defaultFlag = pick(record, 'isDefault', 'is_default');

  return {
    id: cleanText(pick(record, 'id')),
    userId: cleanText(pick(record, 'userId', 'user_id')) || userId,
    label: label || 'Delivery',
    streetAddress,
    city,
    province: cleanText(pick(record, 'province', 'state')),
    postalCode: cleanText(pick(record, 'postalCode', 'postal_code')),
    latitude: cleanNumber(pick(record, 'latitude', 'lat')),
    longitude: cleanNumber(pick(record, 'longitude', 'lng', 'long')),
    isDefault:
      defaultFlag === true ||
      cleanText(defaultFlag).toLowerCase() === 'true',
  };
};

export const mapAddresses = (raw: unknown, userId = ''): Address[] => {
  let list = raw;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];

  return list
    .map((item) => mapAddressRecord(item, userId))
    .filter((item): item is Address => item !== null);
};

/** Human-readable address with no "undefined" fragments. */
export const formatAddress = (
  address: Address | null | undefined,
  fallback = 'Add delivery address'
): string => {
  if (!address) return fallback;

  const parts = [
    address.streetAddress,
    address.city,
    address.province,
    address.postalCode,
  ]
    .map(cleanText)
    .filter(Boolean);

  if (parts.length > 0) return parts.join(', ');
  return cleanText(address.label) || fallback;
};
