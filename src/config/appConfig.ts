export type AppEnvironment = 'dev' | 'stage' | 'prod';
export type MapsProvider = 'osm' | 'google';

const readFlag = (raw: string | undefined, fallback = false): boolean => {
  if (raw === undefined || raw.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
};

const mapsProvider: MapsProvider =
  (process.env.EXPO_PUBLIC_MAPS_PROVIDER || process.env.MAPS_PROVIDER || 'osm')
    .trim()
    .toLowerCase() === 'google'
    ? 'google'
    : 'osm';

// Tracking map tiles are requested directly by the client (WebView/browser).
// Defaults to keyless OpenStreetMap tiles. Override via EXPO_PUBLIC_* env vars
// if you need a different provider (e.g. CARTO requires an API key in the URL:
// https://carto.com/basemaps/apikey). Supabase Edge Function secrets are not
// available to the client app.
const defaultOsmTileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const defaultOsmAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Browser push VAPID public key. This is safe to ship to clients; the matching
// private key lives only in Supabase Edge Function secrets. Keep this in sync
// with supabase/functions/_shared/webpush.ts in the backend repo.
const DEFAULT_WEB_PUSH_PUBLIC_KEY =
  'BKzWSW-uiaeClLGMck7ptVrWnIP07zMKUuoICw-G7KRppgH59StYPCfUfcpzosF5Lelhu1spJWT6scMpbl203nw';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lxsvydiyzeavdqbjxkpp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4c3Z5ZGl5emVhdmRxYmp4a3BwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3Njg1MDQsImV4cCI6MjA4MzM0NDUwNH0.nThX1Mj5MlKbsCsmlW8RhukSXC57kcbB9za92LwwiDQ';

// Expo inlines only EXPO_PUBLIC_* variables into client bundles. APP_ENV is
// kept as a fallback for native/server-side scripts.
const rawEnv = (process.env.EXPO_PUBLIC_APP_ENV || process.env.APP_ENV || 'dev').toLowerCase();
export const environment: AppEnvironment = (rawEnv === 'stage' || rawEnv === 'staging') ? 'stage' : (rawEnv === 'prod' || rawEnv === 'production') ? 'prod' : 'dev';

export const appConfig = {
  env: environment,
  passwordResetRedirectUrl: 'com.queless.app://reset-password',
  paystackCallbackUrl: 'https://lxsvydiyzeavdqbjxkpp.supabase.co/functions/v1/paystack-callback',
  // Order updates are part of the core experience. Builds can opt out with an
  // explicit `EXPO_PUBLIC_NOTIFICATIONS_ENABLED=false`, but a missing value must
  // not silently disable the customer's push token registration.
  enableNotifications: readFlag(
    process.env.EXPO_PUBLIC_NOTIFICATIONS_ENABLED ?? process.env.ENABLE_NOTIFICATIONS,
    true
  ),
  push: {
    /** Audience written to `app_id` on both Expo and Web Push token rows. */
    appId: 'customer',
    // Native tokens stay behind the existing notification flag. Browser push
    // is separate so the PWA can subscribe without a custom native build.
    webEnabled: readFlag(process.env.EXPO_PUBLIC_WEB_PUSH_ENABLED, true),
    webPublicKey: process.env.EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY || DEFAULT_WEB_PUSH_PUBLIC_KEY,
    easProjectId:
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '07669b65-51e8-4c55-abcb-931ee561451a',
  },
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,

  /**
   * Product switches. Keep temporary/unfinished flows here instead of hiding
   * them in screen code so they can be turned on per environment.
   */
  features: {
    /**
     * Require SMS OTP verification after login/signup and when the phone
     * number changes in Edit Profile. Off while SMS delivery is not set up.
     */
    phoneOtp: readFlag(process.env.EXPO_PUBLIC_PHONE_OTP_ENABLED, false),
  },

  /**
   * Tracking map. `osm` renders Leaflet + raster tiles in a WebView. Defaults to
   * keyless OpenStreetMap tiles; override EXPO_PUBLIC_MAP_TILES_* / ATTRIBUTION
   * in .env for other providers. Switch provider to `google` for react-native-maps
   * on native builds.
   */
  maps: {
    provider: mapsProvider,
    osm: {
      lightTiles: process.env.EXPO_PUBLIC_MAP_TILES_LIGHT || defaultOsmTileUrl,
      darkTiles: process.env.EXPO_PUBLIC_MAP_TILES_DARK || defaultOsmTileUrl,
      attribution: process.env.EXPO_PUBLIC_MAP_ATTRIBUTION || defaultOsmAttribution,
    },
  },

  get foodMinimumOrder(): number {
    return environment === 'prod' ? 50.0 : 10.0;
  },

  get liquorMinimumOrder(): number {
    return environment === 'prod' ? 90.0 : 10.0;
  },

  serviceFee: 7.0,

  formatCurrency(amount: number): string {
    const safeAmount = isNaN(amount) ? 0 : amount;
    return `R ${safeAmount.toFixed(2)}`;
  },

  formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
      return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith('27')) {
      return `+27 ${cleaned.substring(2, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
    }
    return phone;
  },

  normalizePhoneNumber(phone: string): string {
    let normalized = phone.trim().replace(/[^\d+]/g, '');
    if (normalized.startsWith('00')) {
      normalized = '+' + normalized.substring(2);
    }
    if (!normalized.startsWith('+')) {
      if (normalized.startsWith('0') && normalized.length === 10) {
        normalized = '+27' + normalized.substring(1);
      } else {
        normalized = '+' + normalized;
      }
    }
    return normalized;
  }
};
