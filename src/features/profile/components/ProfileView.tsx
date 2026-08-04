import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import * as Tabs from '@radix-ui/react-tabs'

import { ProfileHeader } from './ProfileHeader'
import { ProfileStatsLine } from './ProfileStatsLine'
import { ProfileFacultyTag } from './ProfileFacultyTag'
import { ProfileTabs } from './ProfileTabs'
import { ReportTimeline } from './ReportTimeline'
import { BadgesGrid } from './BadgesGrid'

import { FACULTIES } from '@/shared/data/campusData'
import type { Badge, Pin, Role, UserBadge } from '@/shared/types/database'

interface ProfileViewProps {
  name: string | null
  /** null en perfiles ajenos: profiles_public no expone el correo. */
  email: string | null
  avatarUrl: string | null
  role: Role
  karma: number
  createdAt: string | null | undefined
  career: string | null | undefined
  facultyId: string | null | undefined

  pins: Pin[]
  pinsLoading: boolean
  badges: Badge[]
  userBadges: UserBadge[]
  badgesLoading: boolean

  activeTab: string
  onTabChange: (value: string) => void
  onViewOnMap: (pin: Pin) => void

  /** Solo en el perfil propio. */
  onEditProfile?: () => void
  onAdminPanel?: () => void
  /** Pestaña de clasificación; ausente en perfiles ajenos. */
  leaderboard?: ReactNode
}

/**
 * Cuerpo del perfil, idéntico para el perfil propio (ProfilePage) y el de otra
 * persona (PublicProfileModal). Antes cada uno recomponía las mismas piezas por
 * su cuenta y se iban desincronizando.
 */
export function ProfileView({
  name,
  email,
  avatarUrl,
  role,
  karma,
  createdAt,
  career,
  facultyId,
  pins,
  pinsLoading,
  badges,
  userBadges,
  badgesLoading,
  activeTab,
  onTabChange,
  onViewOnMap,
  onEditProfile,
  onAdminPanel,
  leaderboard,
}: ProfileViewProps) {
  const { i18n } = useTranslation()

  const faculty = facultyId ? FACULTIES.find((f) => f.id === facultyId) : null
  const facultyName = faculty ? (i18n.language === 'en' ? faculty.name_en : faculty.name) : null

  return (
    <>
      <ProfileHeader
        name={name}
        email={email}
        avatarUrl={avatarUrl}
        role={role}
        onEditProfile={onEditProfile}
        onAdminPanel={onAdminPanel}
      />

      <ProfileStatsLine postCount={pins.length} karma={karma} createdAt={createdAt} />

      <ProfileFacultyTag career={career} facultyName={facultyName} />

      <ProfileTabs value={activeTab} onValueChange={onTabChange} hideLeaderboard={!leaderboard}>
        <Tabs.Content value="reports" className="outline-none">
          <ReportTimeline pins={pins} loading={pinsLoading} onViewOnMap={onViewOnMap} />
        </Tabs.Content>

        <Tabs.Content value="badges" className="outline-none">
          <BadgesGrid badges={badges} userBadges={userBadges} loading={badgesLoading} />
        </Tabs.Content>

        {leaderboard && (
          <Tabs.Content value="leaderboard" className="outline-none">
            {leaderboard}
          </Tabs.Content>
        )}
      </ProfileTabs>
    </>
  )
}
