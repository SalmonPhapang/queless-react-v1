# Queless React

Expo SDK 58 / React Native 0.88 / React 19.

## Run

```bash
npm start          # Expo Dev Server
npm run android
npm run ios
npm run web        # browser debugging at http://localhost:19006
```

All Expo commands go through `scripts/expo.js`, which sets `EXPO_NO_CACHE=1`
to avoid the Expo CLI cache crash previously seen on Node 26.

SDK 58 requires Node 22.13+, 24.3+, or 26+. Expo Go for SDK 58 may not be in
the app stores yet; use a development build if the QR code will not open.

## Web debugging notes

- The tracking map always uses the Leaflet/OpenStreetMap iframe on web, even
  when `EXPO_PUBLIC_MAPS_PROVIDER=google`.
- `react-native-maps` is only loaded on native builds.
- Paystack checkout is native-only. On web, the payment screen shows a manual
  **Verify payment** action so you can still exercise verification flows.
- AsyncStorage works on web through the package's browser backend.

## Configuration

Copy `.env.example` to `.env` and adjust as needed.

```bash
EXPO_PUBLIC_PHONE_OTP_ENABLED=false
EXPO_PUBLIC_NOTIFICATIONS_ENABLED=false
EXPO_PUBLIC_MAPS_PROVIDER=osm
```

The main tabs are Food, Liquor, Orders and Profile. Browse stays available as
a screen opened from search and the cart.

The Food screen resolves delivery location in the same order as Flutter: the
device's current position first, then the default saved address, then the first
saved address. The chosen point ranks nearby restaurants; saved-address fallback
is used when there is no GPS fix. Cuisine chips filter by `cuisine_types`.

"For You" stores/products and Order Again come from the `qai_recommended_stores`,
`qai_recommended_products` and `qai_usual_order` database RPCs. These are
read-only, return an empty list for signed-out users, and degrade gracefully if
there is not enough affinity signal yet.

When notifications are enabled, the onboarding permission screen asks for
location first and then notification permission, matching the Flutter app's
`PermissionRequestScreen`. The deployed server sends FCM tokens stored in
`user_fcm_tokens`; an Expo push token is not compatible with that API, so
remote push delivery still needs native Firebase registration in a development
build. Inbox notifications from Supabase work without it.

After changing any `EXPO_PUBLIC_*` value, restart Expo with the cache cleared.

## Checks

```bash
npm run typecheck
npm test
npm run build:web
```
