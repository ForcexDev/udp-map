import { useTranslation } from 'react-i18next'
import { Download, MapPin, Layers, GraduationCap, Hand, ShieldCheck } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { useUIStore } from '@/shared/stores/uiStore'

export function TutorialModal() {
  const { t } = useTranslation()
  const open = useUIStore((s) => s.tutorialOpen)
  const close = useUIStore((s) => s.closeTutorial)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title={t('tutorial.title', 'Bienvenido a UDP Map')}
      description={t('tutorial.subtitle', 'Descubre todo lo que puedes hacer en el mapa de tu universidad.')}
    >
      <div className="flex flex-col gap-6 py-4">

        <div className="rounded-2xl border border-[#D41F2D]/15 bg-[#D41F2D]/[0.06] p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D41F2D] text-white shadow-sm">
              <Download size={19} />
            </div>
            <div>
              <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                {t('tutorial.installTitle', 'Instala UDP Map para disfrutarla al máximo')}
              </h3>
              <p className="mt-1 text-sm leading-snug text-neutral-600 dark:text-neutral-300">
                {t('tutorial.installBody', 'Agrega UDP Map a tu pantalla de inicio o usa la opción “Instalar” del navegador para tener acceso rápido y una experiencia completa.')}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2.5 text-xs font-semibold text-neutral-600 dark:bg-neutral-900/40 dark:text-neutral-300">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-500" />
            <span>{t('tutorial.browserBody', 'Recomendamos usar Google Chrome o Safari para una mejor experiencia.')}</span>
          </div>
        </div>
        
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center shrink-0">
            <Hand size={20} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('tutorial.3dTitle', 'Explora en 3D')}</h3>
            <p className="text-sm text-neutral-500 mt-1 leading-snug">
              {t('tutorial.3dBody', 'En celular, desliza dos dedos hacia arriba para ver los edificios en 3D.')}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 text-[#D41F2D] flex items-center justify-center shrink-0">
            <MapPin size={20} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('tutorial.pinsTitle', 'Añade Pines')}</h3>
            <p className="text-sm text-neutral-500 mt-1 leading-snug">
              {t('tutorial.pinsBody', 'Usa el botón (+) para reportar eventos, comida, objetos perdidos o lo que pase en el campus.')}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Layers size={20} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('tutorial.indoorTitle', 'Planos Indoor')}</h3>
            <p className="text-sm text-neutral-500 mt-1 leading-snug">
              {t('tutorial.indoorBody', 'Haz clic en cualquier facultad y podrás ver los planos piso por piso, además de la ruta más corta para llegar.')}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <GraduationCap size={20} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{t('tutorial.communityTitle', 'Comunidad UDP')}</h3>
            <p className="text-sm text-neutral-500 mt-1 leading-snug">
              {t('tutorial.communityBody', 'Todos pueden mirar, pero para comentar, votar y reportar necesitas iniciar sesión con tu cuenta @mail.udp.cl.')}
            </p>
          </div>
        </div>

      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Button onClick={close} className="w-full">
          {t('tutorial.start', '¡Entendido, a explorar!')}
        </Button>
      </div>
    </Dialog>
  )
}
