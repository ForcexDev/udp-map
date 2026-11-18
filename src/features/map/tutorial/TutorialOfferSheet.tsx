import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GraduationCap } from 'lucide-react'
import { useAuthStore } from '@/features/auth/authStore'
import { noMostrarMas, recordarMasTarde, useOfertaTutorial } from './tutorialOffer'

interface TutorialOfferSheetProps {
  /**
   * Hay otra cosa en primer plano (bienvenida, completar perfil, un pin
   * abierto, modo ubicar). La oferta espera: apilarla encima sería pedir dos
   * decisiones a la vez.
   */
  blocked: boolean
}

/** Oferta del tutorial al entrar al mapa: verlo, más tarde o nunca. */
export function TutorialOfferSheet({ blocked }: TutorialOfferSheetProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const role = useAuthStore((s) => s.role)
  const loading = useAuthStore((s) => s.loading)
  const ofrecer = useOfertaTutorial(userId, role, loading)

  if (!ofrecer || blocked) return null

  return (
    <div
      role="dialog"
      aria-labelledby="tutorial-offer-title"
      data-tutorial-offer
      className="absolute bottom-4 left-3 right-3 z-[60] animate-fade-up sm:left-auto sm:right-4 sm:w-96"
    >
      <div className="glass-hud p-5 rounded-[28px] premium-shadow border border-[#E5DEC9] dark:border-white/10 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#C22B38]/10 text-[#C22B38] dark:text-[#F08A93] rounded-xl flex items-center justify-center flex-shrink-0">
            <GraduationCap size={20} strokeWidth={2.2} />
          </div>
          <div className="flex flex-col">
            <span
              id="tutorial-offer-title"
              className="text-sm font-bold text-stone-900 dark:text-stone-100 tracking-tight"
            >
              {t('mapTutorial.offerTitle', '¿Te enseñamos el mapa?')}
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400 font-medium mt-0.5 leading-snug">
              {t(
                'mapTutorial.offerText',
                'Una práctica de un minuto: buscar, abrir un pin, publicar y filtrar. No se publica nada de verdad.',
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => navigate('/mapa/tutorial')}
            className="h-11 bg-[#C22B38] dark:bg-[#D93846] text-white shadow-xs rounded-2xl font-semibold text-sm active:scale-95 transition-all cursor-pointer"
          >
            {t('mapTutorial.offerStart', 'Ver tutorial')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => recordarMasTarde(userId)}
              className="flex-1 h-10 bg-[#EFECE4] dark:bg-white/[0.08] text-stone-700 dark:text-stone-300 rounded-2xl font-semibold text-xs active:scale-95 transition-all cursor-pointer"
            >
              {t('mapTutorial.offerLater', 'Recordar más tarde')}
            </button>
            <button
              type="button"
              onClick={() => noMostrarMas(userId)}
              className="flex-1 h-10 text-stone-500 dark:text-stone-400 rounded-2xl font-semibold text-xs hover:bg-[#EFECE4] dark:hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer"
            >
              {t('mapTutorial.offerNever', 'No mostrar más')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
