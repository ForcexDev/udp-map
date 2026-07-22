import { create } from 'zustand'

export type SidebarTab = 'places' | 'notifications' | 'settings'

interface SidebarState {
  isOpen: boolean
  activeTab: SidebarTab
  open: () => void
  openNotifications: () => void
  close: () => void
  toggle: () => void
  setActiveTab: (tab: SidebarTab) => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: false,
  activeTab: 'places',
  open: () => set({ isOpen: true }),
  openNotifications: () => set({ isOpen: true, activeTab: 'notifications' }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setActiveTab: (activeTab) => set({ activeTab }),
}))
