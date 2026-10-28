import { create } from 'zustand'
import type { FeatureCollection } from 'geojson'

// ─────────────────────────────────────────────────────────────────────────────
// Estado volátil de la herramienta "Navegación" del editor.
//
// El lienzo no sabe nada del grafo: pinta `overlay` y entrega cada clic a
// `onClick`, que registra el panel. Así el lienzo no crece con la lógica de
// puertas, pasillos y núcleos, y el panel no necesita la instancia del mapa.
// ─────────────────────────────────────────────────────────────────────────────

export type NavMode =
  'select' | 'door' | 'corridor' | 'stairs' | 'elevator' | 'entrance' | 'outdoor' | 'link'

export interface NavClick {
  lng: number
  lat: number
  /** Nodo bajo el cursor, si lo hay. */
  nodeId: string | null
}

interface NavEditorState {
  mode: NavMode
  setMode: (mode: NavMode) => void
  /** Eje del pasillo que se está trazando, en lng/lat. */
  axis: [number, number][]
  setAxis: (axis: [number, number][]) => void
  selectedNodeId: string | null
  selectNode: (id: string | null) => void
  /** Primer extremo de una arista que se está uniendo a mano. */
  linkFrom: string | null
  setLinkFrom: (id: string | null) => void
  overlay: FeatureCollection
  setOverlay: (overlay: FeatureCollection) => void
  onClick: ((click: NavClick) => void) | null
  onFinish: (() => void) | null
  setHandlers: (onClick: ((click: NavClick) => void) | null, onFinish: (() => void) | null) => void
}

export const EMPTY_OVERLAY: FeatureCollection = { type: 'FeatureCollection', features: [] }

export const useNavEditor = create<NavEditorState>((set) => ({
  mode: 'select',
  // Cambiar de modo descarta el pasillo y la unión a medias.
  setMode: (mode) => set({ mode, axis: [], linkFrom: null }),
  axis: [],
  setAxis: (axis) => set({ axis }),
  selectedNodeId: null,
  selectNode: (id) => set({ selectedNodeId: id }),
  linkFrom: null,
  setLinkFrom: (id) => set({ linkFrom: id }),
  overlay: EMPTY_OVERLAY,
  setOverlay: (overlay) => set({ overlay }),
  onClick: null,
  onFinish: null,
  setHandlers: (onClick, onFinish) => set({ onClick, onFinish }),
}))
