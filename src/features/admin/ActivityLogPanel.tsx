import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, MapPin, ShieldAlert } from 'lucide-react'
import type { ActivityEntry } from './types'
import { fetchRecentActivity } from './api'
import { AdminEmpty, AdminLoading, AdminScreen } from './AdminScreen'

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
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ['admin', 'activity'],
    queryFn: fetchRecentActivity,
  })

  // Agrupar por día es lo que hace esta pantalla legible. Antes cada fila
  // enseñaba solo la HORA, así que un pin de hace tres días y uno de esta
  // mañana se veían exactamente igual y la lista no decía nada.
  const groups = useMemo(() => {
    const byDay = new Map<string, { date: Date; items: ActivityEntry[] }>()
    for (const item of activity) {
      const date = new Date(item.timestamp)
      const key = dayKey(date)
      const group = byDay.get(key)
      if (group) group.items.push(item)
      else byDay.set(key, { date, items: [item] })
    }
    return [...byDay.values()].sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [activity])

  return (
    <AdminScreen
      title="Actividad"
      description="Lo último que ha pasado en la aplicación."
      width="narrow"
    >
      {isLoading ? (
        <AdminLoading />
      ) : groups.length === 0 ? (
        <AdminEmpty
          icon={<History size={40} strokeWidth={1.5} className="text-neutral-300 dark:text-neutral-700" />}
          title="Todavía nada"
          hint="Aquí aparecerán los pines publicados y las denuncias recibidas."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={dayKey(group.date)}>
              <h2 className="sticky top-0 z-10 -mx-4 mb-2.5 bg-neutral-50/90 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-neutral-400 backdrop-blur-sm dark:bg-neutral-950/90">
                {dayLabel(group.date)}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {group.items.map((item) => {
                  const isReport = item.type === 'report_submitted'
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white p-3.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      {/* Un icono y no un punto de color: el punto obligaba a
                          recordar qué significaba cada uno. */}
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                          isReport
                            ? 'bg-red-50 text-[#D41F2D] dark:bg-red-950/30'
                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30'
                        }`}
                      >
                        {isReport ? <ShieldAlert size={16} /> : <MapPin size={16} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-neutral-400">
                          {isReport ? 'Denuncia' : 'Pin publicado'}
                        </span>
                        <span className="block truncate text-sm font-bold text-neutral-900 dark:text-white">
                          {item.title}
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
          ))}
        </div>
      )}
    </AdminScreen>
  )
}
