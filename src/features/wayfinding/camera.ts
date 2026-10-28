import type { EaseToOptions, Map as MapLibreMap, PaddingOptions } from 'maplibre-gl'
import { bearingOf, zMeters, type LocalPlane } from '@/shared/utils/indoor/projection'
import type { Pose } from '@/shared/utils/indoor/track'

// ─────────────────────────────────────────────────────────────────────────────
// La cámara de la navegación.
//
// Trampas de MapLibre 5 que ya costaron tiempo en el prototipo:
//   · `centerClampedToGround` tiene que estar apagado mientras se navega: si no,
//     la cámara se clava al suelo y no puede centrarse en un piso 5.
//   · `easeTo` ignora `elevation`; solo `jumpTo` la respeta. Para volar suave a
//     una planta alta, la altura se anima aparte.
//   · No usar `map.setPadding()` para la hoja: corta el `easeTo` en curso cada
//     vez que la hoja cambia de alto. El padding va en cada llamada.
// ─────────────────────────────────────────────────────────────────────────────

const WALK_ZOOM = 20
const WALK_PITCH = 62
/** En escalera y ascensor la cámara se aleja un poco para que se vea el núcleo. */
const CORE_ZOOM = 19.2
const CORE_PITCH = 55
/** Cuánto se acerca el rumbo de la cámara al de la marcha por segundo. */
const BEARING_RATE = 2.6
const ZOOM_RATE = 2
/** La cámara mira a la altura de los ojos, no a los pies. */
const EYE_M = 0.8

/** El hueco que deja la hoja: abajo en móvil, a la derecha en escritorio. */
export function sheetPadding(sheet: HTMLElement | null): PaddingOptions {
  const padding = { top: 90, bottom: 40, left: 40, right: 40 }
  if (!sheet) return padding
  const rect = sheet.getBoundingClientRect()
  if (window.innerWidth >= 640) padding.right = Math.max(40, window.innerWidth - rect.left + 16)
  else padding.bottom = Math.max(40, window.innerHeight - rect.top + 12)
  return padding
}

/** `easeTo` con la altura del centro animada a mano, que es lo que no hace. */
export function easeCamera(
  map: MapLibreMap,
  options: EaseToOptions,
  elevation: number,
  duration = 750,
): void {
  const from = map.getCenterElevation()
  map.easeTo({ ...options, duration })
  const start = performance.now()
  const step = (now: number) => {
    const f = Math.min(1, (now - start) / duration)
    map.setCenterElevation(from + (elevation - from) * (f * f * (3 - 2 * f)))
    if (f < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export interface FollowState {
  bearing: number | null
  zoom: number | null
  pitch: number | null
}

export function newFollowState(): FollowState {
  return { bearing: null, zoom: null, pitch: null }
}

/**
 * Un frame de cámara que sigue a la figura. En escalera y ascensor NO gira: la
 * U da dos medias vueltas por piso y la cámara daría 360° en cuatro segundos.
 */
export function followPose(
  map: MapLibreMap,
  pose: Pose,
  plane: LocalPlane,
  gap: number,
  state: FollowState,
  dt: number,
  padding: PaddingOptions,
  instant: boolean,
): void {
  const vertical = pose.kind === 'stairs' || pose.kind === 'elevator'
  const approach = (current: number | null, target: number, rate: number) =>
    current === null || instant || dt === 0
      ? target
      : current + (target - current) * Math.min(1, dt * rate)

  let bearing = state.bearing ?? map.getBearing()
  if (!vertical) {
    // Por el camino corto: de 350° a 10° son 20°, no 340°.
    const delta = ((bearingOf(pose.heading) - bearing + 540) % 360) - 180
    bearing =
      instant || dt === 0 ? bearing + delta : bearing + delta * Math.min(1, dt * BEARING_RATE)
  }
  state.bearing = bearing
  state.zoom = approach(state.zoom, vertical ? CORE_ZOOM : WALK_ZOOM, ZOOM_RATE)
  state.pitch = approach(state.pitch, vertical ? CORE_PITCH : WALK_PITCH, ZOOM_RATE)

  map.jumpTo({
    center: plane.toLngLat(pose.p),
    zoom: state.zoom,
    pitch: state.pitch,
    bearing,
    elevation: zMeters(pose.z, gap) + EYE_M,
    padding,
  })
}
