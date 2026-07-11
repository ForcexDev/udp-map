import { create } from 'zustand'

export type Theme = 'light' | 'dark'

interface DraftLocation {
  lat: number
  lng: number
}

interface UIState {
  theme: Theme
  toggleTheme: () => void

  campusId: string
  setCampusId: (id: string) => void

  loginModalOpen: boolean
  openLoginModal: () => void
  closeLoginModal: () => void

  tutorialOpen: boolean
  openTutorial: () => void
  closeTutorial: () => void

  createModalOpen: boolean
  pinToEdit: string | null
  openCreateModal: (pinId?: string) => void
  closeCreateModal: () => void

  /** Modo "toca el mapa para fijar ubicación" antes de abrir el formulario */
  pickingLocation: boolean
  startPickingLocation: () => void
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

  /** Plano indoor activo */
  indoorFacultyId: string | null
  indoorFloor: number
  setIndoor: (facultyId: string | null, floor?: number) => void

  toast: string | null
  showToast: (msg: string) => void
  clearToast: () => void
}

function initialTheme(): Theme {
  const stored = localStorage.getItem('udpmap.theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem('udpmap.theme', theme)
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useUIStore = create<UIState>((set, get) => {
  const theme = initialTheme()
  applyTheme(theme)
  return {
    theme,
    toggleTheme: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
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

    createModalOpen: false,
    pinToEdit: null,
    openCreateModal: (pinId) => set({ createModalOpen: true, pinToEdit: pinId ?? null }),
    closeCreateModal: () => set({ createModalOpen: false, pinToEdit: null }),

    pickingLocation: false,
    startPickingLocation: () =>
      set({ pickingLocation: true, selectedPinId: null, createModalOpen: false }),
    cancelPickingLocation: () => set({ pickingLocation: false }),
    draftLocation: null,
    setDraftLocation: (loc) =>
      set({ draftLocation: loc, pickingLocation: false, createModalOpen: true }),

    movingPinId: null,
    startMovingPin: (id) => set({ movingPinId: id, selectedPinId: null }),
    cancelMovingPin: () => set({ movingPinId: null }),

    selectedPinId: null,
    selectPin: (id) => set({ selectedPinId: id, selectedFacultyId: null, movingPinId: null }),

    selectedFacultyId: null,
    selectFaculty: (id) => set({ selectedFacultyId: id, selectedPinId: null, movingPinId: null }),

    routeTargetPinId: null,
    setRouteTarget: (id) => set({ routeTargetPinId: id }),
    accessibleRoute: false,
    setAccessibleRoute: (v) => set({ accessibleRoute: v }),

    indoorFacultyId: null,
    indoorFloor: 1,
    setIndoor: (facultyId, floor = 1) => set({ indoorFacultyId: facultyId, indoorFloor: floor }),

    toast: null,
    showToast: (msg) => {
      clearTimeout(toastTimer)
      set({ toast: msg })
      toastTimer = setTimeout(() => set({ toast: null }), 3500)
    },
    clearToast: () => set({ toast: null }),
  }
})
