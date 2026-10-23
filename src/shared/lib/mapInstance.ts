import { useSyncExternalStore } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

// ─────────────────────────────────────────────────────────────────────────────
// La instancia del mapa público, para quien pinta encima sin ser `MapView`.
//
// La navegación interior dibuja capas, mueve la cámara y coloca etiquetas en
// cada frame. Pasar eso por props re-renderizaría la pantalla del mapa sesenta
// veces por segundo, e importar de `features/map` añadiría otro ciclo entre
// dominios. `MapView` publica aquí el mapa y avisa cada vez que termina de
// cargar un estilo, porque `setStyle` (el modo oscuro) borra las capas propias.
// ─────────────────────────────────────────────────────────────────────────────

let current: MapLibreMap | null = null
let styleEpoch = 0
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

export function publishMap(map: MapLibreMap | null): void {
  current = map
  if (map === null) styleEpoch = 0
  notify()
}

/** Lo llama `MapView` al terminar cada 'style.load', con sus capas ya creadas. */
export function markMapStyleLoaded(): void {
  styleEpoch += 1
  notify()
}

export function currentMap(): MapLibreMap | null {
  return current
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Cuántos estilos se han cargado en el mapa actual (0 = ninguno todavía). Un
 * efecto que dependa de esto vuelve a crear sus capas tras un `setStyle`.
 */
export function useMapStyleEpoch(): number {
  return useSyncExternalStore(subscribe, () => styleEpoch)
}
