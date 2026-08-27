import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPinOff, ShieldCheck, Trash2 } from 'lucide-react'
import type { Pin, PinType } from '@/shared/types/database'
import { fetchAdminPins, adminDeletePin } from './api'
import { useUIStore } from '@/shared/stores/uiStore'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { FilterPills } from '@/shared/ui/FilterPills'
import { categoryById } from '@/shared/data/campusData'
import { useFaculties } from '@/shared/data/facultyStore'
import { AdminEmpty, AdminLoading, AdminScreen } from './AdminScreen'

const TYPE_OPTIONS: readonly { value: PinType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'report', label: 'Reportes' },
  { value: 'event', label: 'Eventos' },
  { value: 'place', label: 'Lugares' },
]

const TYPE_LABEL: Record<PinType, string> = {
  report: 'Reporte',
  event: 'Evento',
  place: 'Lugar',
}

const TYPE_TONE: Record<PinType, string> = {
  report: 'bg-red-50 text-[#D41F2D] dark:bg-red-950/40 dark:text-red-400',
  event: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
  place: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-500',
}

export function ContentPanel() {
  const queryClient = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)
  const faculties = useFaculties()
  const [typeFilter, setTypeFilter] = useState<PinType | 'all'>('all')
  // Borrar un pin es irreversible y hasta ahora bastaba un toque, mientras que
  // cambiar un rol —bastante menos grave— sí preguntaba. Ahora pregunta.
  const [pendingDelete, setPendingDelete] = useState<Pin | null>(null)

  const { data: pins = [], isLoading } = useQuery({
    queryKey: ['admin', 'pins', typeFilter],
    queryFn: () => fetchAdminPins({ type: typeFilter }),
  })

  const deleteMutation = useMutation({
    mutationFn: adminDeletePin,
    onSuccess: () => {
      showToast('Pin eliminado.')
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
      setPendingDelete(null)
    },
    onError: (err) => showToast(err instanceof Error ? err.message : 'No se pudo eliminar el pin.'),
  })

  const facultyName = (id: string | null) =>
    id ? (faculties.find((f) => f.id === id)?.name ?? id) : null

  return (
    <AdminScreen
      title="Contenido"
      description="Todo lo publicado en el mapa, para revisarlo o retirarlo."
    >
      <div className="mb-5">
        <FilterPills
          label="Filtrar pines por tipo"
          options={TYPE_OPTIONS}
          value={typeFilter}
          onChange={setTypeFilter}
        />
      </div>

      {isLoading ? (
        <AdminLoading />
      ) : pins.length === 0 ? (
        <AdminEmpty
          icon={<MapPinOff size={40} strokeWidth={1.5} className="text-neutral-300 dark:text-neutral-700" />}
          title="No hay nada aquí"
          hint={typeFilter === 'all' ? 'Todavía no se ha publicado nada.' : 'Prueba con otro tipo.'}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pins.map((p) => {
            const category = categoryById(p.category_id)
            const faculty = facultyName(p.faculty_id)
            return (
              <article
                key={p.id}
                className="flex flex-col justify-between rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${TYPE_TONE[p.type]}`}
                    >
                      {TYPE_LABEL[p.type]}
                    </span>
                    {p.is_permanent && (
                      <span className="flex shrink-0 items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck size={12} /> Permanente
                      </span>
                    )}
                  </div>

                  <h3 className="m-0 text-[15px] font-extrabold leading-snug text-neutral-900 dark:text-white">
                    {p.title}
                  </h3>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {p.description}
                    </p>
                  )}

                  {/* Categoría y facultad ya venían en la consulta y no se
                      pintaban: sin ellas, decidir si un pin sobra obliga a
                      buscarlo en el mapa. */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-neutral-400">
                    {category && (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: category.color }}
                        />
                        {category.name}
                      </span>
                    )}
                    {category && faculty && (
                      <span className="text-neutral-300 dark:text-neutral-700">·</span>
                    )}
                    {faculty && <span className="truncate">{faculty}</span>}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  <span className="text-[11px] font-medium text-neutral-400">
                    {new Date(p.created_at).toLocaleDateString('es-CL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(p)}
                    aria-label={`Eliminar ${p.title}`}
                    className="grid h-11 w-11 place-items-center rounded-xl text-neutral-400 transition-colors hover:bg-red-50 hover:text-[#D41F2D] active:scale-95 dark:hover:bg-red-950/30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          open={Boolean(pendingDelete)}
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title="Eliminar el pin"
          description={`«${pendingDelete.title}» desaparecerá del mapa con sus fotos y comentarios. No se puede deshacer.`}
          confirmText={deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
        />
      )}
    </AdminScreen>
  )
}
