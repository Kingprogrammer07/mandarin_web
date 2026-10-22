/**
 * Where Mandarin's own courier delivers: Tashkent and its edge.
 *
 * Mirrors `COURIER_AREA_LAT/LON` in the backend (`src/infrastructure/tools/geo.py`),
 * which refuses a "mandarin" request whose pin falls outside. Checking here
 * only spares the client a round trip; the server stays the authority.
 */
export const COURIER_AREA = {
  lat: [41.0, 41.6],
  lon: [68.9, 69.8],
} as const;

export interface LatLon {
  latitude: number;
  longitude: number;
}

export function isInCourierArea({ latitude, longitude }: LatLon): boolean {
  return (
    latitude >= COURIER_AREA.lat[0] &&
    latitude <= COURIER_AREA.lat[1] &&
    longitude >= COURIER_AREA.lon[0] &&
    longitude <= COURIER_AREA.lon[1]
  );
}
