import maplibregl, {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from 'maplibre-gl'

// ─────────────────────────────────────────────────────────────────────────────
// Etiquetas HTML en altura.
//
// Las capas `symbol` se dibujan siempre a ras de suelo: el nombre de una sala
// del piso 5 separado quedaría en la calle. Esto es una capa custom que no
// pinta nada; aprovecha la matriz que MapLibre le pasa en cada frame para mover
// `<div>` sobre el canvas, a la altura de su planta.
//
// Solo vale para la proyección mercator. Si algún día se activa el globo hay
// que revisarlo.
//
// El contenido de una etiqueta solo se rehace si cambió: rehacer `innerHTML`
// en cada frame parpadea, igual que pasaba con los marcadores del mapa.
// ─────────────────────────────────────────────────────────────────────────────

export interface OverlayLabel {
  lngLat: [number, number]
  /** Metros sobre el suelo. */
  altitude: number
  html: string
  /** `bottom` apoya la etiqueta encima del punto (globos); `center`, centrada. */
  anchor?: 'center' | 'bottom'
  className?: string
  onClick?: () => void
}

interface Item {
  el: HTMLDivElement
  m: maplibregl.MercatorCoordinate
  label: OverlayLabel
}

const LAYER_ID = 'indoor-labels'

export class LabelOverlay implements CustomLayerInterface {
  readonly id = LAYER_ID
  readonly type = 'custom' as const
  readonly renderingMode = '3d' as const
  private map: MapLibreMap | null = null
  private readonly container: HTMLDivElement
  private readonly items = new Map<string, Item>()

  constructor() {
    this.container = document.createElement('div')
    this.container.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2'
  }

  onAdd(map: MapLibreMap): void {
    this.map = map
    map.getCanvasContainer().appendChild(this.container)
  }

  onRemove(): void {
    this.container.remove()
    this.map = null
  }

  set(id: string, label: OverlayLabel): void {
    let item = this.items.get(id)
    if (!item) {
      const el = document.createElement('div')
      el.style.cssText = 'position:absolute;left:0;top:0;will-change:transform'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        this.items.get(id)?.label.onClick?.()
      })
      this.container.appendChild(el)
      item = {
        el,
        m: maplibregl.MercatorCoordinate.fromLngLat(label.lngLat, label.altitude),
        label,
      }
      this.items.set(id, item)
      item.el.innerHTML = label.html
    } else if (item.label.html !== label.html) {
      item.el.innerHTML = label.html
    }
    item.el.className = label.className ?? ''
    item.el.style.pointerEvents = label.onClick ? 'auto' : 'none'
    item.el.style.cursor = label.onClick ? 'pointer' : ''
    item.m = maplibregl.MercatorCoordinate.fromLngLat(label.lngLat, label.altitude)
    item.label = label
    this.map?.triggerRepaint()
  }

  /** Mueve una etiqueta sin tocar su contenido: la del globo sigue a la figura. */
  move(id: string, lngLat: [number, number], altitude: number): void {
    const item = this.items.get(id)
    if (!item) return
    item.m = maplibregl.MercatorCoordinate.fromLngLat(lngLat, altitude)
    item.label = { ...item.label, lngLat, altitude }
    this.map?.triggerRepaint()
  }

  remove(id: string): void {
    const item = this.items.get(id)
    if (!item) return
    item.el.remove()
    this.items.delete(id)
    this.map?.triggerRepaint()
  }

  /** Quita las etiquetas cuyo id empieza por `prefix` (todas si no se indica). */
  clear(prefix = ''): void {
    for (const [id, item] of this.items) {
      if (!id.startsWith(prefix)) continue
      item.el.remove()
      this.items.delete(id)
    }
    this.map?.triggerRepaint()
  }

  ids(prefix = ''): string[] {
    return [...this.items.keys()].filter((id) => id.startsWith(prefix))
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput): void {
    const map = this.map
    if (!map) return
    const M = args.defaultProjectionData.mainMatrix
    const canvas = map.getCanvas()
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    for (const { el, m, label } of this.items.values()) {
      // Matriz en orden de columnas, como la entrega MapLibre.
      const cx = M[0] * m.x + M[4] * m.y + M[8] * m.z + M[12]
      const cy = M[1] * m.x + M[5] * m.y + M[9] * m.z + M[13]
      const cw = M[3] * m.x + M[7] * m.y + M[11] * m.z + M[15]
      if (cw <= 0) {
        // Detrás de la cámara.
        el.style.display = 'none'
        continue
      }
      const sx = ((cx / cw + 1) / 2) * w
      const sy = ((1 - cy / cw) / 2) * h
      const ay = label.anchor === 'bottom' ? 'calc(-100% - 6px)' : '-50%'
      el.style.display = ''
      el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, ${ay})`
    }
  }
}

const overlays = new WeakMap<MapLibreMap, LabelOverlay>()

/**
 * La capa de etiquetas del mapa, una sola para la ruta y la vista explotada.
 * Se vuelve a añadir si un `setStyle` la quitó; sus etiquetas sobreviven.
 */
export function labelOverlay(map: MapLibreMap): LabelOverlay {
  let overlay = overlays.get(map)
  if (!overlay) {
    overlay = new LabelOverlay()
    overlays.set(map, overlay)
  }
  if (!map.getLayer(LAYER_ID)) map.addLayer(overlay)
  return overlay
}

export function hasLabelOverlay(map: MapLibreMap): boolean {
  return overlays.has(map)
}
