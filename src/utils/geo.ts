import { calculateDistanceKm as coreCalculateDistanceKm } from '@queless/core/utils';

export { calculateDistanceKm } from '@queless/core/utils';

/** Parse "lat, lng" text from address fields. */
export function parseLatLngText(value?: string | null): { latitude: number; longitude: number } | null {
  if (!value) return null;
  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2 || !parts.every(Number.isFinite)) return null;
  const [latitude, longitude] = parts as [number, number];
  return { latitude, longitude };
}

export const distanceBetween = coreCalculateDistanceKm;
