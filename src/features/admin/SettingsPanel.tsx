import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, MapPinOff, Send } from 'lucide-react'
import { PushCard } from '@/features/notifications/PushCard'
import { usePushStore } from '@/features/notifications/pushStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { describeSelfPushTest, fetchPushDeliveryStats, PUSH_STATS_DAYS, sendSelfPushTest } from './api'
import type { PushServiceStat } from './api'
import { AdminScreen } from './AdminScreen'

// ─────────────────────────────────────────────────────────────────────────────
// Ajustes del panel.
//
// Existe por la decisión de administración en docs/decisiones/arquitectura.md: si es una herramienta de
// administración, vive en /admin y en ningún otro sitio. "Desbloquear mapa"
// estaba en los Ajustes del sidebar, o sea en la misma pantalla donde un
// estudiante elige idioma y tema, escondido tras un `role === 'admin'`. Ahí no
// lo encontraba quien lo necesitaba y no pintaba nada quien no.
//
// La prueba de push también acabó aquí y no en Difusión a propósito: Difusión
// es "escribir algo y mandárselo a la universidad", y esto es "comprobar mi
// teléfono". Mezclarlas fue lo que produjo el botón que mandaba una prueba a
// todo el mundo.
// ─────────────────────────────────────────────────────────────────────────────

const DELIVERY_STATS_KEY = ['admin', 'push-delivery-stats'] as const

export function SettingsPanel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const devUnlockMap = useUIStore((s) => s.devUnlockMap)
  const setDevUnlockMap = useUIStore((s) => s.setDevUnlockMap)
  const showToast = useUIStore((s) => s.showToast)
  const pushState = usePushStore((s) => s.state)
  const endpoint = usePushStore((s) => s.endpoint)
  const [testing, setTesting] = useState(false)

  const runSelfTest = async () => {
    setTesting(true)
    try {
      const result = await sendSelfPushTest()
      showToast(
        describeSelfPushTest(result)
          .map((part) => t(
            part.key,
            part.count === undefined
              ? { defaultValue: part.fallback }
              : { count: part.count, defaultValue: part.fallback },
          ))
          .join(' '),
      )
      // La prueba acaba de crear entregas: la tarjeta de abajo las cuenta.
      void queryClient.invalidateQueries({ queryKey: DELIVERY_STATS_KEY })
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('admin.push.test.failedToSend', 'No se pudo enviar la prueba.'))
    } finally {
      setTesting(false)
    }
  }

  return (
    <AdminScreen
      title={t('admin.sections.settings')}
      description={t('admin.sections.settingsHint')}
      width="narrow"
    >
      <div className="flex flex-col gap-6">
        <section>
          <h2 className="mb-2.5 text-[11px] font-black uppercase tracking-widest text-neutral-400">
            {t('admin.thisDevice')}
          </h2>
          <div className="flex flex-col gap-3">
            <PushCard />

            <div className="flex flex-col gap-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-neutral-900 dark:text-white">
                  {t('admin.testPushHere')}
                </p>
                <p className="mt-0.5 text-xs font-medium leading-snug text-neutral-500 dark:text-neutral-400">
                  {t('admin.testPushHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void runSelfTest()}
                disabled={testing || pushState !== 'subscribed'}
                className="flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}
                {testing ? t('admin.sending') : t('admin.sendTest')}
              </button>
            </div>

            {/* El endpoint es el dato con el que se depura de verdad "a mí no me
                llega": dice si este navegador está registrado y con qué
                servicio. Se enseña recortado porque es largo y no hace falta
                entero para reconocerlo. */}
            {endpoint && (
              <p className="px-1 text-[11px] font-medium leading-relaxed text-neutral-400">
                {t('admin.registeredEndpoint')}{' '}
                <code className="break-all font-mono text-[10px] text-neutral-500 dark:text-neutral-400">
                  {endpoint.length > 72 ? `${endpoint.slice(0, 72)}…` : endpoint}
                </code>
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2.5 text-[11px] font-black uppercase tracking-widest text-neutral-400">
            {t('admin.push.stats.title', {
              days: PUSH_STATS_DAYS,
              defaultValue: `Entregas de los últimos ${PUSH_STATS_DAYS} días por servicio`,
            })}
          </h2>
          <DeliveryStatsCard />
        </section>

        <section>
          <h2 className="mb-2.5 text-[11px] font-black uppercase tracking-widest text-neutral-400">
            {t('admin.theMap')}
          </h2>
          <button
            type="button"
            onClick={() => setDevUnlockMap(!devUnlockMap)}
            aria-pressed={devUnlockMap}
            className={`flex w-full cursor-pointer items-center gap-4 rounded-3xl border p-4 text-left shadow-sm transition-colors active:scale-[0.99] ${
              devUnlockMap
                ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20'
                : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/60'
            }`}
          >
            <span
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                devUnlockMap
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                  : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
              }`}
            >
              <MapPinOff size={22} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-neutral-900 dark:text-white">
                {devUnlockMap ? t('admin.mapUnlocked') : t('admin.unlockMap')}
              </span>
              <span className="mt-0.5 block text-xs font-medium leading-snug text-neutral-500 dark:text-neutral-400">
                {t('admin.unlockMapHint')}
              </span>
            </span>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                devUnlockMap ? 'bg-amber-400 dark:bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-600'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                  devUnlockMap ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        </section>
      </div>
    </AdminScreen>
  )
}

// Una columna de la fila: el número y qué cuenta. Los ceros se apagan para que
// lo que NO es cero —lo que hay que mirar— sea lo único con color.
function StatCell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    // dt antes que dd, como manda <dl>: un lector de pantalla lee la etiqueta y
    // luego el número. El número sigue pintándose arriba con flex-col-reverse.
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="mt-1 truncate text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        {label}
      </dt>
      <dd className={`m-0 text-lg font-black tabular-nums leading-none ${value > 0 ? tone : 'text-neutral-300 dark:text-neutral-600'}`}>
        {value}
      </dd>
    </div>
  )
}

function DeliveryStatsCard() {
  const { t, i18n } = useTranslation()
  const { data, isPending, isError } = useQuery({
    queryKey: [...DELIVERY_STATS_KEY, PUSH_STATS_DAYS],
    queryFn: () => fetchPushDeliveryStats(PUSH_STATS_DAYS),
  })

  const cardClass = 'rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900'
  const noteClass = 'm-0 p-4 text-xs font-medium leading-snug text-neutral-500 dark:text-neutral-400'

  if (isPending) {
    return (
      <div className={`${cardClass} flex items-center gap-2 ${noteClass}`}>
        <Loader2 size={14} className="animate-spin" />
        {t('admin.loading', 'Cargando…')}
      </div>
    )
  }

  if (isError) {
    return (
      <p className={`${cardClass} ${noteClass}`}>
        {t('admin.push.stats.loadFailed', 'No se pudieron cargar las entregas.')}
      </p>
    )
  }

  // `null` es "la función no existe": sin la migración no hay nada que contar, y
  // una lista vacía se leería como "no ha salido ninguna entrega".
  if (data === null) {
    const migration = '20261021000100'
    return (
      <p className={`${cardClass} ${noteClass}`}>
        {t('admin.push.stats.missingMigration', {
          migration,
          defaultValue: `Para ver las entregas por servicio, aplica la migración ${migration} en Supabase (SQL Editor).`,
        })}
      </p>
    )
  }

  if (data.length === 0) {
    return (
      <p className={`${cardClass} ${noteClass}`}>
        {t('admin.push.stats.empty', {
          days: PUSH_STATS_DAYS,
          defaultValue: `No ha salido ninguna entrega en los últimos ${PUSH_STATS_DAYS} días.`,
        })}
      </p>
    )
  }

  const when = (stat: PushServiceStat) => stat.lastAt
    ? new Date(stat.lastAt).toLocaleString(i18n.language, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className={`${cardClass} overflow-hidden`}>
      <ul className="m-0 list-none divide-y divide-neutral-100 p-0 dark:divide-neutral-800">
        {data.map((stat) => (
          <li key={stat.host} className="flex flex-col gap-3 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <code className="min-w-0 truncate font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200" title={stat.host}>
                {stat.host}
              </code>
              {when(stat) && (
                <span className="shrink-0 text-[10px] font-medium text-neutral-400">
                  {t('admin.push.stats.lastAt', { when: when(stat), defaultValue: `Última: ${when(stat)}` })}
                </span>
              )}
            </div>

            <dl className="m-0 grid grid-cols-4 gap-2">
              <StatCell label={t('admin.push.stats.colSent', 'Enviadas')} value={stat.sent} tone="text-emerald-600 dark:text-emerald-400" />
              <StatCell label={t('admin.push.stats.colFailed', 'Fallidas')} value={stat.failed} tone="text-[#D41F2D] dark:text-red-400" />
              <StatCell label={t('admin.push.stats.colExpired', 'Caducadas')} value={stat.expired} tone="text-amber-600 dark:text-amber-400" />
              <StatCell label={t('admin.push.stats.colPending', 'Pendientes')} value={stat.pending} tone="text-neutral-700 dark:text-neutral-200" />
            </dl>

            {stat.lastError && (
              <p
                className="m-0 line-clamp-2 break-words rounded-xl bg-red-50 px-3 py-2 text-[11px] font-medium leading-snug text-red-700 dark:bg-red-950/30 dark:text-red-300"
                title={stat.lastError}
              >
                <span className="font-bold">{t('admin.push.stats.lastError', 'Último error:')}</span>{' '}
                {stat.lastError}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="m-0 border-t border-neutral-100 px-4 py-2.5 text-[11px] font-medium leading-snug text-neutral-400 dark:border-neutral-800">
        {t('admin.push.stats.hint', 'Cuenta entregas, no dispositivos. «Caducadas» son suscripciones que el servicio dio por muertas.')}
      </p>
    </div>
  )
}
