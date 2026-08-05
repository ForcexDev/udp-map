import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'system'

interface DraftLocation {
  lat: number
  lng: number
}

type DraftPinType = 'report' | 'place' | 'event' | null

/**
 * Qué lugar mapeado se tocó para abrir la ficha de la facultad.
 *
 * NO abre un panel propio. Antes cada edificio y cada área tenían su tarjeta
 * ("Edificio Ejército 441 · Nada publicado aquí todavía"), que competía con el
 * feed de la facultad y repartía los posts en fichas casi siempre vacías. Ahora
 * hay una sola ficha, la de la facultad, y esto solo dice por dónde se entró
 * para preseleccionar ese lugar en su filtro.
 */
export interface PlaceFocus {
  kind: 'area' | 'building'
  id: string
}

interface UIState {
  theme: Theme
  setTheme: (theme: Theme) => void

  campusId: string
  setCampusId: (id: string) => void

  loginModalOpen: boolean
  openLoginModal: () => void
  closeLoginModal: () => void

  tutorialOpen: boolean
  openTutorial: () => void
  closeTutorial: () => void

  aboutOpen: boolean
  openAbout: () => void
  closeAbout: () => void

  createModalOpen: boolean
  pinToEdit: string | null
  openCreateModal: (pinId?: string) => void
  closeCreateModal: () => void

  /** Modo "toca el mapa para fijar ubicación" antes de abrir el formulario */
  pickingLocation: boolean
  draftPinType: DraftPinType
  startPickingLocation: (type?: DraftPinType) => void
  cancelPickingLocation: () => void
  draftLocation: DraftLocation | null
  setDraftLocation: (loc: DraftLocation) => void

  /** ID del pin que se está moviendo actualmente (reubicación) */
  movingPinId: string | null
  startMovingPin: (id: string) => void
  cancelMovingPin: () => void

  selectedPinId: string | null
  selectPin: (id: string | null) => void

  selectedFacultyId: string | null
  selectFaculty: (id: string | null) => void

  /** Destino activo de ruteo ("cómo llegar") */
  routeTargetPinId: string | null
  setRouteTarget: (id: string | null) => void
  accessibleRoute: boolean
  setAccessibleRoute: (v: boolean) => void

  /**
   * Planta que se está mirando, y en qué FACULTAD.
   *
   * La planta es de la facultad entera, no de un edificio. "Piso 2" quiere
   * decir el segundo piso de los cuatro edificios a la vez: los que lo tengan
   * enseñan lo suyo y el que no, nada. Atarla a un edificio hacía que cruzar de
   * uno a otro cambiara de piso solo, y dejaba al resto de la facultad
   * enseñando todos sus pisos superpuestos.
   *
   * Es una dimensión de la VISTA, no un filtro de contenido: por eso vive aquí
   * y no en filterStore. Un filtro sobrevive al cambiar de pantalla ("solo
   * comida"); esto se resetea al salir de la facultad, porque "estar en el piso
   * 3" no significa nada desde el Foro.
   *
   * `activeFloor` null = "Todo": cada edificio enseña su planta por defecto.
   */
  activeFacultyId: string | null
  activeFloor: number | null
  setActiveMappingFaculty: (facultyId: string | null, floor?: number | null) => void
  setActiveFloor: (floor: number | null) => void

  /**
   * Edificio o área por el que se entró al feed de la facultad, para
   * preseleccionarlo en su filtro. No abre panel propio: ver `PlaceFocus`.
   */
  placeFocus: PlaceFocus | null
  setPlaceFocus: (place: PlaceFocus | null) => void

  toast: string | null
  showToast: (msg: string) => void
  clearToast: () => void

  viewMode: '2d' | '3d'
  setViewMode: (mode: '2d' | '3d') => void

  /** Admin-only: bypass all boundary restrictions for testing */
  devUnlockMap: boolean
  setDevUnlockMap: (v: boolean) => void
}

function initialTheme(): Theme {
  const stored = localStorage.getItem('udpmap.theme')
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function applyTheme(theme: Theme) {
  if (theme === 'system') {
    const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  } else {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }
  localStorage.setItem('udpmap.theme', theme)
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useUIStore = create<UIState>((set) => {
  const theme = initialTheme()
  applyTheme(theme)
  return {
    theme,
    setTheme: (next) => {
      applyTheme(next)
      set({ theme: next })
    },

    campusId: localStorage.getItem('udpmap.campus') ?? 'ejercito',
    setCampusId: (id) => {
      localStorage.setItem('udpmap.campus', id)
      set({ campusId: id })
    },

    loginModalOpen: false,
    openLoginModal: () => set({ loginModalOpen: true }),
    closeLoginModal: () => set({ loginModalOpen: false }),

    tutorialOpen: localStorage.getItem('udpmap.tutorial') !== 'true',
    openTutorial: () => set({ tutorialOpen: true }),
    closeTutorial: () => {
      localStorage.setItem('udpmap.tutorial', 'true')
      set({ tutorialOpen: false })
    },

    aboutOpen: false,
    openAbout: () => set({ aboutOpen: true }),
    closeAbout: () => set({ aboutOpen: false }),

    createModalOpen: false,
    pinToEdit: null,
    openCreateModal: (pinId) => set({ createModalOpen: true, pinToEdit: pinId ?? null }),
    closeCreateModal: () => set({ createModalOpen: false, pinToEdit: null, draftPinType: null }),

    pickingLocation: false,
    draftPinType: null,
    startPickingLocation: (type) =>
      set({ pickingLocation: true, draftPinType: type ?? null, selectedPinId: null, createModalOpen: false }),
    cancelPickingLocation: () => set({ pickingLocation: false, draftPinType: null }),
    draftLocation: null,
    setDraftLocation: (loc) =>
      set({ draftLocation: loc, pickingLocation: false, createModalOpen: true }),

    movingPinId: null,
    startMovingPin: (id) => set({ movingPinId: id, selectedPinId: null }),
    cancelMovingPin: () => set({ movingPinId: null }),

    selectedPinId: null,
    selectPin: (id) =>
      set({ selectedPinId: id, selectedFacultyId: null, movingPinId: null, placeFocus: null }),

    selectedFacultyId: null,
    // Los dos paneles del mapa —el pin y la facultad— se excluyen entre sí: son
    // dos respuestas a la misma pregunta ("¿qué toqué?"), y enseñar las dos
    // deja una asomando por detrás de la otra.
    //
    // Cerrar la ficha (id null) también suelta el lugar enfocado: si no, al
    // reabrirla volvería filtrada por un edificio que ya nadie eligió.
    selectFaculty: (id) =>
      set({
        selectedFacultyId: id,
        selectedPinId: null,
        movingPinId: null,
        ...(id === null ? { placeFocus: null } : {}),
      }),

    routeTargetPinId: null,
    setRouteTarget: (id) => set({ routeTargetPinId: id }),
    accessibleRoute: false,
    setAccessibleRoute: (v) => set({ accessibleRoute: v }),

    activeFacultyId: null,
    activeFloor: null,
    setActiveMappingFaculty: (facultyId, floor = null) =>
      set({ activeFacultyId: facultyId, activeFloor: facultyId === null ? null : floor }),
    setActiveFloor: (floor) => set({ activeFloor: floor }),

    placeFocus: null,
    setPlaceFocus: (place) => set({ placeFocus: place }),

    toast: null,
    showToast: (msg) => {
      clearTimeout(toastTimer)
      set({ toast: msg })
      toastTimer = setTimeout(() => set({ toast: null }), msg.length > 80 ? 6500 : 3500)
    },
    clearToast: () => set({ toast: null }),

    viewMode: '2d',
    setViewMode: (mode) => set({ viewMode: mode }),

    devUnlockMap: localStorage.getItem('udpmap.devUnlock') === 'true',
    setDevUnlockMap: (v) => {
      localStorage.setItem('udpmap.devUnlock', String(v))
      set({ devUnlockMap: v })
    },
  }
})

// Escuchar cambios del esquema de colores a nivel de sistema operativo
if (typeof window !== 'undefined' && window.matchMedia) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    if (useUIStore.getState().theme === 'system') {
      applyTheme('system')
    }
  }
  mediaQuery.addEventListener('change', handler)
}
