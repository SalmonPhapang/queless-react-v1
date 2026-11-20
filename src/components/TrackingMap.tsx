import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlatformWebView, PlatformWebViewHandle } from './PlatformWebView';
import { useTheme } from '../theme/theme';
import { appConfig } from '../config/appConfig';

// react-native-maps has no usable web implementation. It is only loaded on
// native builds; the web debugger always uses the Leaflet/OSM branch below.
const NativeMaps: any = Platform.OS === 'web' ? null : require('react-native-maps');

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

interface TrackingMapProps {
  destination: MapCoordinate;
  driver?: MapCoordinate | null;
  driverLabel?: string;
  destinationLabel?: string;
  style?: StyleProp<ViewStyle>;
}

interface MapPayload {
  destination: MapCoordinate;
  driver: MapCoordinate | null;
  driverLabel: string;
  destinationLabel: string;
  dark: boolean;
  tiles: string;
  attribution: string;
  surface: string;
  card: string;
  onSurface: string;
  divider: string;
  subtext: string;
  accent: string;
}

const DRIVER_SVG =
  '<svg viewBox="0 0 24 24" fill="#FFFFFF"><path d="M12 2 3.2 21.2 12 17.4l8.8 3.8L12 2z"/></svg>';

const DEST_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-8h6v8"/></svg>';

const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/**
 * Leaflet/OpenStreetMap map rendered in a WebView.
 *
 * Kept behind `appConfig.maps.provider` so the tracking screen can switch to
 * react-native-maps (Google) later without changing call sites.
 */
function buildLeafletHtml(initial: MapPayload): string {
  const attributionBg = initial.dark
    ? 'rgba(15,15,17,0.72)'
    : 'rgba(255,255,255,0.78)';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    :root {
      --surface: ${initial.surface};
      --card: ${initial.card};
      --on-surface: ${initial.onSurface};
      --divider: ${initial.divider};
      --subtext: ${initial.subtext};
      --accent: ${initial.accent};
      --attribution-bg: ${attributionBg};
    }
    html, body, #map { height: 100%; margin: 0; padding: 0; background: var(--surface); }
    .leaflet-container {
      background: var(--surface);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .leaflet-control-attribution {
      background: var(--attribution-bg) !important;
      color: var(--subtext) !important;
      font-size: 9px !important;
      padding: 2px 6px !important;
      border-radius: 8px 0 0 0;
    }
    .leaflet-control-attribution a { color: inherit !important; }
    .leaflet-control-zoom {
      border: 0 !important;
      border-radius: 12px !important;
      overflow: hidden;
      box-shadow: 0 6px 18px rgba(0,0,0,0.18) !important;
    }
    .leaflet-control-zoom a {
      width: 32px !important;
      height: 32px !important;
      line-height: 32px !important;
      background: var(--card) !important;
      color: var(--on-surface) !important;
      border-color: var(--divider) !important;
    }
    .map-pin {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 18px;
      border: 3px solid #FFFFFF;
      box-sizing: border-box;
      box-shadow: 0 6px 16px rgba(0,0,0,0.28);
    }
    .map-pin svg { width: 16px; height: 16px; }
    .map-pin-driver { background: var(--accent); }
    .map-pin-dest { background: var(--on-surface); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var initial = ${safeJson(initial)};
      var current = { dark: initial.dark };

      var map = L.map('map', { zoomControl: false, preferCanvas: true }).setView(
        [initial.destination.latitude, initial.destination.longitude],
        15
      );

      var tiles = L.tileLayer(initial.tiles, {
        maxZoom: 19,
        subdomains: 'abcd',
        detectRetina: true,
        attribution: initial.attribution
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      var destIcon = L.divIcon({
        className: '',
        html: '<div class="map-pin map-pin-dest">${DEST_SVG}</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      var driverIcon = L.divIcon({
        className: '',
        html: '<div class="map-pin map-pin-driver">${DRIVER_SVG}</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      var destMarker = L.marker(
        [initial.destination.latitude, initial.destination.longitude],
        { icon: destIcon, keyboard: false, title: initial.destinationLabel }
      ).addTo(map);

      var driverMarker = null;
      var line = null;

      function render(payload) {
        if (!payload || !payload.destination) return;

        var root = document.documentElement.style;
        root.setProperty('--surface', payload.surface);
        root.setProperty('--card', payload.card);
        root.setProperty('--on-surface', payload.onSurface);
        root.setProperty('--divider', payload.divider);
        root.setProperty('--subtext', payload.subtext);
        root.setProperty('--accent', payload.accent);
        root.setProperty(
          '--attribution-bg',
          payload.dark ? 'rgba(15,15,17,0.72)' : 'rgba(255,255,255,0.78)'
        );
        document.body.style.background = payload.surface;

        if (payload.dark !== current.dark) {
          current.dark = payload.dark;
          tiles.setUrl(payload.tiles);
        }

        var dest = [payload.destination.latitude, payload.destination.longitude];
        destMarker.setLatLng(dest);

        if (payload.driver) {
          var drv = [payload.driver.latitude, payload.driver.longitude];

          if (!driverMarker) {
            driverMarker = L.marker(drv, {
              icon: driverIcon,
              keyboard: false,
              title: payload.driverLabel || 'Driver',
              zIndexOffset: 1000
            }).addTo(map);
            line = L.polyline([drv, dest], {
              color: payload.accent,
              weight: 4,
              opacity: 0.85,
              dashArray: '0.1 10',
              lineCap: 'round'
            }).addTo(map);
          } else {
            driverMarker.setLatLng(drv);
            line.setLatLngs([drv, dest]);
          }

          map.fitBounds(L.latLngBounds([drv, dest]), {
            padding: [52, 52],
            maxZoom: 16,
            animate: true,
            duration: 0.4
          });
        } else {
          if (driverMarker) { map.removeLayer(driverMarker); driverMarker = null; }
          if (line) { map.removeLayer(line); line = null; }
          map.setView(dest, 15, { animate: true });
        }
      }

      window.updateTrackingMap = render;
      render(initial);
    })();
  </script>
</body>
</html>`;
}

export const TrackingMap: React.FC<TrackingMapProps> = ({
  destination,
  driver,
  driverLabel,
  destinationLabel,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const webRef = useRef<PlatformWebViewHandle>(null);
  const useLeaflet = appConfig.maps.provider === 'osm' || Platform.OS === 'web';

  const safeDriver =
    driver && Number.isFinite(driver.latitude) && Number.isFinite(driver.longitude)
      ? driver
      : null;

  const payload: MapPayload = {
    destination,
    driver: safeDriver,
    driverLabel: driverLabel || 'Driver',
    destinationLabel: destinationLabel || 'Delivery address',
    dark: isDark,
    tiles: isDark ? appConfig.maps.osm.darkTiles : appConfig.maps.osm.lightTiles,
    attribution: appConfig.maps.osm.attribution,
    surface: colors.surface,
    card: colors.cardBackground,
    onSurface: colors.onSurface,
    divider: colors.divider,
    subtext: colors.subtext,
    accent: colors.secondary,
  };

  const latestPayload = useRef(payload);
  latestPayload.current = payload;

  const initialPayload = useRef(payload);
  const html = useMemo(() => buildLeafletHtml(initialPayload.current), []);
  const source = useMemo(() => ({ html }), [html]);

  const pushUpdate = () => {
    if (!useLeaflet) return;
    webRef.current?.injectJavaScript(
      `window.updateTrackingMap && window.updateTrackingMap(${safeJson(latestPayload.current)}); true;`
    );
  };

  useEffect(() => {
    pushUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    destination.latitude,
    destination.longitude,
    safeDriver?.latitude,
    safeDriver?.longitude,
    driverLabel,
    destinationLabel,
    isDark,
    colors.secondary,
    useLeaflet,
  ]);

  if (!useLeaflet && NativeMaps) {
    const MapView = NativeMaps.default;
    const Marker = NativeMaps.Marker;
    const Polyline = NativeMaps.Polyline;
    const PROVIDER_DEFAULT = NativeMaps.PROVIDER_DEFAULT;

    return (
      <View style={[styles.container, style]}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: destination.latitude,
            longitude: destination.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          toolbarEnabled={false}
        >
          {safeDriver && (
            <Marker coordinate={safeDriver} title={driverLabel || 'Driver'}>
              <View style={[styles.markerBadge, { backgroundColor: colors.secondary }]}>
                <Ionicons name="navigate" size={18} color="#FFFFFF" />
              </View>
            </Marker>
          )}

          <Marker coordinate={destination} title={destinationLabel || 'Delivery address'}>
            <View style={[styles.markerBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="home" size={18} color="#FFFFFF" />
            </View>
          </Marker>

          {safeDriver && (
            <Polyline
              coordinates={[safeDriver, destination]}
              strokeColor={colors.secondary}
              strokeWidth={4}
            />
          )}
        </MapView>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <PlatformWebView
        ref={webRef}
        source={source}
        originWhitelist={['*']}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        onLoadEnd={pushUpdate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  markerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
});
