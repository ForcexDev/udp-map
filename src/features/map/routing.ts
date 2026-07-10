import type { LatLng } from '@/shared/utils/geo'
import { haversineMeters, walkingSeconds } from '@/shared/utils/geo'

export interface WalkingRoute {
  /** [lng, lat] para GeoJSON/MapLibre */
  coordinates: [number, number][]
  distanceMeters: number
  durationSeconds: number
  source: 'ors' | 'osrm' | 'fallback'
}

const ORS_BASE = 'https://api.openrouteservice.org/v2/directions'

/**
 * Ruteo peatonal con OpenRouteService (2.000 req/día free tier, plan §4) y
 * fallback a línea recta si no hay API key o el servicio falla (plan §13).
 * `accessible` usa el perfil wheelchair (rutas accesibles).
 */
export async function getWalkingRoute(
  from: LatLng,
  to: LatLng,
  accessible = false,
): Promise<WalkingRoute> {
  const apiKey = import.meta.env.VITE_ORS_API_KEY
  if (apiKey) {
    try {
      const profile = accessible ? 'wheelchair' : 'foot-walking'
      const res = await fetch(`${ORS_BASE}/${profile}/geojson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: apiKey },
        body: JSON.stringify({
          coordinates: [
            [from.lng, from.lat],
            [to.lng, to.lat],
          ],
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as {
          features: {
            geometry: { coordinates: [number, number][] }
            properties: { summary: { distance: number; duration: number } }
          }[]
        }
        const feature = data.features[0]
        if (feature) {
          return {
            coordinates: feature.geometry.coordinates,
            distanceMeters: feature.properties.summary.distance,
            durationSeconds: feature.properties.summary.duration,
            source: 'ors',
          }
        }
      }
    } catch {
      // cae a OSRM o al fallback
    }
  }

  // Si no hay API Key de ORS o falló, intentamos con el servidor público de OSRM (gratis, sin registro)
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`)
    if (res.ok) {
      const data = await res.json()
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0]
        return {
          coordinates: route.geometry.coordinates,
          distanceMeters: route.distance,
          durationSeconds: route.duration,
          source: 'osrm',
        }
      }
    }
  } catch {
    // Si el servidor público falla, caemos en el fallback geométrico
  }

  const distance = haversineMeters(from, to)
  return {
    coordinates: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
    distanceMeters: distance,
    durationSeconds: walkingSeconds(distance),
    source: 'fallback',
  }
}
