import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, MapPin, Compass, GraduationCap, Hand, Check, Share, PlusSquare, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { useUIStore } from '@/shared/stores/uiStore'
import { isIOSDevice, isStandaloneDisplay } from '@/shared/utils/pwa'

export function TutorialModal() {
  const { t } = useTranslation()
  const open = useUIStore((s) => s.tutorialOpen)
  const close = useUIStore((s) => s.closeTutorial)
  const showToast = useUIStore((s) => s.showToast)

  const [isStandalone, setIsStandalone] = useState(false)
  const [showSafariGuide, setShowSafariGuide] = useState(false)

  const isIOS = isIOSDevice()

  useEffect(() => {
    setIsStandalone(isStandaloneDisplay())
  }, [])

  const handleInstallClick = async () => {
    const promptEvent = window.__deferredPwaPrompt

    if (promptEvent) {
      try {
        await promptEvent.prompt()
        const choice = await promptEvent.userChoice
        if (choice.outcome === 'accepted') {
          window.__deferredPwaPrompt = undefined
          setIsStandalone(true)
          showToast(t('tutorial.installed', '¡UDP Map instalada en tu dispositivo!'))
        }
      } catch (err) {
        console.error('Error abriendo instalador PWA', err)
      }
    } else if (isIOS) {
      setShowSafariGuide((prev) => !prev)
    } else {
      showToast(t('tutorial.installDesktopHint', 'En Chrome/Edge: haz clic en el icono “Instalar” (⊕) en la barra de direcciones o en el menú de opciones.'))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title={t('tutorial.title', 'Bienvenido a UDP Map')}
      description={t('tutorial.subtitle', 'Explora tu campus, descubre facultades y comparte eventos.')}
      contentClassName="!bg-white dark:!bg-neutral-900 sm:max-w-md max-h-[85dvh] overflow-y-auto p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 py-1">
        {/* Smart PWA Install Card */}
        {!isStandalone ? (
          <div className="rounded-2xl border border-[#D41F2D]/20 bg-[#D41F2D]/[0.05] p-3.5 dark:border-red-900/50 dark:bg-red-950/25 flex flex-col gap-2.5">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-neutral-900 dark:text-white leading-tight">
                {t('tutorial.installTitle', 'Instala UDP Map para disfrutarla al máximo')}
              </h3>
              <p className="mt-1 text-[11px] leading-snug font-medium text-neutral-600 dark:text-neutral-300">
                {t('tutorial.installBenefit', 'Acceso instantáneo desde tu pantalla de inicio sin barra de navegador.')}
              </p>
            </div>

            <button
              onClick={handleInstallClick}
              className="w-full py-2.5 px-4 bg-[#D41F2D] hover:bg-[#b01a25] text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer mt-0.5"
            >
              <Download size={16} strokeWidth={2.5} />
              <span>{isIOS ? t('tutorial.installIOS', 'Ver cómo instalar en iPhone') : t('tutorial.installAction', 'Instalar aplicación')}</span>
              {isIOS && (showSafariGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
            </button>

            {/* Visual Step-by-Step Tutorial for iPhone/Safari */}
            {isIOS && showSafariGuide && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs flex flex-col gap-2 text-amber-950 dark:text-amber-200 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 font-extrabold text-amber-700 dark:text-amber-400">
                  <Sparkles size={14} />
                  <span>{t('tutorial.safariSteps', 'Pasos para instalar en Safari (iPhone):')}</span>
                </div>
                <ol className="flex flex-col gap-1.5 font-medium text-[11px] text-neutral-700 dark:text-neutral-300">
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                    <span>{t('tutorial.safariStep1Before', 'Toca el botón')} <strong>{t('tutorial.safariStep1Action', 'Compartir')} <Share size={13} className="inline text-blue-500" /></strong> {t('tutorial.safariStep1After', 'en Safari.')}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                    <span>{t('tutorial.safariStep2Before', 'Desliza y selecciona')} <strong>“{t('tutorial.safariStep2Action', 'Agregar a inicio')}” <PlusSquare size={13} className="inline text-neutral-900 dark:text-white" /></strong>.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                    <span>{t('tutorial.safariStep3Before', 'Toca')} <strong>“{t('tutorial.safariStep3Action', 'Agregar')}”</strong> {t('tutorial.safariStep3After', 'en la esquina superior derecha.')}</span>
                  </li>
                </ol>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/30 px-3.5 py-2.5 rounded-2xl">
            <Check size={16} strokeWidth={2.5} />
            <span>{t('tutorial.installedAlready', 'Aplicación instalada y lista para usar')}</span>
          </div>
        )}

        {/* 2x2 Feature Grid */}
        <div className="grid grid-cols-2 gap-2 mt-0.5">
          <div className="flex flex-col p-2.5 sm:p-3 rounded-2xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-800/40">
            <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center mb-1">
              <Hand size={15} />
            </div>
            <span className="text-xs font-extrabold text-neutral-900 dark:text-white leading-tight">{t('tutorial.cardExploreTitle', 'Explora en 3D')}</span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight mt-0.5">{t('tutorial.cardExploreBody', 'Navega e inclina la vista para ver los edificios en 3D.')}</span>
          </div>

          <div className="flex flex-col p-2.5 sm:p-3 rounded-2xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-800/40">
            <div className="w-7 h-7 rounded-xl bg-red-50 dark:bg-red-900/30 text-[#D41F2D] flex items-center justify-center mb-1">
              <MapPin size={15} />
            </div>
            <span className="text-xs font-extrabold text-neutral-900 dark:text-white leading-tight">{t('tutorial.cardPinsTitle', 'Pines y reportes')}</span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight mt-0.5">{t('tutorial.cardPinsBody', 'Publica eventos, comida, salas o avisos útiles con (+).')}</span>
          </div>

          <div className="flex flex-col p-2.5 sm:p-3 rounded-2xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-800/40">
            <div className="w-7 h-7 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 flex items-center justify-center mb-1">
              <Compass size={15} />
            </div>
            <span className="text-xs font-extrabold text-neutral-900 dark:text-white leading-tight">{t('tutorial.cardSearchTitle', 'Búsqueda y rutas')}</span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight mt-0.5">{t('tutorial.cardSearchBody', 'Encuentra facultades al instante y calcula rutas a pie.')}</span>
          </div>

          <div className="flex flex-col p-2.5 sm:p-3 rounded-2xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-800/40">
            <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400 flex items-center justify-center mb-1">
              <GraduationCap size={15} />
            </div>
            <span className="text-xs font-extrabold text-neutral-900 dark:text-white leading-tight">{t('tutorial.cardCommunityTitle', 'Comunidad UDP')}</span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight mt-0.5">{t('tutorial.cardCommunityBody', 'Inicia sesión con tu correo @mail.udp.cl para votar y comentar.')}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-1">
        <Button onClick={close} className="w-full font-extrabold py-2.5 text-xs sm:text-sm">
          {t('tutorial.start', '¡Entendido, a explorar!')}
        </Button>
      </div>
    </Dialog>
  )
}
