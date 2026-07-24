import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import type { Pin } from '@/shared/types/database'

import { GuestGate } from '../components/GuestGate'
import { ProfileHeader } from '../components/ProfileHeader'
import { ProfileStatsLine } from '../components/ProfileStatsLine'
import { ProfileFacultyTag } from '../components/ProfileFacultyTag'
import { ProfileTabs } from '../components/ProfileTabs'
import { ReportTimeline } from '../components/ReportTimeline'
import { BadgesGrid } from '../components/BadgesGrid'
import { LeaderboardTable } from '../components/LeaderboardTable'

import * as Tabs from '@radix-ui/react-tabs'
import { EditProfileModal } from '../EditProfileModal'
import { PublicProfileModal } from '../PublicProfileModal'
import { fetchPublicProfile, fetchUserPins, fetchUserBadges, fetchBadges, fetchLeaderboard } from '../publicProfileApi'
import { FACULTIES } from '@/shared/data/campusData'

export function ProfilePage() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const signOut = useAuthStore((s) => s.signOut)
  const selectPin = useUIStore((s) => s.selectPin)

  const [editOpen, setEditOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'reports' | 'badges' | 'leaderboard'>(() =>
    searchParams.get('tab') === 'badges' ? 'badges' : searchParams.get('tab') === 'leaderboard' ? 'leaderboard' : 'reports',
  )
  const [leaderboardFaculty, setLeaderboardFaculty] = useState<string>('all')
  const [publicProfileId, setPublicProfileId] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => user ? fetchPublicProfile(user.id) : null,
    enabled: Boolean(user),
  })

  const pinsQuery = useQuery({
    queryKey: ['user-pins', user?.id],
    queryFn: () => fetchUserPins(user!.id),
    enabled: Boolean(user),
  })

  const badgesQuery = useQuery({
    queryKey: ['user-badges', user?.id],
    queryFn: () => user ? fetchUserBadges(user.id) : [],
    enabled: Boolean(user),
  })

  const allBadgesQuery = useQuery({
    queryKey: ['badges'],
    queryFn: () => fetchBadges(),
  })

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', leaderboardFaculty],
    queryFn: () => fetchLeaderboard(leaderboardFaculty === 'all' ? undefined : leaderboardFaculty),
    enabled: Boolean(user),
  })

  useEffect(() => {
    if (user?.faculty_id) {
      setLeaderboardFaculty(user.faculty_id)
    }
  }, [user?.faculty_id])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'badges' || tab === 'leaderboard' || tab === 'reports') setActiveTab(tab as 'reports' | 'badges' | 'leaderboard')
  }, [searchParams])

  const handleTabChange = (val: string) => {
    setActiveTab(val as 'reports' | 'badges' | 'leaderboard')
    setSearchParams({ tab: val }, { replace: true })
  }

  if (!user) {
    return <GuestGate />
  }

  const myFaculty = user.faculty_id ? FACULTIES.find((f) => f.id === user.faculty_id) : null
  const facultyName = myFaculty ? (i18n.language === 'en' ? myFaculty.name_en : myFaculty.name) : null

  const openOnMap = (pin: Pin) => {
    selectPin(pin.id)
    navigate('/mapa')
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden max-w-full w-full overscroll-x-none touch-pan-y bg-white dark:bg-profile-bg">
      <div className="mx-auto w-full max-w-2xl min-h-full bg-white dark:bg-profile-bg pt-safe overflow-x-hidden">
        
        {/* Topbar */}
        <div className="flex items-center justify-between px-[22px] py-2.5">
          <h1 className="font-display text-[21px] font-semibold tracking-[-0.01em] text-neutral-900 dark:text-profile-text m-0">
            Perfil
          </h1>
          <button
            onClick={() => void signOut()}
            className="font-display text-[13px] font-semibold text-neutral-500 dark:text-profile-muted hover:text-neutral-900 dark:hover:text-profile-text bg-transparent border-none p-0 cursor-pointer transition-colors"
          >
            Cerrar sesión
          </button>
        </div>

        <ProfileHeader
          name={user.name}
          email={user.email}
          avatarUrl={user.avatarUrl}
          role={role}
          onEditProfile={() => setEditOpen(true)}
          onAdminPanel={() => navigate('/admin')}
        />
        
        <ProfileStatsLine 
          postCount={pinsQuery.data?.length ?? 0} 
          karma={profileQuery.data?.karma ?? 0} 
          createdAt={user.createdAt} 
        />
        
        <ProfileFacultyTag 
          career={user.career} 
          facultyName={facultyName} 
        />

        <ProfileTabs value={activeTab} onValueChange={handleTabChange}>
          <Tabs.Content value="reports" className="outline-none">
            <ReportTimeline 
              pins={pinsQuery.data ?? []} 
              loading={pinsQuery.isLoading} 
              onViewOnMap={openOnMap} 
            />
          </Tabs.Content>
          
          <Tabs.Content value="badges" className="outline-none">
            <BadgesGrid 
              badges={allBadgesQuery.data ?? []} 
              userBadges={badgesQuery.data ?? []} 
              loading={allBadgesQuery.isLoading} 
            />
          </Tabs.Content>
          
          <Tabs.Content value="leaderboard" className="outline-none">
            <LeaderboardTable 
              data={leaderboardQuery.data} 
              currentUserId={user.id} 
              loading={leaderboardQuery.isLoading}
              faculty={leaderboardFaculty}
              onFacultyChange={setLeaderboardFaculty}
              onViewProfile={setPublicProfileId}
            />
          </Tabs.Content>
        </ProfileTabs>

      </div>

      <EditProfileModal open={editOpen} onOpenChange={setEditOpen} />
      <PublicProfileModal userId={publicProfileId} onClose={() => setPublicProfileId(null)} />
    </div>
  )
}
