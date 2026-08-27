import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, BellRing, ChevronRight, Loader2, Send, TriangleAlert } from 'lucide-react'
import { usePushSubscription } from '@/features/notifications/usePushSubscription'
import { triggerServerPushTest, fetchDashboardStats } from './api'
import { useUIStore } from '@/shared/stores/uiStore'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
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
  const { state: pushState } = usePushSubscription()
  const showToast = useUIStore((s) => s.showToast)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)

  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchDashboardStats,
  })

  const recipients = stats?.pushSubscribers ?? 0
  const ready = title.trim().length > 0 && body.trim().length > 0

  const send = async () => {
    setSending(true)
    try {
      const res = await triggerServerPushTest(title.trim(), body.trim())
      showToast(
        res.failed > 0
          ? `Enviado a ${res.sent} de ${res.processed}. ${res.failed} no llegaron.`
          : `Enviado a ${res.sent} ${res.sent === 1 ? 'dispositivo' : 'dispositivos'}.`,
      )
      setTitle('')
      setBody('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo enviar el aviso.')
    } finally {
      setSending(false)
      setConfirming(false)
    }
  }

  return (
    <AdminScreen
      title="Difusión"
      description="Enviar un aviso a todos los dispositivos suscritos."
      width="narrow"
    >
      <div className="flex flex-col gap-5">
        {/* Cuánta gente lo va a recibir, antes de escribir nada. */}
        <div className="flex items-center gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-purple-50 text-purple-500 dark:bg-purple-950/40">
            <BellRing size={24} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <span className="block text-[11px] font-black uppercase tracking-wider text-neutral-400">
              Llegará a
            </span>
            <span className="block text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
              {recipients} {recipients === 1 ? 'dispositivo' : 'dispositivos'}
            </span>
          </div>
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
              placeholder="Corte de agua en Ejército 441"
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
              placeholder="Los baños del segundo piso estarán cerrados hasta las 16:00."
              className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm font-medium text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[#D41F2D] focus:bg-white dark:border-neutral-700/80 dark:bg-neutral-800/60 dark:text-white dark:focus:bg-neutral-900"
            />
            <p className="mt-1 text-right text-[10px] font-bold text-neutral-400">
              {body.length}/180
            </p>
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
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title="Enviar el aviso"
        description={`Llegará al instante a ${recipients} ${recipients === 1 ? 'dispositivo' : 'dispositivos'}. Una notificación entregada no se puede retirar.`}
        confirmText={sending ? 'Enviando…' : 'Enviar'}
        onConfirm={() => void send()}
      />
    </AdminScreen>
  )
}
