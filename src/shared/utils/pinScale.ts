/**
 * Cuánto crece el marcador con el zoom (ROADMAP §9.3).
 *
 * Se devuelve como factor y no como píxeles porque el tamaño se aplica con
 * `width`/`height` sobre una base que depende del tipo de pin, y porque
 * `transform: scale()` está descartado: el `transform` del marcador es de
 * MapLibre y componer con el suyo lo manda lejos del cursor.
 *
 * El factor NUNCA baja de 1. La primera versión encogía a 20 px por debajo de
 * zoom 18 y se veía mal de verdad: multiplicado por la base más pequeña de la
 * infraestructura fija dejaba pines de 14 px, ilegibles y difíciles de tocar.
 * De lejos el problema no es que los pines sobren de tamaño, es que sobran de
 * número, y eso lo resuelve el detalle por zoom, no achicarlos.
 */
const BASE_PX = 26

export function pinScaleForZoom(zoom: number): number {
  if (zoom <= 18) return 1
  const px = Math.min(30, 26 + (zoom - 18) * 4)
  return Math.round((px / BASE_PX) * 1000) / 1000
}
