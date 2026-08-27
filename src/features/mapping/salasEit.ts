import { useQuery } from '@tanstack/react-query'
import { buildRoomCatalog, type CatalogRoom } from '@/shared/utils/roomCatalog'

// ─────────────────────────────────────────────────────────────────────────────
// El horario de salas de la FIC, como catálogo para el editor.
//
// Fuente: `salas.docencia-eit.cl/data.json`, el archivo que consume la web de
// "salas vacías" de la Facultad de Ingeniería y Ciencias. Todo lo que hay que
// saber antes de apoyarse en ella está en `docs/SALAS.md` §1, y lo importante
// es esto:
//
//   · NO es una API oficial de la universidad. Es un archivo estático servido
//     en Vercel, sin versión, sin contrato y sin licencia publicada. Puede
//     cambiar de forma o desaparecer sin avisar.
//   · Por eso esto NUNCA lanza: si algo falla, devuelve un catálogo vacío y el
//     importador dice que no hay datos. Un fallo de un tercero no puede tumbar
//     el editor de mapeo.
//   · Se usa SOLO en `/admin/mapeo`, o sea que hoy no se le pide nada a ese
//     servidor desde la aplicación pública. Antes de llevarlo al mapa de los
//     estudiantes hay que hablar con quien lo mantiene (`docs/SALAS.md` §1):
//     que un archivo sea accesible no lo hace un permiso.
//   · Solo cubre la FIC. Trae salas de otras facultades, pero únicamente las
//     que la FIC usa — no su horario completo.
// ─────────────────────────────────────────────────────────────────────────────

const DATA_URL = 'https://salas.docencia-eit.cl/data.json'

interface SalasEdge {
  node?: { place?: unknown }
}

/**
 * Descarga el horario y lo reduce a catálogo de salas.
 *
 * No se lleva la cuenta del `ETag` a mano: la petición es un GET normal y el
 * caché HTTP del navegador ya revalida con `If-None-Match`. Añadir una copia en
 * `localStorage` sería un segundo caché que mantener a la par del primero, y
 * react-query ya evita las descargas repetidas dentro de la sesión.
 */
export async function fetchEitRoomCatalog(signal?: AbortSignal): Promise<CatalogRoom[]> {
  try {
    const response = await fetch(DATA_URL, { signal })
    if (!response.ok) {
      console.error('[salas-eit] La fuente respondió', response.status)
      return []
    }
    const payload: unknown = await response.json()
    const edges = (payload as { data?: { allSalasUdps?: { edges?: unknown } } })?.data?.allSalasUdps
      ?.edges
    if (!Array.isArray(edges)) {
      console.error('[salas-eit] El JSON no tiene la forma esperada')
      return []
    }
    const places = (edges as SalasEdge[])
      .map((edge) => edge?.node?.place)
      .filter((place): place is string => typeof place === 'string')
    return buildRoomCatalog(places)
  } catch (cause) {
    // Un AbortError es normal —el componente se desmontó—, no un fallo.
    if (cause instanceof DOMException && cause.name === 'AbortError') return []
    console.error('[salas-eit] No se pudo leer el horario de salas:', cause)
    return []
  }
}

/** El catálogo, cacheado por sesión. Cambia como mucho una vez por semestre. */
export function useEitRoomCatalog() {
  return useQuery({
    queryKey: ['eit-room-catalog'],
    queryFn: ({ signal }) => fetchEitRoomCatalog(signal),
    staleTime: 60 * 60 * 1000,
    // `fetchEitRoomCatalog` no lanza nunca: devuelve [] y ya. Reintentar sería
    // repetir una petición que no va a mejorar.
    retry: false,
  })
}
