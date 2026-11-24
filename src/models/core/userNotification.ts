// ============================================================================
// QUELESS CORE (React) — IN-APP NOTIFICATION
//
// Port of queless-core/lib/models/user_notification.dart: one row of the
// `notifications` table as the customer, driver and store apps read it.
//
// `userId` is included (optional) because the React inbox service stamps the
// signed-in user onto rows it reads; the Dart model omitted it since every
// query was already scoped to the signed-in user.
// ============================================================================

export interface UserNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  orderId?: string | null;
  orderNumber?: string | null;
  status?: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export function userNotificationFromJson(
  json: Record<string, unknown> | null | undefined
): UserNotification {
  return {
    id: json?.id?.toString() ?? '',
    type: json?.type?.toString() ?? 'order',
    title: json?.title?.toString() ?? '',
    body: json?.body?.toString() ?? '',
    orderId: json?.order_id?.toString() ?? null,
    orderNumber: json?.order_number?.toString() ?? null,
    status: json?.status?.toString() ?? null,
    data: isRecord(json?.data) ? (json.data as Record<string, unknown>) : {},
    isRead: json?.is_read === true,
    createdAt: asIsoDate(json?.created_at) ?? new Date().toISOString(),
    updatedAt: asIsoDate(json?.updated_at) ?? new Date().toISOString(),
    userId: json?.user_id?.toString() ?? undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
