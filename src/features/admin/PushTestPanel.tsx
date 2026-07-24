import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, Send } from 'lucide-react'
import { usePushSubscription } from '@/features/notifications/usePushSubscription'
import { triggerServerPushTest, fetchDashboardStats } from './api'
import { useUIStore } from '@/shared/stores/uiStore'

export function PushTestPanel() {
  const { state: pushState, subscribe } = usePushSubscription(true)
  const showToast = useUIStore((s) => s.showToast)
  const [title, setTitle] = useState('Notificación de prueba UDP Map')
  const [body, setBody] = useState('Este es un mensaje de prueba del panel de administración.')
  const [sendingServer, setSendingServer] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchDashboardStats,
  })

  const handleServerTest = async () => {
    setSendingServer(true)
    setLastResult(null)
    try {
      const res = await triggerServerPushTest(title, body)
      setLastResult(`Respuesta Edge Function: Entregas procesadas: ${res.processed}, Enviadas con éxito: ${res.sent}, Fallidas: ${res.failed}`)
      showToast(`Prueba completada: ${res.sent} notificación(es) enviada(s).`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setLastResult(`Error: ${msg}`)
      showToast(`Fallo en el servidor: ${msg}`)
    } finally {
      setSendingServer(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Device & Subscribers Status Box */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-500 flex items-center justify-center shrink-0">
            <Bell size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-neutral-400 block">Total Dispositivos Suscritos</span>
            <span className="text-xl font-black text-purple-600 dark:text-purple-400">{stats?.pushSubscribers ?? '—'} activos</span>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800">
          <div>
            <span className="text-[10px] font-black uppercase text-neutral-400 block font-mono">Este Navegador</span>
            <span className="text-xs font-extrabold text-neutral-900 dark:text-white uppercase tracking-wider">{pushState}</span>
          </div>
          {pushState !== 'subscribed' && (
            <button
              type="button"
              onClick={() => void subscribe()}
              className="px-3.5 py-1.5 rounded-xl bg-[#D41F2D] text-white text-xs font-extrabold uppercase tracking-wider shadow-sm cursor-pointer"
            >
              Activar
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-neutral-900 dark:text-white">Probar Notificación</h3>
        
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-1">Título de la Notificación</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:border-[#D41F2D]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-1">Mensaje / Cuerpo</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:border-[#D41F2D] resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleServerTest}
            disabled={sendingServer}
            className="flex-1 py-2.5 rounded-xl bg-[#D41F2D] text-white text-xs font-extrabold uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 hover:bg-[#b11a25] transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send size={14} />
            {sendingServer ? 'Enviando…' : 'Test Servidor (send-push)'}
          </button>
        </div>

        {lastResult && (
          <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-mono text-neutral-700 dark:text-neutral-300 break-words">
            {lastResult}
          </div>
        )}
      </div>
    </div>
  )
}
