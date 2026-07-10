import { create } from 'zustand'
import type { PinType } from '@/shared/types/database'

export interface PinFilters {
  types: PinType[]
  categoryId: string | null
  facultyId: string | null
  onlyFavorites: boolean
}

interface FilterState extends PinFilters {
  toggleType: (t: PinType) => void
  setCategoryId: (id: string | null) => void
  setFacultyId: (id: string | null) => void
  setOnlyFavorites: (v: boolean) => void
  clear: () => void
}

const ALL_TYPES: PinType[] = ['place', 'event', 'report']

export const useFilterStore = create<FilterState>((set) => ({
  types: [...ALL_TYPES],
  categoryId: null,
  facultyId: null,
  onlyFavorites: false,

  toggleType: (t) =>
    set((s) => ({
      types: s.types.includes(t) ? s.types.filter((x) => x !== t) : [...s.types, t],
    })),
  setCategoryId: (id) => set({ categoryId: id }),
  setFacultyId: (id) => set({ facultyId: id }),
  setOnlyFavorites: (v) => set({ onlyFavorites: v }),
  clear: () =>
    set({ types: [...ALL_TYPES], categoryId: null, facultyId: null, onlyFavorites: false }),
}))
