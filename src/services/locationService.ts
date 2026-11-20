import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { calculateDistanceKm } from '../utils/geo';

/**
 * Port of lib/services/location_service.dart on top of expo-location.
 *
 * Behaviour kept from Flutter:
 *  - permission is checked, and requested when missing;
 *  - a disabled location service or a denied permission yields `null` so
 *    callers can fall back to listing all stores;
 *  - a slow/failed fix falls back to the last known position;
 *  - the last good fix is cached, so several screens mounting at once don't
 *    each wait on the GPS or re-prompt.
 * HMSS (Huawei) and web-specific branches are dropped: expo-location covers
 * the React Native targets this port ships on.
 */

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

const POSITION_TIMEOUT_MS = 15000;
const ADDRESS_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 60_000;
const DESIRED_ACCURACY_M = 20;
const UNKNOWN_ADDRESS = 'Current Location';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Location request timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

let cachedCoords: { at: number; coords: LocationCoords } | null = null;

async function getBestPositionAsync(
  timeoutMs = POSITION_TIMEOUT_MS
): Promise<Location.LocationObject | null> {
  let best: Location.LocationObject | null = null;
  let subscription: Location.LocationSubscription | null = null;

  return await new Promise<Location.LocationObject | null>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        subscription?.remove();
      } catch {
        // ignore
      }
      resolve(best);
    };

    const timer = setTimeout(finish, timeoutMs);

    void (async () => {
      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 0,
            mayShowUserSettingsDialog: false,
          },
          (position) => {
            const currentAcc = position.coords.accuracy ?? Number.POSITIVE_INFINITY;
            const bestAcc = best?.coords.accuracy ?? Number.POSITIVE_INFINITY;

            if (!best || currentAcc <= bestAcc) {
              best = position;
            }

            if (currentAcc <= DESIRED_ACCURACY_M) {
              finish();
            }
          }
        );
      } catch (e) {
        console.warn('Continuous location watch failed:', e);
        if (!best) {
          try {
            best = await withTimeout(
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }),
              timeoutMs
            );
          } catch (fallbackError) {
            console.warn('BestForNavigation one-off position failed:', fallbackError);
          }
        }
        finish();
      }
    })();
  });
}

function formatAddress(place: Location.LocationGeocodedAddress): string {
  const streetNumber = (place.streetNumber || '').trim();
  const streetName = (place.street || place.name || '').trim();
  const street = [streetNumber, streetName].filter(Boolean).join(' ').trim();
  const subLocality = (place.district || place.subregion || '').trim();
  const locality = (place.city || place.subregion || '').trim();

  const parts: string[] = [];
  if (street) parts.push(street);
  if (subLocality && subLocality !== locality) parts.push(subLocality);
  if (locality) parts.push(locality);

  return parts.length > 0 ? parts.join(', ') : UNKNOWN_ADDRESS;
}

export const locationService = {
  /** True when foreground location access has been granted. */
  async hasPermission(): Promise<boolean> {
    try {
      const permission = await withTimeout(Location.getForegroundPermissionsAsync(), 5000);
      return permission.granted;
    } catch (e) {
      console.warn('Location permission check failed:', e);
      return false;
    }
  },

  /** Prompt for foreground location access. */
  async requestPermission(): Promise<boolean> {
    try {
      const permission = await withTimeout(Location.requestForegroundPermissionsAsync(), 10000);
      return permission.granted;
    } catch (e) {
      console.warn('Location permission request failed:', e);
      return false;
    }
  },

  /**
   * Current position, or `null` when location is unavailable (services off,
   * permission denied, no fix and no last known position). Callers should fall
   * back to all stores rather than inventing coordinates.
   *
   * Uses BestForNavigation accuracy and a short continuous watch to improve
   * precision (accepts early once accuracy is good, otherwise keeps the best
   * fix seen before timeout), then falls back to last known position if needed.
   *
   * Coordinates only: reverse geocoding is deliberately not awaited here (no
   * caller needs an address and it used to add seconds to every list load).
   * Use getAddressFromCoordinates when an address is actually needed.
   */
  async getCurrentLocation(options: { forceRefresh?: boolean } = {}): Promise<LocationCoords | null> {
    if (!options.forceRefresh && cachedCoords && Date.now() - cachedCoords.at < CACHE_TTL_MS) {
      return cachedCoords.coords;
    }

    try {
      const servicesEnabled = await withTimeout(Location.hasServicesEnabledAsync(), 5000);
      if (!servicesEnabled) {
        console.warn('Location services are disabled');
        return null;
      }
    } catch (e) {
      // Web and some devices cannot answer this; carry on and let the fix fail.
      console.warn('Location service check failed:', e);
    }

    let permission = await Location.getForegroundPermissionsAsync().catch(() => null);
    if (!permission?.granted) {
      permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
    }
    if (!permission?.granted) {
      console.warn('Location permission denied');
      return null;
    }

    let position: Location.LocationObject | null = null;
    try {
      position = await getBestPositionAsync(POSITION_TIMEOUT_MS);
    } catch (e) {
      console.warn('Current position unavailable:', e);
      position = null;
    }

    if (!position) {
      console.warn('Current position unavailable, trying last known position');
      try {
        position = await Location.getLastKnownPositionAsync();
      } catch (lastKnownError) {
        console.warn('Last known position unavailable:', lastKnownError);
        position = null;
      }
    }

    if (!position) return null;

    const coords: LocationCoords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };

    cachedCoords = { at: Date.now(), coords };
    return coords;
  },

  /**
   * Turn a typed address into coordinates. Used when saving a delivery address
   * so fees and the server geo guard get a real point instead of a random one.
   */
  async geocodeAddress(
    addressLine: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    if (!addressLine.trim()) return null;
    try {
      const results = await withTimeout(
        Location.geocodeAsync(addressLine),
        ADDRESS_TIMEOUT_MS
      );
      if (!results || results.length === 0) return null;
      return { latitude: results[0].latitude, longitude: results[0].longitude };
    } catch (e) {
      console.warn('Geocoding failed:', e);
      return null;
    }
  },

  /** Structured reverse geocode, used by the address form. */
  async getAddressParts(
    latitude: number,
    longitude: number
  ): Promise<{ streetAddress: string; city: string; province: string; postalCode: string } | null> {
    try {
      const places = await withTimeout(
        Location.reverseGeocodeAsync({ latitude, longitude }),
        ADDRESS_TIMEOUT_MS
      );
      if (!places || places.length === 0) return null;
      const place = places[0];
      return {
        streetAddress: formatAddress(place),
        city: place.city || place.subregion || place.region || '',
        province: place.region || '',
        postalCode: place.postalCode || '',
      };
    } catch (e) {
      console.warn('Reverse geocoding failed:', e);
      return null;
    }
  },

  async getAddressFromCoordinates(latitude: number, longitude: number): Promise<string> {
    try {
      const places = await withTimeout(Location.reverseGeocodeAsync({ latitude, longitude }), ADDRESS_TIMEOUT_MS);
      if (places.length === 0) return UNKNOWN_ADDRESS;
      return formatAddress(places[0]);
    } catch (e) {
      console.warn('Error getting address:', e);
      return UNKNOWN_ADDRESS;
    }
  },

  /** Opens the OS settings page so the user can re-enable location. */
  async openLocationSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (e) {
      console.warn('Could not open location settings:', e);
    }
  },

  calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return calculateDistanceKm(lat1, lon1, lat2, lon2);
  },

  calculateEtaMinutes(distanceKm: number): number {
    const avgSpeedKmH = 30; // average city delivery speed
    const driveTimeMin = Math.ceil((distanceKm / avgSpeedKmH) * 60);
    const prepTimeMin = 15;
    return driveTimeMin + prepTimeMin;
  },

  /** Drops the cached fix, e.g. after the user changes their location. */
  clearCache(): void {
    cachedCoords = null;
  },
};
