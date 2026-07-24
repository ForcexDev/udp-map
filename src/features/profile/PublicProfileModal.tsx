import { useEffect, useState } from 'react'
import { Dialog } from '@/shared/ui/Dialog'
import { Tabs } from '@/shared/ui/Tabs'
import { ProfileHeader } from './components/ProfileHeader'
import { ProfileStatsLine } from './components/ProfileStatsLine'
import { ProfileFacultyTag } from './components/ProfileFacultyTag'
import { ProfileTabs } from './components/ProfileTabs'
import { ReportTimeline } from './components/ReportTimeline'
import { BadgesGrid } from './components/BadgesGrid'

import { fetchPublicProfile, fetchUserPins, fetchUserBadges, fetchBadges } from './publicProfileApi'
import type { Profile, Pin, UserBadge, Badge } from '@/shared/types/database'
import { FACULTIES } from '@/shared/data/campusData'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '@/shared/stores/uiStore'
import { useNavigate } from 'react-router-dom'

interface PublicProfileModalProps {
  userId: string | null
  onClose: () => void
}

export function PublicProfileModal({ userId, onClose }: PublicProfileModalProps) {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const selectPin = useUIStore((s) => s.selectPin)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [pins, setPins] = useState<Pin[]>([])
  const [userBadges, setUserBadges] = useState<UserBadge[]>([])
  const [allBadges, setAllBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'reports' | 'badges'>('reports')

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setPins([])
      setUserBadges([])
      setAllBadges([])
      setActiveTab('reports')
      return
    }

    let isMounted = true
    setLoading(true)
    
    Promise.all([
      fetchPublicProfile(userId),
      fetchUserPins(userId),
      fetchUserBadges(userId),
      fetchBadges()
    ]).then(([fetchedProfile, fetchedPins, fetchedUserBadges, fetchedAllBadges]) => {
      if (!isMounted) return
      setProfile(fetchedProfile)
      setPins(fetchedPins)
      setUserBadges(fetchedUserBadges)
      setAllBadges(fetchedAllBadges)
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [userId])

  if (!userId) return null

  const myFaculty = profile?.faculty_id ? FACULTIES.find((f) => f.id === profile.faculty_id) : null
  const facultyName = myFaculty ? (i18n.language === 'en' ? myFaculty.name_en : myFaculty.name) : null

  const openOnMap = (pin: Pin) => {
    selectPin(pin.id)
    navigate('/mapa')
    onClose()
  }

  return (
    <Dialog 
      open={!!userId} 
      onOpenChange={(open) => !open && onClose()}
      title="Perfil de Usuario"
      contentClassName="flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh] p-0 overflow-x-hidden w-full sm:max-w-2xl overscroll-x-none touch-pan-y bg-white dark:bg-profile-bg"
    >
      <div className="overflow-y-auto flex-1 ultra-lock-h overflow-x-hidden max-w-full overscroll-x-none touch-pan-y hide-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-6 h-6 border-2 border-[#D41F2D] dark:border-profile-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : profile ? (
          <div className="pb-4 pt-2">
            <ProfileHeader 
              user={profile} 
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
              <Tabs.Content value="reports">
                <ReportTimeline 
                  pins={pins} 
                  loading={loading} 
                  onViewOnMap={openOnMap} 
                />
              </Tabs.Content>
              
              <Tabs.Content value="badges">
                <BadgesGrid 
                  badges={allBadges} 
                  userBadges={userBadges} 
                  loading={loading} 
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
