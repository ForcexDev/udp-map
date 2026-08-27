import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, BellOff, BellRing, ChevronDown, ChevronRight, Loader2, MapPin, Search, Send, TriangleAlert, X } from 'lucide-react'
import { usePushSubscription } from '@/features/notifications/usePushSubscription'
import { triggerServerPushTest, fetchDashboardStats, fetchAdminPins, fetchPushSubscribers, deletePushSubscriberDevice } from './api'
import { deviceName } from './deviceName'
import type { PushSubscriber } from './api'
import { pinContext } from './pinContext'
import { categoryById } from '@/shared/data/campusData'
import type { Pin } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { useQueryClient } from '@tanstack/react-query'
import { AdminScreen } from './AdminScreen'

// ─────────────────────────────────────────────────────────────────────────────
// Difusión.
//
// Esta pantalla se llamaba "Push Test" y su botón decía «Test Servidor
// (send-push)», pero no prueba nada: manda una notificación REAL al teléfono de
// todo el mundo, al instante y sin preguntar. Llamarlo prueba invitaba a pulsarlo
// para ver qué pasaba.
//
// Ahora es lo que siempre fue —difundir un aviso— y por tanto:
//   · el número de personas a las que llega se ve ANTES de escribir nada,
//   · hay vista previa de cómo se verá el aviso,
//   · y hay confirmación, porque no se puede deshacer: una notificación
//     entregada no se retira.
//
// La prueba de verdad —¿me llega a MÍ?— es lo de abajo del todo, y solo toca
// este navegador.
// ─────────────────────────────────────────────────────────────────────────────

const PUSH_STATE_LABEL: Record<string, string> = {
  unknown: 'Comprobando este dispositivo…',
  subscribed: 'Este dispositivo recibe avisos',
  idle: 'Este dispositivo no está suscrito',
  denied: 'Bloqueadas en este navegador',
  unsupported: 'Este navegador no las soporta',
  'ios-not-installed': 'En iPhone hay que instalar la app primero',
  loading: 'Activando…',
  error: 'No se pudo comprobar',
}

export function BroadcastPanel() {
  const { t } = useTranslation()
  const { state: pushState } = usePushSubscription()
  const showToast = useUIStore((s) => s.showToast)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  // El pin al que lleva el aviso. Sin él la notificación no va a ninguna parte:
  // su url era '/' fija, así que tocarla te dejaba en el mapa preguntándote qué
  // había pasado.
  const [linkedPin, setLinkedPin] = useState<Pin | null>(null)
  const [pinSearch, setPinSearch] = useState('')
  const [showSubscribers, setShowSubscribers] = useState(false)
  // El dispositivo que se va a dar de baja, esperando confirmación. Quitarle a
  // alguien sus avisos sin preguntar sería un toque de más para algo que esa
  // persona no puede deshacer sola.
  const [unsubscribing, setUnsubscribing] = useState<PushSubscriber | null>(null)
  const queryClient = useQueryClient()

  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchDashboardStats,
  })

  const { data: subscribers } = useQuery({
    queryKey: ['admin', 'push-subscribers'],
    queryFn: fetchPushSubscribers,
  })

  // Solo se busca a partir de dos letras: con una, la lista es "todos los pines".
  const { data: pinResults = [] } = useQuery({
    queryKey: ['admin', 'pins', 'broadcast-search', pinSearch],
    queryFn: () => fetchAdminPins({ search: pinSearch }),
    enabled: pinSearch.trim().length >= 2 && !linkedPin,
  })

  const recipients = stats?.pushSubscribers ?? 0
  const ready = title.trim().length > 0 && body.trim().length > 0

  const removeDevice = async (sub: PushSubscriber) => {
    if (!sub.endpoint) return
    try {
      await deletePushSubscriberDevice(sub.endpoint)
      showToast(`${sub.name ?? 'El dispositivo'} ya no recibirá avisos en ese aparato.`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'push-subscribers'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo dar de baja el dispositivo.')
    } finally {
      setUnsubscribing(null)
    }
  }

  const send = async () => {
    setSending(true)
    try {
      const res = await triggerServerPushTest(
        title.trim(),
        body.trim(),
        linkedPin ? `/mapa?pin=${linkedPin.id}` : '/',
      )
      showToast(
        res.failed > 0
          ? `Enviado a ${res.sent} de ${res.processed}. ${res.failed} no llegaron.`
          : `Enviado a ${res.sent} ${res.sent === 1 ? 'dispositivo' : 'dispositivos'}.`,
      )
      setTitle('')
      setBody('')
      setLinkedPin(null)
      setPinSearch('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo enviar el aviso.')
    } finally {
      setSending(false)
      setConfirming(false)
    }
  }

  return (
    <AdminScreen
      title={t('admin.sections.broadcast')}
      description={t('admin.sections.broadcastHint')}
      width="narrow"
    >
      <div className="flex flex-col gap-5">
        {/* A quién le va a llegar, antes de escribir nada.
            Era solo el número, y con un número no se puede responder a lo único
            que importa antes de escribirle a toda la universidad: a QUIÉN. */}
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => setShowSubscribers((v) => !v)}
            disabled={!subscribers || subscribers.length === 0}
            className="flex w-full cursor-pointer items-center gap-4 p-4 text-left transition-colors hover:bg-neutral-50 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-neutral-800/60 dark:disabled:hover:bg-transparent"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-purple-50 text-purple-500 dark:bg-purple-950/40">
              <BellRing size={24} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-black uppercase tracking-wider text-neutral-400">
                Llegará a
              </span>
              <span className="block text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
                {recipients} {recipients === 1 ? 'dispositivo' : 'dispositivos'}
              </span>
            </span>
            {subscribers && subscribers.length > 0 && (
              <ChevronDown
                size={18}
                className={`shrink-0 text-neutral-400 transition-transform ${showSubscribers ? 'rotate-180' : ''}`}
              />
            )}
          </button>

          {showSubscribers && subscribers && (
            <ul className="m-0 list-none divide-y divide-neutral-100 border-t border-neutral-100 p-0 dark:divide-neutral-800 dark:border-neutral-800">
              {subscribers.map((sub) => (
                <li key={sub.endpoint ?? `${sub.userId}-${sub.createdAt}`} className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      {sub.name ?? 'Sin nombre'}
                    </span>
                    {/* En móvil el dispositivo no cabe al lado del nombre: baja
                        debajo en vez de recortarse a la mitad. */}
                    <span className="block truncate text-[11px] font-medium text-neutral-400 sm:hidden">
                      {deviceName(sub.userAgent)}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-[11px] font-medium text-neutral-400 sm:block">
                    {deviceName(sub.userAgent)}
                  </span>
                  {sub.endpoint && (
                    <button
                      type="button"
                      onClick={() => setUnsubscribing(sub)}
                      title={t('admin.unsubscribeDevice')}
                      aria-label={`Dar de baja el dispositivo de ${sub.name ?? 'esta persona'}`}
                      className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-neutral-400 transition-colors hover:bg-red-50 hover:text-[#D41F2D] dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      <BellOff size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {subscribers === null && (
            <p className="border-t border-neutral-100 px-4 py-2.5 text-[11px] font-medium leading-snug text-neutral-400 dark:border-neutral-800">
              {t('admin.seeWhoHint', { migration: '20260829000100' })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
          <div>
            <label
              htmlFor="broadcast-title"
              className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-neutral-400"
            >
              Título
            </label>
            <input
              id="broadcast-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              placeholder={t('admin.broadcastTitlePlaceholder')}
              className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-sm font-semibold text-neutral-900 outline-none transition-colors placeholder:font-medium placeholder:text-neutral-400 focus:border-[#D41F2D] focus:bg-white dark:border-neutral-700/80 dark:bg-neutral-800/60 dark:text-white dark:focus:bg-neutral-900"
            />
          </div>

          <div>
            <label
              htmlFor="broadcast-body"
              className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-neutral-400"
            >
              Mensaje
            </label>
            <textarea
              id="broadcast-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={180}
              placeholder={t('admin.broadcastBodyPlaceholder')}
              className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm font-medium text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[#D41F2D] focus:bg-white dark:border-neutral-700/80 dark:bg-neutral-800/60 dark:text-white dark:focus:bg-neutral-900"
            />
            <p className="mt-1 text-right text-[10px] font-bold text-neutral-400">
              {body.length}/180
            </p>
          </div>

          {/* A dónde lleva el aviso.
              Opcional a propósito: "el casino cierra a las 18:00" no apunta a
              ningún pin, y obligar a elegir uno inventaría un destino. */}
          <div>
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-neutral-400">
              Lleva a un pin <span className="normal-case tracking-normal text-neutral-400">(opcional)</span>
            </span>

            {linkedPin ? (
              <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700/80 dark:bg-neutral-800/60">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
                  <MapPin size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-neutral-900 dark:text-white">
                    {linkedPin.title}
                  </span>
                  <span className="block text-[11px] font-medium text-neutral-400">
                    Al tocar el aviso se abrirá este pin en el mapa.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => { setLinkedPin(null); setPinSearch('') }}
                  aria-label={t('admin.removeLinkedPin')}
                  className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div>
                {/* El `relative` envuelve SOLO al campo, no al campo más la
                    lista. Cuando envolvía a los dos, el `top-1/2` de la lupa se
                    medía contra el contenedor entero: al aparecer resultados el
                    contenedor crecía y el icono se deslizaba hasta la mitad,
                    aterrizando encima del primer resultado. */}
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={pinSearch}
                    onChange={(e) => setPinSearch(e.target.value)}
                    placeholder={t('admin.searchPin')}
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-3.5 text-sm font-medium text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[#D41F2D] focus:bg-white dark:border-neutral-700/80 dark:bg-neutral-800/60 dark:text-white dark:focus:bg-neutral-900"
                  />
                </div>

                {pinSearch.trim().length >= 2 && (
                  <ul className="m-0 mt-2 flex max-h-52 list-none flex-col gap-1 overflow-y-auto p-0">
                    {pinResults.length === 0 ? (
                      <li className="px-1 py-2 text-xs font-medium text-neutral-400">
                        Ningún pin con ese título.
                      </li>
                    ) : (
                      pinResults.slice(0, 8).map((pin) => (
                        <li key={pin.id}>
                          <button
                            type="button"
                            onClick={() => setLinkedPin(pin)}
                            className="flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            <MapPin
                              size={15}
                              className="mt-0.5 shrink-0"
                              style={{ color: categoryById(pin.category_id)?.color ?? '#94a3b8' }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                                {pin.title}
                              </span>
                              {/* El título solo no distingue: hay cuatro "Sala
                                  S101" en edificios distintos. Lo que las separa
                                  es dónde están y de qué son. */}
                              <span className="block truncate text-[11px] font-medium text-neutral-400">
                                {pinContext(pin)}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Vista previa: una notificación se lee en dos líneas y con el
              teléfono en la mano, no en un formulario. */}
          {ready && (
            <div>
              <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-neutral-400">
                Así se verá
              </span>
              <div className="flex items-start gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-3.5 dark:border-neutral-800 dark:bg-neutral-800/50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#D41F2D] text-white">
                  <Bell size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold text-neutral-900 dark:text-white">
                    {title.trim()}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium leading-snug text-neutral-500 dark:text-neutral-400">
                    {body.trim()}
                  </span>
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!ready || sending || recipients === 0}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#D41F2D] text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-[#b11a25] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            {sending ? 'Enviando…' : 'Enviar a todos'}
          </button>

          {recipients === 0 && (
            <p className="flex items-start gap-2 text-[11px] font-medium text-neutral-400">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              Nadie tiene las notificaciones activadas todavía, así que no hay a quién enviar.
            </p>
          )}
        </div>

        {/* Probar ya no se hace aquí: tenía su propia copia del interruptor de
            push, distinta de la del centro de avisos y con los textos ya
            separados. Vive en Ajustes, junto al resto del estado del
            dispositivo. Lo que queda es el enlace, porque comprobar tu teléfono
            antes de escribirle a la universidad entera sí es el gesto correcto. */}
        <Link
          to="/admin/ajustes"
          className="group flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-900"
        >
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
              pushState === 'subscribed'
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
            }`}
          >
            <Bell size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-neutral-900 dark:text-white">
              {PUSH_STATE_LABEL[pushState] ?? pushState}
            </span>
            <span className="block text-[11px] font-medium text-neutral-400">
              Pruébalo en tu dispositivo antes de enviar a todos.
            </span>
          </span>
          <ChevronRight
            size={16}
            className="shrink-0 text-neutral-300 transition-colors group-hover:text-[#D41F2D] dark:text-neutral-600"
          />
        </Link>
      </div>

      <ConfirmDialog
        open={unsubscribing !== null}
        onOpenChange={(open) => !open && setUnsubscribing(null)}
        title={t('admin.unsubscribeDevice')}
        description={unsubscribing
          ? `${unsubscribing.name ?? 'Esta persona'} dejará de recibir avisos en ${deviceName(unsubscribing.userAgent)}. Puede volver a activarlos desde su aplicación.`
          : ''}
        confirmText="Dar de baja"
        onConfirm={() => { if (unsubscribing) void removeDevice(unsubscribing) }}
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={t('admin.confirmBroadcast')}
        description={`Llegará al instante a ${recipients} ${recipients === 1 ? 'dispositivo' : 'dispositivos'}. Una notificación entregada no se puede retirar.`}
        confirmText={sending ? 'Enviando…' : 'Enviar'}
        onConfirm={() => void send()}
      />
    </AdminScreen>
  )
}
