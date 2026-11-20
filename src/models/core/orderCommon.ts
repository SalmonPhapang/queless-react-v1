// ============================================================================
// QUELESS CORE (React) — SHARED ORDER SUB-MODELS
//
// Port of queless-core/lib/models/order_common.dart, trimmed to the shapes the
// customer app actually consumes. Timestamps stay ISO-8601 strings, matching
// the rest of the React app (and the Supabase payloads) instead of Dart's
// DateTime.
// ============================================================================

// ----------------------------------------------------------------------------
// Tracking updates — `orders.tracking_updates` (jsonb array)
// ----------------------------------------------------------------------------

export interface TrackingUpdate {
  status: string;
  message: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

interface TrackingUpdateJson {
  status?: string;
  message?: string;
  timestamp?: string;
}

export function trackingUpdateFromJson(
  json: TrackingUpdateJson | null | undefined,
  fallbackTimestamp: string = new Date().toISOString()
): TrackingUpdate {
  return {
    status: json?.status ?? 'pending',
    message: json?.message ?? '',
    timestamp: parseIsoDate(json?.timestamp) ?? fallbackTimestamp,
  };
}

// ----------------------------------------------------------------------------
// Driver info embedded on an order
// ----------------------------------------------------------------------------

export interface DriverLocationSnapshot {
  latitude?: number;
  longitude?: number;
  /** ISO-8601 time of the fix (`driver_assignments.last_location_update`). */
  updatedAt?: string;
  [key: string]: unknown;
}

export interface DriverInfo {
  name: string;
  phone: string;
  location?: DriverLocationSnapshot | null;
}

export function driverInfoFromJson(json: Record<string, unknown> | null | undefined): DriverInfo {
  return {
    name: (json?.name as string) ?? 'Unknown Driver',
    phone: (json?.phone as string) ?? '',
    location: (json?.location as DriverLocationSnapshot | undefined) ?? null,
  };
}

function parseIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
