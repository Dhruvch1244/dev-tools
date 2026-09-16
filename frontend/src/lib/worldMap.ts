import { geoEquirectangular, geoPath, type GeoPath, type GeoPermissibleObjects } from 'd3-geo'
import { feature } from 'topojson-client'
// world-atlas ships pre-simplified real coastline data (Natural Earth, 110m resolution) as a
// static JSON file — bundled at build time, no runtime fetch, so this stays fully offline.
import landTopology from 'world-atlas/land-110m.json'

type LooseTopology = { type: 'Topology'; objects: { land: unknown }; arcs: unknown; transform?: unknown }

let cachedProjection: ReturnType<typeof geoEquirectangular> | null = null
let cachedPathGen: GeoPath | null = null
let cachedDims: { w: number; h: number } | null = null

function getProjection(width: number, height: number) {
  if (!cachedProjection || cachedDims?.w !== width || cachedDims?.h !== height) {
    cachedProjection = geoEquirectangular()
      .scale(width / (2 * Math.PI))
      .translate([width / 2, height / 2])
    cachedPathGen = geoPath(cachedProjection)
    cachedDims = { w: width, h: height }
  }
  return { projection: cachedProjection, pathGen: cachedPathGen as GeoPath }
}

/** Longitude/latitude → SVG x/y, using the same real equirectangular projection as the land path. */
export function project(lon: number, lat: number, width: number, height: number): { x: number; y: number } {
  const { projection } = getProjection(width, height)
  const p = projection([lon, lat])
  return p ? { x: p[0], y: p[1] } : { x: 0, y: 0 }
}

/** SVG path `d` string for the real world landmass outline (Natural Earth 110m, via world-atlas). */
export function worldLandPath(width: number, height: number): string {
  const { pathGen } = getProjection(width, height)
  const topo = landTopology as unknown as LooseTopology
  const land = feature(topo as never, topo.objects.land as never) as GeoPermissibleObjects
  return pathGen(land) ?? ''
}

export type CityTz = { tz: string; city: string; lon: number; lat: number }

export const CITY_TIMEZONES: CityTz[] = [
  { tz: 'UTC', city: 'UTC (Null Island)', lon: 0, lat: 0 },
  { tz: 'America/New_York', city: 'New York (Eastern)', lon: -74, lat: 40.7 },
  { tz: 'America/Los_Angeles', city: 'Los Angeles (Pacific)', lon: -118.2, lat: 34 },
  { tz: 'America/Chicago', city: 'Chicago (Central)', lon: -87.6, lat: 41.9 },
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
