import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import type { ModeratorCapability } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { CAPABILITIES, fetchUserCapabilities, setUserCapability } from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Repartir la moderación en piezas.
//
// Solo aparece para moderadores, y no por estética: conceder capacidades a un
// estudiante crearía un moderador encubierto —con permisos reales y sin el rol
// que se lo explique a quien mire la lista—. La base lo rechaza; la interfaz ni
// lo ofrece.
//
// Un administrador no sale aquí porque lo puede todo por definición: enseñarle
// interruptores que no cambian nada sería mentir.
// ─────────────────────────────────────────────────────────────────────────────

export function CapabilitiesEditor({ userId, name }: { userId: string; name: string | null }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)

  const { data: granted, isLoading } = useQuery({
    queryKey: ['admin', 'capabilities', userId],
    queryFn: () => fetchUserCapabilities(userId),
  })

  const toggle = useMutation({
    mutationFn: ({ capability, on }: { capability: ModeratorCapability; on: boolean }) =>
      setUserCapability(userId, capability, on),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'capabilities', userId] }),
    onError: (err) => showToast(err instanceof Error ? err.message : 'No se pudo cambiar el permiso.'),
  })

  if (isLoading) return null

  if (granted === null) {
    return (
      <p className="mt-2 text-[11px] font-medium text-neutral-400">
        {t('admin.capabilitiesMigration', { migration: '20260831000200' })}
      </p>
    )
  }

  return (
    <div className="mt-2.5 border-t border-neutral-100 pt-2.5 dark:border-neutral-800">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400">
        <ShieldCheck size={12} />
        {t('admin.capabilitiesOf', { name: name ?? '' })}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {CAPABILITIES.map((capability) => {
          const on = (granted ?? []).includes(capability.id)
          return (
            <button
              key={capability.id}
              type="button"
              title={capability.hint}
              aria-pressed={on}
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ capability: capability.id, on: !on })}
              className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors active:scale-95 disabled:opacity-50 ${
                on
                  ? 'bg-[#D41F2D] text-white'
                  : 'border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800'
              }`}
            >
              {capability.label}
            </button>
          )
        })}
      </div>
      {(granted ?? []).length === 0 && (
        /* Un moderador sin piezas no puede nada, y eso no se deduce de ver
           cinco botones apagados: hay que decirlo. */
        <p className="mt-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          {t('admin.noCapabilities')}
        </p>
      )}
    </div>
  )
}
