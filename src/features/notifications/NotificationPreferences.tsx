import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Smartphone } from 'lucide-react'
import type { NotificationPreference } from '@/shared/types/database'
import { useAuthStore } from '@/features/auth/authStore'
import { Switch } from '@/shared/ui/Switch'
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
      const previous = queryClient.getQueryData<NotificationPreference[]>([
        'notification-preferences',
        userId,
      ])
      queryClient.setQueryData<NotificationPreference[]>(
        ['notification-preferences', userId],
        (list = []) => [
          ...list.filter((p) => p.category !== preference.category),
          preference.in_app ? preference : { ...preference, push: false },
        ],
      )
      return previous
    },
    onError: (_e, _v, previous) =>
      queryClient.setQueryData(['notification-preferences', userId], previous),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences', userId] }),
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
    <div className="overflow-hidden rounded-2xl border border-[#E6E0D5] bg-white dark:border-white/[0.07] dark:bg-[#1E222D]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-3 p-3.5 text-left transition-colors hover:bg-[#FAF8F5] dark:hover:bg-white/[0.04]"
      >
        <span className="min-w-0 flex-1 text-xs font-bold text-stone-500 dark:text-stone-400">
          {t('notifications.preferences', 'Qué avisos quiero')}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-[#E6E0D5] dark:border-white/[0.07]">
          <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1">
            <span className="min-w-0 flex-1" />
            <span className="w-11 shrink-0 text-center text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase">
              {t('notifications.channelApp', 'App')}
            </span>
            <span className="grid w-11 shrink-0 place-items-center text-stone-400 dark:text-stone-500">
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
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${look.bg} ${look.fg}`}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800 dark:text-stone-200">
                    {LABELS[category] ?? category}
                  </span>

                  <Switch
                    checked={preference.in_app}
                    label={t('notifications.channelAppFor', {
                      category: LABELS[category],
                      defaultValue: `${LABELS[category]} en la app`,
                    })}
                    onChange={(on) => save.mutate({ ...preference, in_app: on })}
                  />
                  <Switch
                    checked={preference.push}
                    // Sin el aviso en la app no hay nada que mandar al teléfono.
                    // Se deshabilita en vez de dejar pulsar algo que la base va
                    // a rechazar.
                    disabled={!preference.in_app}
                    label={t('notifications.channelPushFor', {
                      category: LABELS[category],
                      defaultValue: `${LABELS[category]} al teléfono`,
                    })}
                    onChange={(on) => save.mutate({ ...preference, push: on })}
                  />
                </li>
              )
            })}
          </ul>

          <p className="px-3.5 pb-3 pt-1 text-[11px] font-normal leading-snug text-stone-400 dark:text-stone-500">
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
