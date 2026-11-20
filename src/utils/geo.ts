/** Parse the `stores.location` text column in `"lat, lng"` format. */
export function parseLatLngText(
  value: string | null | undefined
): { latitude: number; longitude: number } | null {
  if (!value) return null;
  const parts = value.split(',');
  if (parts.length !== 2) return null;

  const latitude = Number(parts[0].trim());
  const longitude = Number(parts[1].trim());
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return { latitude, longitude };
}
