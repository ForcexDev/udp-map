import { useSyncExternalStore } from 'react'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { Faculty } from '@/shared/types/database'
import { isPointInPolygon } from '@/shared/utils/geo'
import { FACULTIES } from './campusData'

// ─────────────────────────────────────────────────────────────────────────────
// El catálogo de facultades, vivo.
//
// Mismo patrón que `mappingCache.publishMapping` y `publishBounds` en usePins:
// quien tiene los datos los deja aquí y el resto los lee de forma SÍNCRONA, sin
// hooks. Hace falta porque media app consulta las facultades desde sitios que
// no son React —`pins/api.ts` resuelve la facultad de un pin por perímetro— y
// porque son ~26 archivos los que hacen `FACULTIES.find(...)`: migrarlos a un
// hook con su estado de carga sería el camino caro y no compra nada.
//
// La caché arranca SEMBRADA con el catálogo estático —nombres, campus y
// chinchetas—, y eso es lo que evita los estados de carga: la lista nunca está
// vacía. La GEOMETRÍA no se siembra: los perímetros viven solo en la base, así
// que hasta que llegue la consulta el mapa no pinta contornos.
//
// Lo único que sí necesita reaccionar es lo que PINTA una lista de facultades.
// Para eso está `useFaculties()`.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ NO añadas aquí un índice de perímetros aparte.
//
// Lo hubo, y costó una tarde: el catálogo y ese índice eran dos contenedores
// que había que mantener a la par, y en cuanto uno se quedó atrás el editor
// enseñaba el NOMBRE nuevo de una facultad junto a un "sin trazar" que ya no
// era cierto. Todo se deriva de `FACULTIES`, y por eso no pueden discrepar.
//
// La contrapartida es que `Faculty.polygon` significa una sola cosa —el
// perímetro trazado, o null si no lo tiene— y no cae a ninguna huella
// aproximada. Un cuadrado alrededor de la chincheta le daría a `facultyIdAt`
// un contorno que nadie dibujó, y con él un pin en mitad de la calle acabaría
// dentro de una facultad.

let version = 0
const listeners = new Set<() => void>()

/**
 * Reemplaza el catálogo con lo que hay en la base.
 *
 * `splice` y no una reasignación: ver el comentario de `FACULTIES`. Una lista
 * vacía se ignora — significa que la consulta no trajo nada, y quedarse sin
 * facultades rompe la app entera; el catálogo de siempre es mejor respuesta.
 */
export function publishFaculties(rows: Faculty[]): void {
  if (rows.length === 0) return

  FACULTIES.splice(0, FACULTIES.length, ...rows.map((row) => ({ ...row })))

  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * El catálogo, re-renderizando el componente cuando llegue el de la base.
 *
 * Devuelve SIEMPRE la misma referencia (`FACULTIES`), así que lo que dispara el
 * render es el número de versión, no la identidad del array. Un componente que
 * solo hace una consulta puntual (`FACULTIES.find(...)` dentro de un manejador)
 * no necesita este hook.
 */
export function useFaculties(): Faculty[] {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  )
  return FACULTIES
}

/** Se suscribe fuera de React. Lo usa el mapa para repintar los contornos. */
export function subscribeFaculties(listener: () => void): () => void {
  return subscribe(listener)
}

/** El perímetro trazado de una facultad, o null si todavía no tiene. */
export function facultyPerimeter(facultyId: string): Polygon | null {
  return FACULTIES.find((x) => x.id === facultyId)?.polygon ?? null
}

/** Las facultades que SÍ tienen perímetro, para recorrerlas. */
export function facultyPerimeterEntries(): [string, Polygon][] {
  return FACULTIES.flatMap((x) => (x.polygon ? [[x.id, x.polygon] as [string, Polygon]] : []))
}

/**
 * Distancia Euclidiana simple (aprox) para desempatar cuando un punto cae
 * dentro de múltiples polígonos que se solapan (como Biblioteca y Ciencias Sociales).
 */
function distance(lat1: number, lng1: number, lat2: number, lng2: number) {
  return Math.hypot(lat1 - lat2, lng1 - lng2)
}

/**
 * Cluster automático: devuelve el faculty_id cuyo perímetro contiene el punto.
 * Si hay múltiples, elige el cuyo "centro" (marcador) esté más cerca.
 */
export function facultyIdAt(lat: number, lng: number): string | null {
  const matches: string[] = []

  for (const [facultyId, polygon] of facultyPerimeterEntries()) {
    if (isPointInPolygon({ lat, lng }, polygon)) {
      matches.push(facultyId)
    }
  }

  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]

  // Si cae en una zona donde varios polígonos se solapan accidentalmente,
  // buscamos la facultad que tenga su chincheta oficial más cerca de ese punto.
  let bestMatch = matches[0]
  let minDistance = Infinity

  for (const id of matches) {
    const faculty = FACULTIES.find((x) => x.id === id)
    if (faculty) {
      const d = distance(lat, lng, faculty.lat, faculty.lng)
      if (d < minDistance) {
        minDistance = d
        bestMatch = id
      }
    }
  }

  return bestMatch
}

/** Los perímetros como FeatureCollection para pintarlos en MapLibre. */
export function facultyPerimetersGeoJSON(): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = facultyPerimeterEntries().map(
    ([facultyId, polygon]) => ({
      type: 'Feature',
      properties: { faculty_id: facultyId },
      geometry: polygon,
    }),
  )
  return { type: 'FeatureCollection', features }
}
