// App-facing status system.
//
// Order and payment statuses are the shared queless-core definitions
// (src/models/core/statuses.ts): database values, display names, icon/colour
// hints, FSMs and lenient parsers.
export * from './core/statuses';

/**
 * Driver assignment progress for this customer app.
 *
 * Not the same thing as core's `DriverAvailabilityStatus` (offline / online /
 * on_delivery), which describes whether a driver is taking work at all. This
 * one tracks where the driver is in a single delivery.
 */
export type DriverStatus =
  | 'unassigned'
  | 'assigned'
  | 'accepted'
  | 'heading_to_store'
  | 'at_store'
  | 'heading_to_customer'
  | 'at_customer'
  | 'completed';
