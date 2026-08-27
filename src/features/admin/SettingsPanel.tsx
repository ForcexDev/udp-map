import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Loader2, MapPinOff, Send } from 'lucide-react'
import { PushCard } from '@/features/notifications/PushCard'
import { usePushStore } from '@/features/notifications/pushStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { sendSelfPushTest } from './api'
import { AdminScreen } from './AdminScreen'

// ─────────────────────────────────────────────────────────────────────────────
// Ajustes del panel.
//
// Existe por la regla de §13.2 del ROADMAP: si es una herramienta de
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

export function SettingsPanel() {
  const { t } = useTranslation()
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
        result.sent > 0
          ? 'Prueba enviada. Debería aparecer en tu pantalla en unos segundos.'
          : 'La prueba se encoló pero no salió a ningún dispositivo.',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo enviar la prueba.')
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
