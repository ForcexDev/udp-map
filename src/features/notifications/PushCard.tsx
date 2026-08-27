import { useTranslation } from 'react-i18next'
import { BellOff, BellRing, Loader2, TriangleAlert } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { usePushSubscription } from './usePushSubscription'

// ─────────────────────────────────────────────────────────────────────────────
// El interruptor de las notificaciones push, en un solo sitio.
//
// Estaba escrito a mano dentro de `NotificationCenter` y otra vez, distinto,
// dentro de `BroadcastPanel`: dos interfaces para el mismo interruptor, con
// textos que ya se habían separado. Ahora es este componente.
//
// La regla que ordena el resto: mientras el estado sea `unknown` esto pinta un
// ESQUELETO, nunca "Activar". El parpadeo que se veía al volver a la pestaña de
// avisos era justo eso —un botón "Activar" mostrado durante el medio segundo
// que tardaba en saberse que ya estaba activado—. El porqué está en
// `pushStore.ts`.
// ─────────────────────────────────────────────────────────────────────────────

export function PushCard() {
  const { t } = useTranslation()
  const { state, error, subscribe, unsubscribe } = usePushSubscription()
  const openTutorial = useUIStore((s) => s.openTutorial)

  if (state === 'unknown') {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-3 w-32 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
          <div className="h-2.5 w-44 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
        </div>
      </div>
    )
  }

  // El navegador no las soporta y no hay nada que ofrecer: una tarjeta que solo
  // dice "no puedes" es ruido permanente en lo alto de la lista.
  if (state === 'unsupported') return null

  const on = state === 'subscribed'
  const blocked = state === 'denied'
  const iosPending = state === 'ios-not-installed'
  const busy = state === 'loading'

  const subtitle = on
    ? t('notifications.push.on', 'Activadas en este dispositivo')
    : busy
      ? t('notifications.push.checking', 'Comprobando este dispositivo…')
      : blocked
        ? t('notifications.push.deniedHint', 'Permítelas desde el candado de la barra de direcciones.')
        : iosPending
          ? t('notifications.push.iosHint', 'Desde Safari: Compartir → Añadir a pantalla de inicio.')
          : t('notifications.push.off', 'Recíbelas aunque la app esté cerrada')

  const title = blocked
    ? t('notifications.push.denied', 'Bloqueadas en este navegador')
    : iosPending
      ? t('notifications.push.iosNotInstalled', 'En iPhone hay que añadir la app a la pantalla de inicio')
      : t('notifications.push.title', 'Notificaciones push')

  return (
    <div
      className={`rounded-3xl border p-4 transition-colors ${
        on
          ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20'
          : blocked
            ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20'
            : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
            on
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
              : blocked
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
          }`}
        >
          {busy ? (
            <Loader2 size={19} className="animate-spin" />
          ) : on ? (
            <BellRing size={19} strokeWidth={2.2} />
          ) : blocked ? (
            <TriangleAlert size={19} strokeWidth={2.2} />
          ) : (
            <BellOff size={19} strokeWidth={2.2} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight text-neutral-900 dark:text-white">{title}</p>
          <p className="mt-0.5 text-xs font-medium leading-snug text-neutral-500 dark:text-neutral-400">
            {subtitle}
          </p>
        </div>

        {/* Bloqueadas: no hay botón. Un "Activar" que el navegador va a rechazar
            en silencio enseña a desconfiar del botón, no a arreglar el permiso —
            lo que hace falta es la instrucción, y está en el subtítulo. */}
        {!blocked && (
          iosPending ? (
            <button
              type="button"
              onClick={openTutorial}
              className="h-10 shrink-0 rounded-full bg-[#D41F2D] px-4 text-xs font-bold text-white transition-colors hover:bg-[#b11a25] active:scale-95"
            >
              {t('notifications.push.install', 'Cómo instalar')}
            </button>
          ) : on ? (
            <button
              type="button"
              onClick={() => void unsubscribe()}
              disabled={busy}
              className="h-10 shrink-0 rounded-full border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-600 transition-colors hover:bg-neutral-100 active:scale-95 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {t('notifications.push.disable', 'Desactivar')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void subscribe()}
              disabled={busy}
              className="h-10 shrink-0 rounded-full bg-[#D41F2D] px-4 text-xs font-bold text-white transition-colors hover:bg-[#b11a25] active:scale-95 disabled:opacity-40"
            >
              {busy
                ? t('notifications.push.enabling', 'Activando…')
                : state === 'error'
                  ? t('notifications.push.retry', 'Reintentar')
                  : t('notifications.push.enable', 'Activar')}
            </button>
          )
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-xs font-medium leading-snug text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
