import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LayoutDashboard, Users, MapPin, BellRing, Activity } from 'lucide-react'
import { useAuthStore } from '@/features/auth/authStore'
import type { AdminTab } from './types'

import { DashboardPanel } from './DashboardPanel'
import { UsersPanel } from './UsersPanel'
import { ContentPanel } from './ContentPanel'
import { PushTestPanel } from './PushTestPanel'
import { ActivityLogPanel } from './ActivityLogPanel'

const TABS: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'content', label: 'Pines y Contenido', icon: MapPin },
  { id: 'push', label: 'Push Test', icon: BellRing },
  { id: 'activity', label: 'Actividad', icon: Activity },
]

export function AdminPage() {
  const role = useAuthStore((s) => s.role)
  const loading = useAuthStore((s) => s.loading)
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#D41F2D] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-neutral-400">Verificando permisos de administración…</span>
        </div>
      </div>
    )
  }

  if (role !== 'admin') {
    return <Navigate to="/mapa" replace />
  }

  return (
    <div className="h-full overflow-y-auto bg-neutral-50/70 dark:bg-neutral-950 px-3.5 sm:px-6 pb-24 pt-4 sm:pt-6">
      <div className="mx-auto max-w-6xl">
        {/* Navigation Tabs Bar */}
        <div className="mb-6 p-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex gap-1.5 overflow-x-auto snap-x shadow-sm [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`shrink-0 snap-start py-2.5 px-4 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#D41F2D] text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Renderers */}
        {activeTab === 'dashboard' && <DashboardPanel />}
        {activeTab === 'users' && <UsersPanel />}
        {activeTab === 'content' && <ContentPanel />}
        {activeTab === 'push' && <PushTestPanel />}
        {activeTab === 'activity' && <ActivityLogPanel />}
      </div>
    </div>
  )
}
