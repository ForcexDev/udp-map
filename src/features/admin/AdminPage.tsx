import { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { LayoutDashboard, Users, MapPin, BellRing, Activity } from 'lucide-react'
import type { AdminTab } from './types'

import { DashboardPanel } from './DashboardPanel'
import { UsersPanel } from './UsersPanel'
import { ContentPanel } from './ContentPanel'
import { PushTestPanel } from './PushTestPanel'
import { ActivityLogPanel } from './ActivityLogPanel'

const TABS: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard; Panel: () => React.JSX.Element }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, Panel: DashboardPanel },
  { id: 'users', label: 'Usuarios', icon: Users, Panel: UsersPanel },
  { id: 'content', label: 'Pines y Contenido', icon: MapPin, Panel: ContentPanel },
  { id: 'push', label: 'Push Test', icon: BellRing, Panel: PushTestPanel },
  { id: 'activity', label: 'Actividad', icon: Activity, Panel: ActivityLogPanel },
]

// El guard de sesión/rol vive en AdminLayout: esta página solo se monta como su
// <Outlet/>, así que aquí ya está garantizado role === 'admin'.
export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')

  return (
    <div className="h-full overflow-y-auto bg-neutral-50/70 dark:bg-neutral-950 px-3.5 sm:px-6 pb-24 pt-4 sm:pt-6">
      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as AdminTab)}
        className="mx-auto max-w-6xl"
      >
        <Tabs.List className="mb-6 p-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex gap-1.5 overflow-x-auto snap-x shadow-sm [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ id, label, icon: Icon }) => (
            <Tabs.Trigger
              key={id}
              value={id}
              className="shrink-0 snap-start py-2.5 px-4 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap outline-none text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white data-[state=active]:bg-[#D41F2D] data-[state=active]:text-white data-[state=active]:shadow-sm focus-visible:ring-2 focus-visible:ring-[#D41F2D]"
            >
              <Icon size={16} />
              <span>{label}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {TABS.map(({ id, Panel }) => (
          <Tabs.Content key={id} value={id} className="outline-none">
            <Panel />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  )
}
