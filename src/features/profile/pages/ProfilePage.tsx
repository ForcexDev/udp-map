import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { useMyEvents } from '@/features/events/useEvents'
import { MyEventsList } from '../components/MyEventsList'
import type { Pin } from '@/shared/types/database'

import { GuestGate } from '../components/GuestGate'
import { ProfileView } from '../components/ProfileView'
import { LeaderboardTable } from '../components/LeaderboardTable'

import { EditProfileModal } from '../EditProfileModal'
import { PublicProfileModal } from '../PublicProfileModal'
import {
  fetchPublicProfile,
  fetchUserPins,
  fetchUserBadges,
  fetchBadges,
  fetchLeaderboard,
} from '../publicProfileApi'

export function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const signOut = useAuthStore((s) => s.signOut)
  const selectPin = useUIStore((s) => s.selectPin)

  const [editOpen, setEditOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'reports' | 'badges' | 'events' | 'leaderboard'>(() =>
    searchParams.get('tab') === 'badges'
      ? 'badges'
      : searchParams.get('tab') === 'events'
        ? 'events'
        : searchParams.get('tab') === 'leaderboard'
          ? 'leaderboard'
          : 'reports',
  )
  const [leaderboardFaculty, setLeaderboardFaculty] = useState<string>('all')
  const myEvents = useMyEvents()
  const [publicProfileId, setPublicProfileId] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => (user ? fetchPublicProfile(user.id) : null),
    enabled: Boolean(user),
  })

  const pinsQuery = useQuery({
    queryKey: ['user-pins', user?.id],
    queryFn: () => fetchUserPins(user!.id),
    enabled: Boolean(user),
  })

  const badgesQuery = useQuery({
    queryKey: ['user-badges', user?.id],
    queryFn: () => (user ? fetchUserBadges(user.id) : []),
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
    if (tab === 'badges' || tab === 'leaderboard' || tab === 'reports' || tab === 'events')
      setActiveTab(tab as 'reports' | 'badges' | 'events' | 'leaderboard')
  }, [searchParams])

  const handleTabChange = (val: string) => {
    setActiveTab(val as 'reports' | 'badges' | 'events' | 'leaderboard')
    setSearchParams({ tab: val }, { replace: true })
  }

  if (!user) {
    return <GuestGate />
  }

  const openOnMap = (pin: Pin) => {
    selectPin(pin.id)
    navigate('/mapa')
  }

  return (
    <div className="h-full w-full max-w-full overflow-x-hidden overflow-y-auto overscroll-x-none bg-[#FAF8F5] touch-pan-y dark:bg-[#151820]">
      <div className="mx-auto min-h-full w-full max-w-2xl overflow-x-hidden pt-safe pb-16">
        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <h1 className="m-0 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            {t('profile.title', 'Perfil')}
          </h1>
          <button
            onClick={() => void signOut()}
            className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-stone-500 transition-colors hover:text-[#C22B38] dark:text-stone-400 dark:hover:text-[#D93846]"
          >
            {t('auth.signOut', 'Cerrar sesión')}
          </button>
        </div>

        <ProfileView
          name={user.name}
          email={user.email}
          avatarUrl={user.avatarUrl}
          role={role}
          karma={profileQuery.data?.karma ?? 0}
          createdAt={user.createdAt}
          career={user.career}
          facultyId={user.faculty_id}
          pins={pinsQuery.data ?? []}
          pinsLoading={pinsQuery.isLoading}
          badges={allBadgesQuery.data ?? []}
          userBadges={badgesQuery.data ?? []}
          badgesLoading={allBadgesQuery.isLoading}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onViewOnMap={openOnMap}
          onEditProfile={() => setEditOpen(true)}
          onAdminPanel={() => navigate('/admin')}
          myEvents={
            <MyEventsList
              events={myEvents.events}
              loading={myEvents.isLoading}
              onViewOnMap={(pin) => openOnMap(pin)}
            />
          }
          leaderboard={
            <LeaderboardTable
              data={leaderboardQuery.data}
              currentUserId={user.id}
              loading={leaderboardQuery.isLoading}
              faculty={leaderboardFaculty}
              onFacultyChange={setLeaderboardFaculty}
              onViewProfile={setPublicProfileId}
            />
          }
        />
      </div>

      <EditProfileModal open={editOpen} onOpenChange={setEditOpen} />
      <PublicProfileModal userId={publicProfileId} onClose={() => setPublicProfileId(null)} />
    </div>
  )
}
