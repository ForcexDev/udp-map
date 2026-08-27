import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  History,
  MapPin,
  Megaphone,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Trash2,
  TriangleAlert,
  UserCog,
  type LucideIcon,
} from 'lucide-react'
import type { ActivityAction, ActivityEntry } from './types'
import { fetchRecentActivity } from './api'
import { AdminEmpty, AdminError, AdminLoading, AdminScreen } from './AdminScreen'

// ─────────────────────────────────────────────────────────────────────────────
// El registro de actividad.
//
// Antes esta pantalla NO leía un registro: pedía los últimos 15 pines y las
// últimas 15 denuncias y los mezclaba aquí. O sea que solo enseñaba lo que
// TODAVÍA EXISTE —borrar un pin borraba también el rastro de que se creó, que
// es justo lo que habría que poder auditar—, solo sabía de esas dos tablas, y
// ninguna línea decía quién había hecho nada.
//
// Ahora lee `activity_log` (migración 20260828000000). Mientras esa migración
// no esté aplicada la pantalla sigue funcionando con el apaño de antes, pero lo
// DICE: fingir que es un registro cuando no lo es sería peor que no tenerlo.
// ─────────────────────────────────────────────────────────────────────────────

interface ActionLook {
  label: string
  icon: LucideIcon
  fg: string
  bg: string
}

const LOOKS: Record<ActivityAction, ActionLook> = {
  pin_created: { label: 'Pin publicado', icon: MapPin, fg: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  pin_deleted: { label: 'Pin eliminado', icon: Trash2, fg: 'text-neutral-500 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800' },
  pin_verified: { label: 'Pin verificado', icon: ShieldCheck, fg: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  pin_unverified: { label: 'Verificación retirada', icon: ShieldX, fg: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  report_filed: { label: 'Denuncia', icon: ShieldAlert, fg: 'text-[#D41F2D] dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
  report_claimed: { label: 'Caso tomado', icon: ShieldAlert, fg: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  report_resolved: { label: 'Denuncia resuelta', icon: ShieldCheck, fg: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  report_dismissed: { label: 'Denuncia descartada', icon: ShieldX, fg: 'text-neutral-500 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800' },
  role_changed: { label: 'Cambio de rol', icon: UserCog, fg: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  broadcast_sent: { label: 'Difusión enviada', icon: Megaphone, fg: 'text-[#D41F2D] dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
}

const FALLBACK: ActionLook = {
  label: 'Actividad',
  icon: History,
  fg: 'text-neutral-500 dark:text-neutral-400',
  bg: 'bg-neutral-100 dark:bg-neutral-800',
}

/** El `??` no sobra: el CHECK de la base puede crecer antes que este cliente. */
const lookFor = (action: string) => LOOKS[action as ActivityAction] ?? FALLBACK

/** «Hoy» / «Ayer» / «mié, 3 sep». Mismo criterio que la agenda de Eventos. */
function dayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (sameDay(date, today)) return 'Hoy'
  if (sameDay(date, yesterday)) return 'Ayer'
  return date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export function ActivityLogPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'activity'],
    queryFn: fetchRecentActivity,
  })

  // Agrupar por día es lo que hace esta pantalla legible. Antes cada fila
  // enseñaba solo la HORA, así que un pin de hace tres días y uno de esta
  // mañana se veían exactamente igual y la lista no decía nada.
  const groups = useMemo(() => {
    const byDay = new Map<string, { date: Date; items: ActivityEntry[] }>()
    for (const item of data?.entries ?? []) {
      const date = new Date(item.timestamp)
      const key = dayKey(date)
      const group = byDay.get(key)
      if (group) group.items.push(item)
      else byDay.set(key, { date, items: [item] })
    }
    return [...byDay.values()].sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [data])

  return (
    <AdminScreen
      title="Actividad"
      description="Quién ha hecho qué, en orden. Incluye lo que ya se borró."
      width="narrow"
    >
      {isLoading ? (
        <AdminLoading />
      ) : error ? (
        <AdminError message="No se pudo cargar el registro de actividad." />
      ) : (
        <div className="flex flex-col gap-6">
          {data && !data.fromLog && (
            /* Sin esto la pantalla mentiría por omisión: enseñaría una lista
               plausible sin decir que le faltan los borrados y los autores. */
            <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
              <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-neutral-900 dark:text-white">
                  El registro todavía no está activo
                </p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Esto es una reconstrucción a partir de lo que sigue vivo: no
                  incluye lo que se borró ni dice quién hizo cada cosa. Para
                  tener el registro de verdad, aplica la migración
                  <code className="mx-1 font-mono text-[11px]">20260828000000</code>
                  en Supabase.
                </p>
              </div>
            </div>
          )}

          {groups.length === 0 ? (
            <AdminEmpty
              icon={<History size={40} strokeWidth={1.5} className="text-neutral-300 dark:text-neutral-700" />}
              title="Todavía nada"
              hint="Aquí aparecerá cada publicación, verificación, denuncia y cambio de rol."
            />
          ) : (
            groups.map((group) => (
              <section key={dayKey(group.date)}>
                <h2 className="sticky top-0 z-10 -mx-4 mb-2.5 bg-neutral-50/90 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-neutral-400 backdrop-blur-sm dark:bg-neutral-950/90">
                  {dayLabel(group.date)}
                </h2>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {group.items.map((item) => {
                    const look = lookFor(item.action)
                    const Icon = look.icon
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white p-3.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                      >
                        {/* Un icono y no un punto de color: el punto obligaba a
                            recordar qué significaba cada uno. */}
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${look.bg} ${look.fg}`}>
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-black uppercase tracking-wider text-neutral-400">
                            {look.label}
                            {item.actorName && (
                              <span className="ml-1.5 normal-case tracking-normal text-neutral-500 dark:text-neutral-400">
                                · {item.actorName}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-sm font-bold text-neutral-900 dark:text-white">
                            {item.summary}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-medium tabular-nums text-neutral-400">
                          {new Date(item.timestamp).toLocaleTimeString('es-CL', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      )}
    </AdminScreen>
  )
}
