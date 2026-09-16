/** Equirectangular projection: longitude/latitude → SVG x/y within a `width`×`height` viewBox. */
export function project(lon: number, lat: number, width: number, height: number): { x: number; y: number } {
  return { x: ((lon + 180) / 360) * width, y: ((90 - lat) / 180) * height }
}

/**
 * Deliberately stylized/abstract landmass silhouettes — soft blobs over each continent's rough
 * lon/lat bounding box, not traced coastlines. Good enough to read as "a world map" at a glance
 * without claiming geographic precision this app has no business asserting from memory.
 */
export const CONTINENT_BLOBS: { name: string; lon: number; lat: number; rx: number; ry: number }[] = [
  { name: 'North America', lon: -100, lat: 45, rx: 34, ry: 20 },
  { name: 'South America', lon: -60, lat: -18, rx: 14, ry: 24 },
  { name: 'Europe', lon: 15, lat: 52, rx: 16, ry: 12 },
  { name: 'Africa', lon: 18, lat: 2, rx: 20, ry: 26 },
  { name: 'Asia', lon: 95, lat: 45, rx: 42, ry: 22 },
  { name: 'Australia', lon: 134, lat: -25, rx: 14, ry: 9 },
]

export type CityTz = { tz: string; city: string; lon: number; lat: number }

export const CITY_TIMEZONES: CityTz[] = [
  { tz: 'UTC', city: 'Greenwich', lon: 0, lat: 51.5 },
  { tz: 'America/New_York', city: 'New York', lon: -74, lat: 40.7 },
  { tz: 'America/Los_Angeles', city: 'Los Angeles', lon: -118.2, lat: 34 },
  { tz: 'America/Chicago', city: 'Chicago', lon: -87.6, lat: 41.9 },
  { tz: 'Europe/London', city: 'London', lon: -0.1, lat: 51.5 },
  { tz: 'Europe/Berlin', city: 'Berlin', lon: 13.4, lat: 52.5 },
  { tz: 'Asia/Kolkata', city: 'Mumbai', lon: 72.8, lat: 19.1 },
  { tz: 'Asia/Singapore', city: 'Singapore', lon: 103.8, lat: 1.3 },
  { tz: 'Asia/Tokyo', city: 'Tokyo', lon: 139.7, lat: 35.7 },
  { tz: 'Australia/Sydney', city: 'Sydney', lon: 151.2, lat: -33.9 },
]

/** Rough day/night split by longitude only (ignores the latitude-dependent solar terminator curve — a stylized approximation, not an astronomically exact one). */
export function isDaytimeAtLongitude(instant: Date, lon: number): boolean {
  const utcHour = instant.getUTCHours() + instant.getUTCMinutes() / 60
  const localHour = (utcHour + lon / 15 + 24) % 24
  return localHour >= 6 && localHour < 18
}
