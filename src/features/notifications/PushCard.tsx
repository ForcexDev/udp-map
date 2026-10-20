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
      <div className="flex items-center gap-3 rounded-2xl border border-[#E6E0D5] bg-white p-4 dark:border-white/[0.07] dark:bg-[#1E222D]">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-[#EFECE4] dark:bg-white/[0.08]" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-3 w-32 animate-pulse rounded-full bg-[#EFECE4] dark:bg-white/[0.08]" />
          <div className="h-2.5 w-44 animate-pulse rounded-full bg-[#EFECE4] dark:bg-white/[0.08]" />
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
      className={`rounded-2xl border p-4 transition-colors ${
        on
          ? 'border-emerald-300/60 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20'
          : blocked
            ? 'border-amber-300/60 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20'
            : 'border-[#E6E0D5] bg-white dark:border-white/[0.07] dark:bg-[#1E222D]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
            on
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
              : blocked
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                : 'bg-[#EFECE4] text-stone-500 dark:bg-white/[0.08] dark:text-stone-400'
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
          <p className="text-sm font-bold leading-tight text-stone-900 dark:text-stone-100">{title}</p>
          <p className="mt-0.5 text-xs font-normal leading-snug text-stone-500 dark:text-stone-400">
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
              className="h-10 shrink-0 rounded-2xl bg-[#C22B38] hover:bg-[#a8242f] dark:bg-[#D93846] dark:hover:bg-[#c22b38] px-4 text-xs font-semibold text-white transition-colors active:scale-95"
            >
              {t('notifications.push.install', 'Cómo instalar')}
            </button>
          ) : on ? (
            <button
              type="button"
              onClick={() => void unsubscribe()}
              disabled={busy}
              className="h-10 shrink-0 rounded-2xl border border-[#E6E0D5] bg-white px-4 text-xs font-semibold text-stone-700 transition-colors hover:bg-[#FAF8F5] active:scale-95 disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#1E222D] dark:text-stone-300 dark:hover:bg-white/[0.05]"
            >
              {t('notifications.push.disable', 'Desactivar')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void subscribe()}
              disabled={busy}
              className="h-10 shrink-0 rounded-2xl bg-[#C22B38] hover:bg-[#a8242f] dark:bg-[#D93846] dark:hover:bg-[#c22b38] px-4 text-xs font-semibold text-white transition-colors active:scale-95 disabled:opacity-40"
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
        <p className="mt-3 rounded-xl bg-red-50/80 px-3 py-2 text-xs font-medium leading-snug text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
