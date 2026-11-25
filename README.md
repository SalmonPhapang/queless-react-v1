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

The native builds run edge-to-edge: the Android navigation bar and status bar
are hidden, and the iOS status bar is hidden, on every screen including login.
The installed web app requests fullscreen PWA display; browser chrome outside an
installed PWA cannot be hidden by the app. Expo Go and stale dev clients do not
include the native navigation-bar module, so the app skips that override instead
of crashing. Use a fresh native build/dev client for hidden bars and native
Sentry reporting.

SDK 58 requires Node 22.13+, 24.3+, or 26+. Expo Go for SDK 58 may not be in
the app stores yet; use a development build if the QR code will not open.

## Web debugging notes

- The tracking map always uses the Leaflet/OpenStreetMap iframe on web, even
  when `EXPO_PUBLIC_MAPS_PROVIDER=google`.
- `react-native-maps` is only loaded on native builds.
- On web, Paystack checkout opens in a secure window. The app watches for the
  return callback and confirms the payment automatically.
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

To test the outside-radius experience without travelling, run:

```bash
npm run web:radius-test
```

Every store is then treated as 25km away in development: browsing still works,
but adding to cart and checkout are blocked. The override is ignored by
production builds. Use `npm run web` to restore normal behaviour.

You can also set `EXPO_PUBLIC_TEST_DELIVERY_DISTANCE_KM` in local `.env` before
running `npm run web`.

After changing any `EXPO_PUBLIC_*` value, restart Expo with the cache cleared.

## Vercel web deployment

The Vercel project `queless-react-v1` is connected to this GitHub repository.
Pushes to `main` create a Production deployment; other branches create Preview
deployments. Build settings are stored both in `vercel.json` and in the Vercel
project:

- Install command: `npm ci`
- Build command: `npm run build:web`
- Output directory: `dist`
- Framework: Other
- Node.js: `26.x` (pinned by `package.json`)

`vercel.json` also adds an SPA fallback so deep links are served by
`dist/index.html`.

`npm run build:web` exports external source maps and uploads them to the
`queless-customer` Sentry project after copying the service-worker assets. The
Vercel project has `SENTRY_AUTH_TOKEN` as a Secret variable in Production,
Preview and Development; the token is never written to the bundle or passed on
a command line. Native EAS builds upload source maps/debug symbols
automatically through the Sentry Expo plugin when the same token is present in
the build environment. For a manual EAS Update/export upload, pull the token
locally and run `npm run sourcemaps:upload`.

Client-side configuration must use `EXPO_PUBLIC_*` names because Expo inlines
those values into the web bundle. The Vercel project is configured with the
values from `.env.example`; Production sets `EXPO_PUBLIC_APP_ENV=prod`, while
Preview and Development use `dev`. Existing Vercel Authentication/deployment
protection settings are unchanged.

## EAS builds and Paystack keys

EAS build profiles are mapped to Expo Services environments in `eas.json`:

| Profile | EAS environment | `EXPO_PUBLIC_APP_ENV` |
| --- | --- | --- |
| `development` | `development` | `dev` |
| `preview` | `preview` | `dev` |
| `production` | `production` | `prod` |

The value is stored as a project-wide EAS environment variable. If it ever
needs to be recreated:

```bash
eas env:set --name EXPO_PUBLIC_APP_ENV --value dev --environment development --visibility plaintext --scope project
eas env:set --name EXPO_PUBLIC_APP_ENV --value dev --environment preview --visibility plaintext --scope project
eas env:set --name EXPO_PUBLIC_APP_ENV --value prod --environment production --visibility plaintext --scope project
```

Paystack secret keys belong **only** in Supabase Edge Function secrets:

- `PAYSTACK_SECRET_KEY` — live secret key, used when `EXPO_PUBLIC_APP_ENV=prod`.
- `PAYSTACK_TEST_SECRET_KEY` — test secret key, used for dev/preview builds.
  `PAYSTACK_SECRET_KEY_TEST` is accepted as a legacy alias.
- `PAYSTACK_CALLBACK_URL` — optional; defaults to the deployed
  `paystack-callback` function URL.
- `PAYSTACK_PUBLIC_KEY` / `PAYSTACK_TEST_PUBLIC_KEY` — optional; used only by
  the Capitec Pay requery endpoint. If unset, the matching server-side secret
  key is used.

The client sends `is_debug: appConfig.env !== 'prod'` to
`initialize-paystack-split` and `verify-paystack-split`. Those functions pick
the matching key and now fail closed when a debug request has no test key
configured, so a test checkout can never silently use the live key. Do not put
Paystack secret keys in `EXPO_PUBLIC_*`, Vercel, or EAS client variables.

## Capitec Pay

Capitec Pay is a separate option at checkout. `initialize-paystack-split`
initializes the Paystack transaction with `channels: ["capitec_pay"]`, so the
returned authorization URL opens Capitec Pay directly instead of the generic
method-selection checkout. Card uses `channels: ["card"]` and Instant EFT uses
`channels: ["eft"]`, so each option opens its own Paystack flow.
Enable Capitec Pay in the Paystack dashboard under **Settings > Preferences >
Payments > Accept payments via** and complete any required KYC approval.
The customer approves the request in the Capitec app.

Approval is asynchronous. After returning from Paystack, the app verifies the
transaction and, for Capitec Pay only, waits at least 90 seconds before the
first requery and then polls no faster than every 10 seconds (up to ~5 minutes).
`verify-paystack-split` calls Paystack's `capitec-pay/requery/{reference}`
server-side and treats a pending result as "still waiting" rather than a failed
payment. A successful webhook or normal transaction verification still completes
the order.

Because development and production currently share one Supabase project, the
mode is request-driven and `paystack-webhook` accepts signatures from both
keys. For high-value release traffic, use separate Supabase projects for dev
and prod so only the correct key exists in each project.

If the app cannot confirm a payment, the **Payment not completed** screen offers
**Cancel order**. `cancel-unpaid-order` rechecks the transaction (and requeries
Capitec Pay where relevant) before cancelling, so a payment that completed in
the background is never cancelled.

## Checks

```bash
npm run typecheck
npm test
npm run build:web
```
