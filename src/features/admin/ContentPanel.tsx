import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, ShieldCheck } from 'lucide-react'
import type { PinType } from '@/shared/types/database'
import { fetchAdminPins, adminDeletePin } from './api'
import { useUIStore } from '@/shared/stores/uiStore'

export function ContentPanel() {
  const queryClient = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)
  const [typeFilter, setTypeFilter] = useState<PinType | 'all'>('all')

  const { data: pins = [], isLoading } = useQuery({
    queryKey: ['admin', 'pins', typeFilter],
    queryFn: () => fetchAdminPins({ type: typeFilter }),
  })

  const deleteMutation = useMutation({
    mutationFn: adminDeletePin,
    onSuccess: () => {
      showToast('Pin eliminado correctamente.')
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err) => showToast(err instanceof Error ? err.message : 'No se pudo eliminar el pin.'),
  })

  return (
    <div className="space-y-4">
      {/* Type Tabs */}
      <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex gap-2">
        {(['all', 'report', 'event', 'place'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer ${
              typeFilter === t
                ? 'bg-[#D41F2D] text-white'
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            {t === 'all' ? 'Todos los tipos' : t}
          </button>
        ))}
      </div>

      {/* Pins List */}
      {isLoading ? (
        <div className="py-12 text-center text-xs font-bold text-neutral-400">Cargando contenido de la plataforma…</div>
      ) : pins.length === 0 ? (
        <div className="py-12 text-center text-xs font-bold text-neutral-400 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
          No hay pines registrados para este filtro.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pins.map((p) => (
            <article key={p.id} className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    p.type === 'event' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40' :
                    p.type === 'place' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40' :
                    'bg-red-100 text-red-600 dark:bg-red-950/40'
                  }`}>
                    {p.type}
                  </span>
                  {p.is_permanent && (
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck size={12} /> Permanente
                    </span>
                  )}
                </div>
                <h4 className="font-extrabold text-sm text-neutral-900 dark:text-white">{p.title}</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">{p.description || 'Sin descripción.'}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-[10px] font-mono text-neutral-400">{new Date(p.created_at).toLocaleDateString()}</span>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(p.id)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                  title="Eliminar pin"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
