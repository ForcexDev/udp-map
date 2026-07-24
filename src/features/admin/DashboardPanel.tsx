import { useQuery } from '@tanstack/react-query'
import { Users, MapPin, CalendarDays, ShieldAlert, Award, Flame, BellRing } from 'lucide-react'
import { fetchDashboardStats } from './api'

export function DashboardPanel() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchDashboardStats,
  })

  if (isLoading || !stats) {
    return <div className="py-20 text-center text-sm font-semibold text-neutral-400">Cargando métricas de la plataforma…</div>
  }

  const cards = [
    { label: 'Usuarios Registrados', value: stats.totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Suscriptores Push', value: stats.pushSubscribers, sub: 'Dispositivos activos', icon: BellRing, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
    { label: 'Pines Activos en Mapa', value: stats.activePins, sub: `${stats.totalPins} creados en total`, icon: MapPin, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Eventos Próximos', value: stats.upcomingEvents, icon: CalendarDays, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
    { label: 'Reportes Pendientes', value: stats.pendingReports, icon: ShieldAlert, color: 'text-[#D41F2D]', bg: 'bg-red-50 dark:bg-red-950/30' },
    { label: 'Karma Comunitario Total', value: stats.totalKarma, icon: Flame, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  ]

  return (
    <div className="space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${c.bg} ${c.color} flex items-center justify-center shrink-0`}>
                <Icon size={24} strokeWidth={2.2} />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 block">{c.label}</span>
                <span className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">{c.value}</span>
                {c.sub && <p className="text-[10px] font-semibold text-neutral-400 mt-0.5">{c.sub}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Role Breakdown Widget */}
      <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wider text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
          <Award size={18} className="text-[#D41F2D]" />
          Distribución de Roles de Usuarios
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">Estudiantes</span>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{stats.roleCounts.student}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">Moderadores</span>
            <p className="text-xl font-black text-blue-600 dark:text-blue-400">{stats.roleCounts.moderator}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">Administradores</span>
            <p className="text-xl font-black text-[#D41F2D]">{stats.roleCounts.admin}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">Invitados (Guest)</span>
            <p className="text-xl font-black text-neutral-500">{stats.roleCounts.guest}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
