import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { ProfileView } from './components/ProfileView'
import { fetchPublicProfile, fetchUserPins, fetchUserBadges, fetchBadges } from './publicProfileApi'
import type { Pin } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'

interface PublicProfileModalProps {
  userId: string | null
  onClose: () => void
}

// Cerrado no monta nada: sin userId no hay queries ni estado que mantener.
export function PublicProfileModal({ userId, onClose }: PublicProfileModalProps) {
  if (!userId) return null
  return <PublicProfileModalContent userId={userId} onClose={onClose} />
}

function PublicProfileModalContent({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const selectPin = useUIStore((s) => s.selectPin)

  const [activeTab, setActiveTab] = useState<'reports' | 'badges'>('reports')

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchPublicProfile(userId),
  })
  const pinsQuery = useQuery({
    queryKey: ['user-pins', userId],
    queryFn: () => fetchUserPins(userId),
  })
  const userBadgesQuery = useQuery({
    queryKey: ['user-badges', userId],
    queryFn: () => fetchUserBadges(userId),
  })
  const allBadgesQuery = useQuery({
    queryKey: ['badges'],
    queryFn: () => fetchBadges(),
  })

  const profile = profileQuery.data
  const loading =
    profileQuery.isLoading ||
    pinsQuery.isLoading ||
    userBadgesQuery.isLoading ||
    allBadgesQuery.isLoading

  const openOnMap = (pin: Pin) => {
    selectPin(pin.id)
    navigate('/mapa')
    onClose()
  }

  return (
    <RadixDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        {/* Opaco a propósito: el perfil ajeno es una pantalla, no una tarjeta
            flotando sobre el mapa. */}
        {/* z-4600, por encima del `Dialog` compartido (z-4510).

            El perfil se abre DESDE otro diálogo —la lista de asistentes de un
            evento, la tabla de líderes—, así que es siempre el de encima. Con
            los z-40/z-50 que tenía, abrirlo desde la lista de asistentes lo
            dejaba pintado detrás: existía, respondía al teclado, y solo se veía
            borroso al fondo. */}
        <RadixDialog.Overlay className="fixed inset-0 z-[4600] bg-black/60 backdrop-blur-sm" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[4610] flex flex-col overflow-hidden premium-shadow
                     bg-[#FAF8F5] dark:bg-[#151820] border-[#E6E0D5] dark:border-white/[0.07]
                     sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                     sm:h-auto sm:max-h-[85dvh] sm:w-[calc(100vw-4rem)] sm:max-w-xl
                     sm:rounded-3xl sm:border"
        >
          {/* Topbar: anatomía compacta y elegante */}
          <div className="flex items-center justify-between gap-3 px-5 pt-[calc(0.875rem+env(safe-area-inset-top,0px))] pb-3 sm:py-3.5 shrink-0 border-b border-[#E6E0D5] dark:border-white/[0.07] bg-white dark:bg-[#1E222D]">
            <RadixDialog.Title className="text-base sm:text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 m-0">
              {t('profile.title', 'Perfil')}
            </RadixDialog.Title>
            <RadixDialog.Close
              aria-label={t('common.close', 'Cerrar')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EFECE4] dark:bg-white/[0.08] text-stone-600 dark:text-stone-300 hover:bg-[#E2DDD2] dark:hover:bg-white/[0.12] hover:text-stone-900 dark:hover:text-white transition-all cursor-pointer border-none"
            >
              <X size={16} strokeWidth={2.2} />
            </RadixDialog.Close>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y hide-scrollbar pb-safe">
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <div className="w-6 h-6 border-2 border-[#C22B38] dark:border-[#D93846] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : profile ? (
              <ProfileView
                name={profile.name}
                /* profiles_public no expone email (ver PROFILE_PUBLIC_FIELDS):
                   el handle se deriva del nombre. */
                email={null}
                avatarUrl={profile.avatar_url}
                role={profile.role}
                karma={profile.karma}
                createdAt={profile.created_at}
                career={profile.career}
                facultyId={profile.faculty_id}
                pins={pinsQuery.data ?? []}
                pinsLoading={pinsQuery.isLoading}
                badges={allBadgesQuery.data ?? []}
                userBadges={userBadgesQuery.data ?? []}
                badgesLoading={allBadgesQuery.isLoading}
                activeTab={activeTab}
                onTabChange={(v) => setActiveTab(v as 'reports' | 'badges')}
                onViewOnMap={openOnMap}
              />
            ) : (
              <div className="py-10 text-center text-sm font-semibold text-stone-500 dark:text-stone-400">
                {t('profile.notFound', 'Usuario no encontrado.')}
              </div>
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
