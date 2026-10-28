import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Download,
  MapPin,
  Compass,
  GraduationCap,
  Hand,
  Check,
  Share,
  PlusSquare,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from '@/features/auth/authStore'
import { isIOSDevice, isStandaloneDisplay } from '@/shared/utils/pwa'

export function TutorialModal() {
  const { t } = useTranslation()
  const open = useUIStore((s) => s.tutorialOpen)
  const close = useUIStore((s) => s.closeTutorial)
  const showToast = useUIStore((s) => s.showToast)

  // Si el usuario necesita completar su perfil (ProfileSetupModal abierto),
  // el tutorial se esconde para no apilar dos modales encima. Se verá cuando
  // el setup termine y faculty_id deje de ser null.
  const user = useAuthStore((s) => s.user)
  const needsSetup = !!user && user.faculty_id === null
  const effectiveOpen = open && !needsSetup

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
      showToast(
        t(
          'tutorial.installDesktopHint',
          'En Chrome/Edge: haz clic en el icono “Instalar” (⊕) en la barra de direcciones o en el menú de opciones.',
        ),
      )
    }
  }

  return (
    <Dialog
      open={effectiveOpen}
      onOpenChange={(o) => !o && close()}
      title={t('tutorial.title', 'Bienvenido a UDP Map')}
      description={t(
        'tutorial.subtitle',
        'Explora tu campus, descubre facultades y comparte eventos.',
      )}
      contentClassName="!bg-[#FAF8F5] dark:!bg-[#151820] border border-[#E5DEC9] dark:border-white/10 sm:max-w-md max-h-[85dvh] overflow-y-auto p-4 sm:p-5 rounded-[28px]"
    >
      <div className="flex flex-col gap-3 py-1">
        {/* Smart PWA Install Card */}
        {!isStandalone ? (
          <div className="rounded-2xl border border-[#C22B38]/20 bg-[#C22B38]/[0.05] p-3.5 dark:border-[#D93846]/30 dark:bg-[#D93846]/15 flex flex-col gap-2.5">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 leading-tight">
                {t('tutorial.installTitle', 'Instala UDP Map para disfrutarla al máximo')}
              </h3>
              <p className="mt-1 text-xs leading-snug font-normal text-stone-600 dark:text-stone-300">
                {t(
                  'tutorial.installBenefit',
                  'Acceso instantáneo desde tu pantalla de inicio sin barra de navegador.',
                )}
              </p>
            </div>

            <button
              onClick={handleInstallClick}
              className="w-full py-2.5 px-4 bg-[#C22B38] hover:bg-[#a8222f] dark:bg-[#D93846] text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer mt-0.5"
            >
              <Download size={16} strokeWidth={2.5} />
              <span>
                {isIOS
                  ? t('tutorial.installIOS', 'Ver cómo instalar en iPhone')
                  : t('tutorial.installAction', 'Instalar aplicación')}
              </span>
              {isIOS && (showSafariGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
            </button>

            {/* Visual Step-by-Step Tutorial for iPhone/Safari */}
            {isIOS && showSafariGuide && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs flex flex-col gap-2 text-amber-950 dark:text-amber-200 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 font-extrabold text-amber-700 dark:text-amber-400">
                  <Sparkles size={14} />
                  <span>
                    {t('tutorial.safariSteps', 'Pasos para instalar en Safari (iPhone):')}
                  </span>
                </div>
                <ol className="flex flex-col gap-1.5 font-medium text-[11px] text-neutral-700 dark:text-neutral-300">
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span>
                      {t('tutorial.safariStep1Before', 'Toca el botón')}{' '}
                      <strong>
                        {t('tutorial.safariStep1Action', 'Compartir')}{' '}
                        <Share size={13} className="inline text-blue-500" />
                      </strong>{' '}
                      {t('tutorial.safariStep1After', 'en Safari.')}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span>
                      {t('tutorial.safariStep2Before', 'Desliza y selecciona')}{' '}
                      <strong>
                        “{t('tutorial.safariStep2Action', 'Agregar a inicio')}”{' '}
                        <PlusSquare size={13} className="inline text-neutral-900 dark:text-white" />
                      </strong>
                      .
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      3
                    </span>
                    <span>
                      {t('tutorial.safariStep3Before', 'Toca')}{' '}
                      <strong>“{t('tutorial.safariStep3Action', 'Agregar')}”</strong>{' '}
                      {t('tutorial.safariStep3After', 'en la esquina superior derecha.')}
                    </span>
                  </li>
                </ol>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/30 px-3.5 py-2.5 rounded-2xl">
            <Check size={16} strokeWidth={2.5} />
            <span>{t('tutorial.installedAlready', 'Aplicación instalada y lista para usar')}</span>
          </div>
        )}

        {/* 2x2 Feature Grid */}
        <div className="grid grid-cols-2 gap-2 mt-0.5">
          <div className="flex flex-col p-3 rounded-2xl border border-[#E5DEC9] dark:border-white/[0.08] bg-white dark:bg-[#1E222D]">
            <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center mb-1">
              <Hand size={15} />
            </div>
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-tight">
              {t('tutorial.cardExploreTitle', 'Explora en 3D')}
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight mt-1">
              {t(
                'tutorial.cardExploreBody',
                'Navega e inclina la vista para ver los edificios en 3D.',
              )}
            </span>
          </div>

          <div className="flex flex-col p-3 rounded-2xl border border-[#E5DEC9] dark:border-white/[0.08] bg-white dark:bg-[#1E222D]">
            <div className="w-7 h-7 rounded-xl bg-[#C22B38]/10 text-[#C22B38] flex items-center justify-center mb-1">
              <MapPin size={15} />
            </div>
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-tight">
              {t('tutorial.cardPinsTitle', 'Pines y reportes')}
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight mt-1">
              {t(
                'tutorial.cardPinsBody',
                'Publica eventos, comida, salas o avisos útiles con (+).',
              )}
            </span>
          </div>

          <div className="flex flex-col p-3 rounded-2xl border border-[#E5DEC9] dark:border-white/[0.08] bg-white dark:bg-[#1E222D]">
            <div className="w-7 h-7 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 flex items-center justify-center mb-1">
              <Compass size={15} />
            </div>
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-tight">
              {t('tutorial.cardSearchTitle', 'Búsqueda y rutas')}
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight mt-1">
              {t(
                'tutorial.cardSearchBody',
                'Encuentra facultades al instante y calcula rutas a pie.',
              )}
            </span>
          </div>

          <div className="flex flex-col p-3 rounded-2xl border border-[#E5DEC9] dark:border-white/[0.08] bg-white dark:bg-[#1E222D]">
            <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400 flex items-center justify-center mb-1">
              <GraduationCap size={15} />
            </div>
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-tight">
              {t('tutorial.cardCommunityTitle', 'Comunidad UDP')}
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight mt-1">
              {t(
                'tutorial.cardCommunityBody',
                'Inicia sesión con tu correo @mail.udp.cl para votar y comentar.',
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-1">
        <Button
          onClick={close}
          className="w-full font-semibold py-3 text-xs sm:text-sm rounded-2xl bg-[#C22B38] dark:bg-[#D93846] text-white hover:opacity-95 shadow-xs"
        >
          {t('tutorial.start', '¡Entendido, a explorar!')}
        </Button>
      </div>
    </Dialog>
  )
}
