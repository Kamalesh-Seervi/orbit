import type { CoarseLocation } from './types';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(a: CoarseLocation, b: CoarseLocation): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Human-friendly distance, e.g. "just nearby", "~340 km away". */
export function formatDistance(km: number): string {
  if (km < 1) return 'less than a kilometre away';
  if (km < 15) return `~${Math.round(km)} km away`;
  if (km < 100) return `~${Math.round(km / 5) * 5} km away`;
  return `~${Math.round(km / 10) * 10} km away`;
}

/**
 * Reduce coordinate precision before it ever leaves the device. Two decimals is
 * roughly a 1 km grid — enough for a fun distance reveal, coarse enough that it
 * never pinpoints a home address.
 */
function coarsen(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Best-effort reverse geocode using BigDataCloud's free, key-less client
 * endpoint. Returns undefined on any failure — the feature degrades to a plain
 * distance with no label.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const data: { city?: string; locality?: string; countryCode?: string } =
      await res.json();
    const place = data.city || data.locality;
    if (place && data.countryCode) return `${place}, ${data.countryCode}`;
    return data.countryCode || place || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Requests the browser geolocation once and returns a privacy-reduced location.
 * Resolves to null if permission is denied or unavailable — location is always
 * optional.
 */
export function getCoarseLocation(): Promise<CoarseLocation | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = coarsen(pos.coords.latitude);
        const lng = coarsen(pos.coords.longitude);
        const label = await reverseGeocode(lat, lng);
        resolve({ lat, lng, label });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  });
}
