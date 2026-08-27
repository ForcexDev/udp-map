import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Award,
  BellRing,
  CalendarDays,
  ChevronRight,
  Flame,
  MapPin,
  PenTool,
  ShieldAlert,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { fetchDashboardStats } from './api'
import { AdminError, AdminLoading, AdminScreen } from './AdminScreen'

export function DashboardPanel() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchDashboardStats,
  })

  return (
    <AdminScreen
      title="Resumen"
      description="Cómo va la comunidad y qué necesita atención ahora mismo."
    >
      {isLoading ? (
        <AdminLoading />
      ) : error || !stats ? (
        <AdminError message="No se pudieron cargar las métricas." />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Lo que necesita una decisión va primero y es un ENLACE, no un
              número. Antes «Reportes pendientes» era una cifra muerta: te decía
              que había trabajo y no te llevaba a hacerlo — la cola vivía en otra
              ruta que el panel ni mencionaba. */}
          {stats.pendingReports > 0 && (
            <Link
              to="/admin/moderacion"
              className="group flex items-center gap-4 rounded-3xl border border-[#D41F2D]/40 bg-white p-4 shadow-sm ring-1 ring-[#D41F2D]/20 transition-all hover:shadow-md active:scale-[0.99] dark:bg-neutral-900"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-50 text-[#D41F2D] dark:bg-red-950/30">
                <ShieldAlert size={24} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold leading-snug text-neutral-900 dark:text-white">
                  {stats.pendingReports}{' '}
                  {stats.pendingReports === 1 ? 'denuncia pendiente' : 'denuncias pendientes'}
                </span>
                <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Nadie las ha tomado todavía.
                </span>
              </span>
              <ChevronRight
                size={18}
                className="shrink-0 text-neutral-300 transition-colors group-hover:text-[#D41F2D] dark:text-neutral-600"
              />
            </Link>
          )}

          <section>
            <h2 className="mb-2.5 text-[11px] font-black uppercase tracking-widest text-neutral-400">
              La comunidad
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Usuarios registrados"
                value={stats.totalUsers}
                icon={Users}
                tone="text-blue-500"
                bg="bg-blue-50 dark:bg-blue-950/30"
                to="/admin/usuarios"
              />
              <StatCard
                label="Karma repartido"
                value={stats.totalKarma}
                icon={Flame}
                tone="text-amber-500"
                bg="bg-amber-50 dark:bg-amber-950/30"
              />
              <StatCard
                label="Dispositivos suscritos"
                value={stats.pushSubscribers}
                sub="Reciben las notificaciones push"
                icon={BellRing}
                tone="text-purple-500"
                bg="bg-purple-50 dark:bg-purple-950/30"
                to="/admin/difusion"
              />
            </div>
          </section>

          <section>
            <h2 className="mb-2.5 text-[11px] font-black uppercase tracking-widest text-neutral-400">
              El mapa
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Pines vivos"
                value={stats.activePins}
                sub={`${stats.totalPins} creados desde el principio`}
                icon={MapPin}
                tone="text-emerald-500"
                bg="bg-emerald-50 dark:bg-emerald-950/30"
                to="/admin/contenido"
              />
              {/* `pinsToday` se calculaba en `api.ts` y no se pintaba en ningún
                  sitio. Es la única cifra que dice si la app se está usando HOY. */}
              <StatCard
                label="Publicados hoy"
                value={stats.pinsToday}
                icon={Sparkles}
                tone="text-[#D41F2D]"
                bg="bg-red-50 dark:bg-red-950/30"
              />
              <StatCard
                label="Eventos por venir"
                value={stats.upcomingEvents}
                icon={CalendarDays}
                tone="text-indigo-500"
                bg="bg-indigo-50 dark:bg-indigo-950/30"
              />
            </div>
          </section>

          <section>
            <h2 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-neutral-400">
              <Award size={13} />
              Roles
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <RoleBox label="Estudiantes" value={stats.roleCounts.student} tone="text-blue-600 dark:text-blue-400" />
              <RoleBox label="Moderadores" value={stats.roleCounts.moderator} tone="text-amber-600 dark:text-amber-500" />
              <RoleBox label="Administradores" value={stats.roleCounts.admin} tone="text-[#D41F2D] dark:text-red-400" />
              <RoleBox label="Invitados" value={stats.roleCounts.guest} tone="text-neutral-500" />
            </div>
          </section>

          <section>
            <h2 className="mb-2.5 text-[11px] font-black uppercase tracking-widest text-neutral-400">
              Herramientas
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ToolLink
                to="/admin/mapeo"
                icon={PenTool}
                label="Editor de mapeo"
                hint="Edificios, plantas y áreas. Necesita un computador."
              />
              <ToolLink
                to="/admin/facultades"
                icon={Award}
                label="Facultades"
                hint="Nombre, campus e imagen de cada facultad."
              />
            </div>
          </section>
        </div>
      )}
    </AdminScreen>
  )
}

interface StatCardProps {
  label: string
  value: number
  sub?: string
  icon: LucideIcon
  tone: string
  bg: string
  /** Si la cifra tiene una pantalla detrás, la tarjeta lleva a ella. */
  to?: string
}

function StatCard({ label, value, sub, icon: Icon, tone, bg, to }: StatCardProps) {
  const body = (
    <>
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${bg} ${tone}`}>
        <Icon size={24} strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-black uppercase tracking-wider text-neutral-400">
          {label}
        </span>
        <span className="block text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
          {value}
        </span>
        {sub && <span className="mt-0.5 block text-[10px] font-medium text-neutral-400">{sub}</span>}
      </span>
    </>
  )

  const shell =
    'flex items-center gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900'

  if (!to) return <div className={shell}>{body}</div>

  return (
    <Link to={to} className={`${shell} transition-all hover:shadow-md active:scale-[0.99]`}>
      {body}
    </Link>
  )
}

function RoleBox({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <span className="block text-[10px] font-black uppercase tracking-wider text-neutral-400">
        {label}
      </span>
      <p className={`mt-0.5 text-xl font-black tracking-tight ${tone}`}>{value}</p>
    </div>
  )
}

function ToolLink({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: string
  icon: LucideIcon
  label: string
  hint: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-900"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-neutral-900 dark:text-white">{label}</span>
        <span className="block text-[11px] font-medium leading-snug text-neutral-400">{hint}</span>
      </span>
      <ChevronRight
        size={16}
        className="shrink-0 text-neutral-300 transition-colors group-hover:text-[#D41F2D] dark:text-neutral-600"
      />
    </Link>
  )
}
