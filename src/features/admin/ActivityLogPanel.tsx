import { useQuery } from '@tanstack/react-query'
import { Activity, Clock } from 'lucide-react'
import { fetchRecentActivity } from './api'

export function ActivityLogPanel() {
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ['admin', 'activity'],
    queryFn: fetchRecentActivity,
  })

  if (isLoading) {
    return <div className="py-12 text-center text-xs font-bold text-neutral-400">Cargando registro de actividad…</div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center gap-2">
        <Activity size={18} className="text-[#D41F2D]" />
        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white">Feed Unificado de la Comunidad</h3>
      </div>

      <div className="space-y-2.5">
        {activity.map((item) => (
          <div key={item.id} className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.type === 'pin_created' ? 'bg-emerald-500' : 'bg-[#D41F2D]'}`} />
              <p className="text-xs font-extrabold text-neutral-900 dark:text-white">{item.title}</p>
            </div>
            <span className="text-[10px] font-mono text-neutral-400 flex items-center gap-1 shrink-0">
              <Clock size={12} />
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
