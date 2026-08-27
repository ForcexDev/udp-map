import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Smartphone } from 'lucide-react'
import type { NotificationCategory, NotificationPreference } from '@/shared/types/database'
import { useAuthStore } from '@/features/auth/authStore'
import { notificationLook } from './notificationMeta'
import {
  TUNABLE_CATEGORIES,
  fetchNotificationPreferences,
  preferenceFor,
  setNotificationPreference,
} from './preferencesApi'

// ─────────────────────────────────────────────────────────────────────────────
// "Qué avisos quiero".
//
// Va PLEGADO por defecto. Quien abre la pestaña de avisos viene a leer avisos,
// no a configurarlos; desplegar cinco categorías por dos interruptores cada una
// encima de la lista convierte la pantalla en un panel de ajustes.
//
// Dos columnas y no una: la categoría dice de qué es el aviso y el canal por
// dónde llega. Se puede querer verlo en la app sin que suene el teléfono a las
// once de la noche, y con un solo interruptor eso no se puede decir.
// ─────────────────────────────────────────────────────────────────────────────

export function NotificationPreferences() {
  const { t } = useTranslation()
  const userId = useAuthStore((s) => s.user?.id)
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: preferences = [] } = useQuery({
    queryKey: ['notification-preferences', userId],
    queryFn: () => (userId ? fetchNotificationPreferences(userId) : Promise.resolve([])),
    enabled: Boolean(userId) && open,
  })

  const save = useMutation({
    mutationFn: (preference: NotificationPreference) =>
      userId ? setNotificationPreference(userId, preference) : Promise.resolve(),
    // Optimista: son interruptores, y esperar a la red para que se muevan hace
    // que parezca que no responden.
    onMutate: async (preference) => {
      await queryClient.cancelQueries({ queryKey: ['notification-preferences', userId] })
      const previous = queryClient.getQueryData<NotificationPreference[]>(['notification-preferences', userId])
      queryClient.setQueryData<NotificationPreference[]>(['notification-preferences', userId], (list = []) => [
        ...list.filter((p) => p.category !== preference.category),
        preference.in_app ? preference : { ...preference, push: false },
      ])
      return previous
    },
    onError: (_e, _v, previous) =>
      queryClient.setQueryData(['notification-preferences', userId], previous),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notification-preferences', userId] }),
  })

  const LABELS: Record<string, string> = {
    pins: t('notifications.filterPins', 'Mis pines'),
    forum: t('notifications.filterForum', 'Foro'),
    events: t('notifications.filterEvents', 'Eventos'),
    profile: t('notifications.filterProfile', 'Perfil'),
    system: t('notifications.filterSystem', 'Avisos'),
  }

  if (!userId) return null

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-3 p-3.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
      >
        <span className="min-w-0 flex-1 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">
          {t('notifications.preferences', 'Qué avisos quiero')}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1">
            <span className="min-w-0 flex-1" />
            <span className="w-11 shrink-0 text-center text-[9px] font-black uppercase tracking-wider text-neutral-400">
              {t('notifications.channelApp', 'App')}
            </span>
            <span className="grid w-11 shrink-0 place-items-center text-neutral-400">
              <Smartphone size={12} />
            </span>
          </div>

          <ul className="m-0 list-none p-0">
            {TUNABLE_CATEGORIES.map((category) => {
              const preference = preferenceFor(preferences, category)
              const look = notificationLook(category)
              const Icon = look.icon
              return (
                <li key={category} className="flex items-center gap-2 px-3.5 py-2">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${look.bg} ${look.fg}`}>
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    {LABELS[category] ?? category}
                  </span>

                  <Toggle
                    on={preference.in_app}
                    label={t('notifications.channelAppFor', { category: LABELS[category], defaultValue: `${LABELS[category]} en la app` })}
                    onChange={(on) => save.mutate({ ...preference, in_app: on })}
                  />
                  <Toggle
                    on={preference.push}
                    // Sin el aviso en la app no hay nada que mandar al teléfono.
                    // Se deshabilita en vez de dejar pulsar algo que la base va
                    // a rechazar.
                    disabled={!preference.in_app}
                    label={t('notifications.channelPushFor', { category: LABELS[category], defaultValue: `${LABELS[category]} al teléfono` })}
                    onChange={(on) => save.mutate({ ...preference, push: on })}
                  />
                </li>
              )
            })}
          </ul>

          <p className="px-3.5 pb-3 pt-1 text-[11px] font-medium leading-snug text-neutral-400">
            {t(
              'notifications.preferencesHint',
              'Los avisos de moderación no se pueden apagar: son trabajo del equipo.',
            )}
          </p>
        </div>
      )}
    </div>
  )
}

function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean
  onChange: (on: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        on ? 'bg-[#D41F2D]' : 'bg-neutral-300 dark:bg-neutral-600'
      } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export type { NotificationCategory }
