import { create } from 'zustand'
import type { Polygon, Position } from 'geojson'
import { openRing, polygonFromRing, rectangleFrom } from '@/shared/utils/geometry'

// ─────────────────────────────────────────────────────────────────────────────
// Estado del editor de mapeo. Solo lo volátil: qué está seleccionado, qué
// herramienta está activa y qué se está dibujando. Lo persistido vive en
// Supabase y se consulta con react-query.
//
// El borrador tiene dos formas porque las dos hacen falta:
//
//   'rect'  guarda ancla + dimensiones + giro. Girar es entonces RÍGIDO: el
//           rectángulo pivota sin cambiar de tamaño. Si se guardaran las cuatro
//           esquinas, girar las reinterpretaría y la superficie cambiaría sola.
//   'ring'  guarda los vértices sueltos. Es lo que se necesita para una forma
//           en L y para editar vértice a vértice.
//
// Un 'rect' se DEGRADA a 'ring' en cuanto se arrastra un vértice suelto: a
// partir de ahí ya no es un rectángulo y el tirador de rotación desaparece. Es
// un camino de ida, y es deliberado: mantener las dos representaciones en
// sincronía tras una edición libre no tiene una respuesta correcta.
// ─────────────────────────────────────────────────────────────────────────────

export type Tool = 'select' | 'rect' | 'polygon' | 'trace'

export type Draft =
  | {
      kind: 'rect'
      anchor: Position
      widthM: number
      heightM: number
      rotationRad: number
      /** `sizing` mientras se arrastra la diagonal; `ready` cuando ya tiene forma. */
      phase: 'sizing' | 'ready'
    }
  | {
      kind: 'ring'
      ring: Position[]
      phase: 'drawing' | 'ready'
    }

/** El polígono que representa un borrador, listo para pintar o guardar. */
export function draftPolygon(draft: Draft): Polygon | null {
  if (draft.kind === 'rect') {
    if (Math.abs(draft.widthM) < 0.01 || Math.abs(draft.heightM) < 0.01) return null
    return rectangleFrom(draft.anchor, draft.widthM, draft.heightM, draft.rotationRad)
  }
  if (draft.ring.length < 3) return null
  return polygonFromRing(draft.ring)
}

/** Los vértices de un borrador, para dibujar los tiradores. */
export function draftVertices(draft: Draft): Position[] {
  if (draft.kind === 'ring') return draft.ring
  const polygon = draftPolygon(draft)
  return polygon ? openRing(polygon.coordinates[0]) : []
}

/**
 * Clave de una planta concreta, para agrupar áreas por planta. El exterior es
 * una planta más: `exterior:none`.
 */
export function floorKey(buildingId: string | null, level: number | null): string {
  return `${buildingId ?? 'exterior'}:${level ?? 'none'}`
}

/**
 * Qué planta se está viendo, sea cual sea el modo. Un solo sitio que lo
 * resuelva evita que el lienzo, el formulario y las validaciones lleguen cada
 * uno a una conclusión distinta.
 *
 * En la vista 'level' no hay edificio fijado: el filtro es solo el nivel, y
 * atraviesa todos los edificios.
 */
export function activeFloorOf(state: {
  viewMode: FloorViewMode
  activeLevel: number | null
  selectedBuildingId: string | null
  selectedFloor: number | null
}): { level: number | null; buildingId: string | null; crossBuilding: boolean } {
  if (state.viewMode === 'level') {
    return { level: state.activeLevel, buildingId: null, crossBuilding: true }
  }
  return {
    level: state.selectedFloor,
    buildingId: state.selectedBuildingId,
    crossBuilding: false,
  }
}

const HISTORY_LIMIT = 50

/**
 * Cómo se recorre el mapeo.
 *
 *   'building'  edificio → planta. Para trazar el interior de UN edificio.
 *   'level'     una planta de TODA la facultad a la vez: el piso 1 de cada
 *               edificio más el exterior. Es la vista que se parece a lo que
 *               después ve el estudiante, y la buena para revisar que todo
 *               calce entre edificios.
 *
 * En 'level' no hay edificio seleccionado: el de un área nueva se deduce del
 * punto donde se dibuja, igual que la facultad de un pin.
 */
export type FloorViewMode = 'building' | 'level'

interface MappingEditorState {
  facultyId: string
  setFacultyId: (id: string) => void

  viewMode: FloorViewMode
  setViewMode: (mode: FloorViewMode) => void
  /** Planta activa en la vista 'level'. null ⇔ solo exterior. */
  activeLevel: number | null
  setActiveLevel: (level: number | null) => void

  /** null ⇔ se está trabajando en el exterior de la facultad. */
  selectedBuildingId: string | null
  selectedFloor: number | null
  selectedAreaId: string | null
  selectBuilding: (buildingId: string | null) => void
  selectFloor: (buildingId: string, level: number) => void
  selectArea: (areaId: string | null) => void
  selectOutdoor: () => void

  tool: Tool
  setTool: (tool: Tool) => void

  draft: Draft | null
  setDraft: (draft: Draft | null) => void
  /** Como setDraft, pero deja el estado anterior en el historial. */
  commitDraft: (draft: Draft | null) => void
  degradeToRing: (ring: Position[]) => void

  /** Shift: aristas a múltiplos de 45° respecto de la veta del edificio. */
  ortho: boolean
  setOrtho: (v: boolean) => void
  /** Alt: desactiva los imanes momentáneamente. */
  snapEnabled: boolean
  setSnapEnabled: (v: boolean) => void
  /** Fantasma de la planta inferior, para calcar. */
  showGhostFloor: boolean
  toggleGhostFloor: () => void
  /** Pinta en gris lo que queda de la planta sin ningún área. */
  showCoverage: boolean
  toggleCoverage: () => void

  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  resetHistory: () => void
}

export const useMappingEditor = create<MappingEditorState>((set, get) => {
  // Los historiales van fuera del estado de React: no se pintan, y meterlos
  // dentro provocaría un render por cada vértice movido.
  let past: (Draft | null)[] = []
  let future: (Draft | null)[] = []

  const syncHistoryFlags = () => set({ canUndo: past.length > 0, canRedo: future.length > 0 })

  const clearDraft = () => {
    past = []
    future = []
    set({ draft: null, canUndo: false, canRedo: false })
  }

  return {
    facultyId: 'ingenieria',
    setFacultyId: (id) => {
      clearDraft()
      set({ facultyId: id, selectedBuildingId: null, selectedFloor: null, selectedAreaId: null })
    },

    viewMode: 'building',
    setViewMode: (mode) => {
      clearDraft()
      // Cambiar de vista deselecciona: lo que estaba elegido en una no tiene
      // por qué significar lo mismo en la otra.
      set({ viewMode: mode, selectedAreaId: null, tool: 'select' })
    },
    activeLevel: 1,
    setActiveLevel: (level) => {
      clearDraft()
      set({ activeLevel: level, selectedAreaId: null, tool: 'select' })
    },

    selectedBuildingId: null,
    selectedFloor: null,
    selectedAreaId: null,

    selectBuilding: (buildingId) => {
      clearDraft()
      set({ selectedBuildingId: buildingId, selectedFloor: null, selectedAreaId: null, tool: 'select' })
    },
    selectFloor: (buildingId, level) => {
      clearDraft()
      set({ selectedBuildingId: buildingId, selectedFloor: level, selectedAreaId: null, tool: 'select' })
    },
    selectArea: (areaId) => {
      clearDraft()
      set({ selectedAreaId: areaId, tool: 'select' })
    },
    selectOutdoor: () => {
      clearDraft()
      set({ selectedBuildingId: null, selectedFloor: null, selectedAreaId: null, tool: 'select' })
    },

    tool: 'select',
    setTool: (tool) => {
      // Cambiar de herramienta descarta lo que se estuviera trazando: dejarlo a
      // medias entre dos modos es la vía rápida a un estado imposible.
      clearDraft()
      set({ tool })
    },

    draft: null,
    setDraft: (draft) => set({ draft }),

    commitDraft: (draft) => {
      past = [...past.slice(-HISTORY_LIMIT + 1), get().draft]
      future = []
      set({ draft })
      syncHistoryFlags()
    },

    degradeToRing: (ring) => {
      past = [...past.slice(-HISTORY_LIMIT + 1), get().draft]
      future = []
      set({ draft: { kind: 'ring', ring, phase: 'ready' } })
      syncHistoryFlags()
    },

    ortho: false,
    setOrtho: (v) => set({ ortho: v }),
    snapEnabled: true,
    setSnapEnabled: (v) => set({ snapEnabled: v }),
    showGhostFloor: true,
    toggleGhostFloor: () => set((s) => ({ showGhostFloor: !s.showGhostFloor })),
    showCoverage: false,
    toggleCoverage: () => set((s) => ({ showCoverage: !s.showCoverage })),

    undo: () => {
      if (past.length === 0) return
      const previous = past[past.length - 1]
      past = past.slice(0, -1)
      future = [get().draft, ...future].slice(0, HISTORY_LIMIT)
      set({ draft: previous })
      syncHistoryFlags()
    },
    redo: () => {
      if (future.length === 0) return
      const [next, ...rest] = future
      future = rest
      past = [...past.slice(-HISTORY_LIMIT + 1), get().draft]
      set({ draft: next })
      syncHistoryFlags()
    },
    canUndo: false,
    canRedo: false,
    resetHistory: clearDraft,
  }
})
