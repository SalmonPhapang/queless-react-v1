import { Store } from '../models/store';
import { calculateDistanceKm, parseLatLngText } from './geo';

declare const __DEV__: boolean | undefined;

export const DELIVERY_MAX_RADIUS_KM = 20;

type LatLng = { latitude: number; longitude: number };

/**
 * Dev-only override so the outside-radius experience can be tested without
 * travelling. It is ignored by production exports (`__DEV__` is false there).
 */
const devTestDistanceKm = (): number | undefined => {
  const isDev = typeof __DEV__ === 'boolean' ? __DEV__ : false;
  if (!isDev) return undefined;

  const raw = process.env.EXPO_PUBLIC_TEST_DELIVERY_DISTANCE_KM;
  if (raw === undefined || raw.trim() === '') return undefined;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};

export const isBeyondDeliveryRadius = (distanceKm?: number | null): boolean =>
  typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm > DELIVERY_MAX_RADIUS_KM;

/**
 * Resolve the distance used for the client-side delivery guard. Prefers an
 * already-measured value, then measures from the active delivery point, and
 * finally applies the dev-only override when present.
 */
export function getStoreDistanceKm(
  store: Pick<Store, 'coordinates' | 'location' | 'distance'>,
  deliveryCoords?: LatLng | null
): number | undefined {
  const override = devTestDistanceKm();
  if (override !== undefined) return override;

  if (typeof store.distance === 'number' && Number.isFinite(store.distance)) {
    return store.distance;
  }

  if (!deliveryCoords) return undefined;

  const point = store.coordinates ?? parseLatLngText(store.location);
  if (!point) return undefined;

  return calculateDistanceKm(
    deliveryCoords.latitude,
    deliveryCoords.longitude,
    point.latitude,
    point.longitude
  );
}
