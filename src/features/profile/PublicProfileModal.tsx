import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog } from '@/shared/ui/Dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { ProfileHeader } from './components/ProfileHeader'
import { ProfileStatsLine } from './components/ProfileStatsLine'
import { ProfileFacultyTag } from './components/ProfileFacultyTag'
import { ProfileTabs } from './components/ProfileTabs'
import { ReportTimeline } from './components/ReportTimeline'
import { BadgesGrid } from './components/BadgesGrid'

import { fetchPublicProfile, fetchUserPins, fetchUserBadges, fetchBadges } from './publicProfileApi'
import type { Pin } from '@/shared/types/database'
import { FACULTIES } from '@/shared/data/campusData'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '@/shared/stores/uiStore'
import { useNavigate } from 'react-router-dom'

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
  const { i18n } = useTranslation()
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
  const pins = pinsQuery.data ?? []
  const loading = profileQuery.isLoading || pinsQuery.isLoading || userBadgesQuery.isLoading || allBadgesQuery.isLoading

  const myFaculty = profile?.faculty_id ? FACULTIES.find((f) => f.id === profile.faculty_id) : null
  const facultyName = myFaculty ? (i18n.language === 'en' ? myFaculty.name_en : myFaculty.name) : null

  const openOnMap = (pin: Pin) => {
    selectPin(pin.id)
    navigate('/mapa')
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Perfil de Usuario"
      contentClassName="flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh] p-0 overflow-x-hidden w-full sm:max-w-2xl overscroll-x-none touch-pan-y bg-white dark:bg-profile-bg"
    >
      <div className="overflow-y-auto flex-1 overflow-x-hidden max-w-full overscroll-x-none touch-pan-y hide-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-6 h-6 border-2 border-[#D41F2D] dark:border-profile-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : profile ? (
          <div className="pb-4 pt-2">
            {/* profiles_public no expone email (ver PROFILE_PUBLIC_FIELDS):
                el handle se deriva del nombre. */}
            <ProfileHeader
              name={profile.name}
              email={null}
              avatarUrl={profile.avatar_url}
              role={profile.role}
            />

            <ProfileStatsLine
              postCount={pins.length}
              karma={profile.karma}
              createdAt={profile.created_at}
            />

            <ProfileFacultyTag
              career={profile.career}
              facultyName={facultyName}
            />

            <ProfileTabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'reports' | 'badges')} hideLeaderboard>
              <Tabs.Content value="reports" className="outline-none">
                <ReportTimeline
                  pins={pins}
                  loading={pinsQuery.isLoading}
                  onViewOnMap={openOnMap}
                />
              </Tabs.Content>

              <Tabs.Content value="badges" className="outline-none">
                <BadgesGrid
                  badges={allBadgesQuery.data ?? []}
                  userBadges={userBadgesQuery.data ?? []}
                  loading={allBadgesQuery.isLoading}
                />
              </Tabs.Content>
            </ProfileTabs>
          </div>
        ) : (
          <div className="py-10 text-center text-neutral-500 font-medium">
            Usuario no encontrado.
          </div>
        )}
      </div>
    </Dialog>
  )
}
