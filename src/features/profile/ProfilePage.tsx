import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { UserRound, MapPin, LogOut, Share2 } from 'lucide-react'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui/Button'
import { fetchPins } from '@/features/pins/api'
import { FACULTIES, categoryById } from '@/shared/data/campusData'
import type { Pin } from '@/shared/types/database'
import { EditProfileModal } from './EditProfileModal'
import { PublicProfileModal } from './PublicProfileModal'
import { fetchPublicProfile, fetchUserBadges, fetchBadges, fetchLeaderboard } from './publicProfileApi'
import { relativeTime } from '@/shared/utils/datetime'

const AGO_KEY = { minute: 'agoMinutes', hour: 'agoHours', day: 'agoDays' } as const

function memberSince(dateStr: string | null | undefined, lang: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const s = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CL', {
    month: 'short',
    year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function handleFromEmail(email: string): string {
  return '@' + email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_')
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'text-[#D41F2D]',
  moderator: 'text-blue-600 dark:text-blue-400',
  student: 'text-emerald-600 dark:text-emerald-400',
}

export function ProfilePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const signOut = useAuthStore((s) => s.signOut)
  const openLoginModal = useUIStore((s) => s.openLoginModal)
  const selectPin = useUIStore((s) => s.selectPin)
  const showToast = useUIStore((s) => s.showToast)
  const [editOpen, setEditOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'reports' | 'badges' | 'leaderboard'>('reports')
  const [leaderboardFaculty, setLeaderboardFaculty] = useState<string>('all')
  const [publicProfileId, setPublicProfileId] = useState<string | null>(null)

  const allPins = useQuery({
    queryKey: ['pins', null, ['place', 'event', 'report'], null, null],
    queryFn: () =>
      fetchPins(null, {
        types: ['place', 'event', 'report'],
        categoryId: null,
        facultyId: null,
        onlyFavorites: false,
      }),
    enabled: Boolean(user),
  })

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => user ? fetchPublicProfile(user.id) : null,
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

  if (!user) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
          <UserRound size={40} className="text-neutral-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{t('profile.title')}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t('auth.guestGateBody')}</p>
        </div>
        <Button onClick={openLoginModal} className="mt-2 px-8">{t('auth.signIn')}</Button>
      </div>
    )
  }

  const myPins = (allPins.data ?? []).filter((p) => p.creator_id === user.id)
  const myFaculty = user.faculty_id ? FACULTIES.find((f) => f.id === user.faculty_id) : null

  const openOnMap = (pin: Pin) => {
    selectPin(pin.id)
    navigate('/mapa')
  }

  const sharePin = async (pin: Pin) => {
    const url = `${window.location.origin}/mapa?pin=${pin.id}`
    const text = `${pin.title} — UDP Map`
    try {
      if (navigator.share) {
        await navigator.share({ title: pin.title, text, url })
      } else {
        await navigator.clipboard.writeText(url)
        showToast(t('profile.linkCopied', 'Enlace copiado al portapapeles'))
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        navigator.clipboard.writeText(url)
        showToast(t('profile.linkCopied', 'Enlace copiado al portapapeles'))
      }
    }
  }

  const datums: { label: string; value: string; className?: string }[] = [
    { label: t('profile.reports'), value: String(myPins.length) },
    { label: t('profile.karma', 'Karma'), value: String(profileQuery.data?.karma ?? 0), className: 'text-amber-500 font-bold' },
    { label: t('profile.memberSince'), value: memberSince(user.createdAt, i18n.language) },
    { label: t('profile.role'), value: t(`profile.roles.${role}`), className: ROLE_COLORS[role] },
  ]
  if (myFaculty) {
    datums.push({
      label: t('profile.faculty'),
      value: i18n.language === 'en' ? myFaculty.name_en : myFaculty.name,
    })
  }

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto w-full max-w-xl md:max-w-3xl px-4 pt-safe">

        {/* ── Barra superior ── */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pt-4 pb-3 md:pt-6">
          <h1 className="text-[15px] font-semibold tracking-wide text-neutral-900 dark:text-white">
            {t('profile.title')}
          </h1>
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            <LogOut size={14} />
            {t('auth.signOut')}
          </button>
        </div>

        {/* ── Perfil ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 py-5">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-[64px] h-[64px] sm:w-[80px] sm:h-[80px] rounded-full object-cover border border-neutral-200 dark:border-neutral-800 flex-shrink-0"
              />
            ) : (
              <div className="w-[64px] h-[64px] sm:w-[80px] sm:h-[80px] rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 grid place-items-center text-2xl font-bold text-neutral-400 flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-[21px] font-bold leading-tight text-neutral-900 dark:text-white break-words">
                {user.name}
              </h2>
              <p className="font-mono text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                {handleFromEmail(user.email)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="w-full sm:w-auto flex-shrink-0 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-semibold text-[13px] px-3.5 py-2 rounded-[10px] hover:border-[#D41F2D] transition-colors"
          >
            {t('profile.editProfile')}
          </button>
        </div>

        {/* ── Datos de cuenta ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-px rounded-[10px] border border-neutral-200 dark:border-neutral-800 bg-neutral-200 dark:bg-neutral-800 overflow-hidden mb-5">
          {datums.map((d) => (
            <div key={d.label} className="bg-white dark:bg-neutral-900 px-3.5 py-3 min-w-0">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
                {d.label}
              </div>
              <div
                className={`text-[15px] font-semibold mt-1 ${d.className ?? 'text-neutral-900 dark:text-white'}`}
                title={d.value}
              >
                {d.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Pestañas de Perfil ── */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-6 bg-white dark:bg-neutral-900 rounded-[10px] overflow-hidden p-1 gap-1">
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-2 text-center text-xs sm:text-sm font-bold rounded-[8px] transition-colors ${
              activeTab === 'reports'
                ? 'bg-[#D41F2D] text-white'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            {t('profile.tabs.reports', 'Reportes')}
          </button>
          <button
            onClick={() => setActiveTab('badges')}
            className={`flex-1 py-2 text-center text-xs sm:text-sm font-bold rounded-[8px] transition-colors ${
              activeTab === 'badges'
                ? 'bg-[#D41F2D] text-white'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            {t('profile.tabs.badges', 'Insignias')}
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-2 text-center text-xs sm:text-sm font-bold rounded-[8px] transition-colors ${
              activeTab === 'leaderboard'
                ? 'bg-[#D41F2D] text-white'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            {t('profile.tabs.leaderboard', 'Clasificación')}
          </button>
        </div>

        {/* ── Contenido de Pestañas ── */}
        {activeTab === 'reports' && (
          <>
            <div className="flex items-baseline justify-between mb-2.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
                {t('profile.history')}
              </span>
              <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                {t('profile.total', { n: myPins.length })}
              </span>
            </div>

            {allPins.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-[#D41F2D] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : myPins.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-3 rounded-[10px] border border-dashed border-neutral-200 dark:border-neutral-800 mb-6">
                <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                  <MapPin size={24} className="text-neutral-400" />
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('profile.noReports')}</p>
              </div>
            ) : (
              <ul className="grid gap-3.5 md:grid-cols-2 pb-6">
                {myPins.map((pin) => {
                  const category = pin.category_id ? categoryById(pin.category_id) : null
                  const faculty = pin.faculty_id
                    ? FACULTIES.find((f) => f.id === pin.faculty_id)
                    : null
                  const facultyName = faculty
                    ? i18n.language === 'en' ? faculty.name_en : faculty.name
                    : null
                  const photo = pin.pin_photos?.[0]

                  return (
                    <li key={pin.id}>
                      <article className="rounded-[10px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden h-full flex flex-col">
                        {/* Cabecera */}
                        <div className="flex items-start gap-2.5 px-3.5 pt-3.5">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[15px] font-bold text-neutral-900 dark:text-white break-words">
                              {pin.title}
                            </h3>
                            <p className="font-mono text-[11.5px] text-neutral-500 dark:text-neutral-400 mt-0.5 break-words">
                              {(() => { const rel = relativeTime(pin.created_at); return t(`time.${AGO_KEY[rel.unit]}`, { n: rel.value }) })()}
                              {facultyName ? ` · ${facultyName}` : ''}
                            </p>
                          </div>
                          {category && (
                            <span
                              className="flex-shrink-0 mt-1 w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: category.color }}
                              title={category.name}
                            />
                          )}
                        </div>

                        {/* Descripción */}
                        {pin.description && (
                          <p className="px-3.5 pt-2 pb-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 line-clamp-3">
                            {pin.description}
                          </p>
                        )}

                        {/* Foto / ubicación */}
                        <div className="relative mt-auto border-y border-neutral-200 dark:border-neutral-800 h-40 bg-neutral-100 dark:bg-neutral-800">
                          {photo ? (
                            <img src={photo.url} alt={pin.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full grid place-items-center">
                              <MapPin size={22} className="text-neutral-300 dark:text-neutral-600" />
                            </div>
                          )}
                          {facultyName && (
                            <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 bg-neutral-950/85 text-white text-xs font-semibold px-2.5 py-1.5 rounded-[10px] max-w-[85%]">
                              <MapPin size={11} className="flex-shrink-0" />
                              <span className="truncate min-w-0">{facultyName}</span>
                            </span>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex px-3.5">
                          <button
                            onClick={() => openOnMap(pin)}
                            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 hover:text-[#D41F2D] transition-colors py-3 pr-4"
                          >
                            <MapPin size={14} />
                            {t('profile.viewOnMap')}
                          </button>
                          <button
                            onClick={() => void sharePin(pin)}
                            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 hover:text-[#D41F2D] transition-colors py-3 pr-4"
                          >
                            <Share2 size={14} />
                            {t('profile.share')}
                          </button>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}

        {activeTab === 'badges' && (
          <div className="pb-6">
            <div className="mb-4">
              <h2 className="text-[17px] font-bold text-neutral-900 dark:text-white">
                {t('profile.badges', 'Insignias')}
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                {t('profile.badgesDesc', 'Logros y reconocimientos en la comunidad')}
              </p>
            </div>

            {allBadgesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#D41F2D] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {[...(allBadgesQuery.data ?? [])]
                  .sort((a, b) => {
                    const aUnlocked = badgesQuery.data?.some((ub) => ub.badge_id === a.id) ? 1 : 0
                    const bUnlocked = badgesQuery.data?.some((ub) => ub.badge_id === b.id) ? 1 : 0
                    return bUnlocked - aUnlocked
                  })
                  .map((badge) => {
                    const unlockedBadge = badgesQuery.data?.find((ub) => ub.badge_id === badge.id)
                    const isUnlocked = !!unlockedBadge
                    const badgeName = i18n.language === 'en' ? badge.name_en : badge.name
                    const badgeDesc = i18n.language === 'en' ? badge.description_en : badge.description

                    return (
                      <div
                        key={badge.id}
                        className={`relative flex items-start gap-3.5 p-4 rounded-[14px] border transition-all ${
                          isUnlocked
                            ? 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm'
                            : 'bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 opacity-40'
                        }`}
                      >
                      {/* Shield SVG emblem */}
                      <div
                        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                          isUnlocked
                            ? 'bg-amber-100 dark:bg-amber-950/40'
                            : 'bg-neutral-200/80 dark:bg-neutral-800'
                        }`}
                      >
                        <svg
                          viewBox="0 0 32 36"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className={`w-7 h-7 ${
                            isUnlocked
                              ? 'text-amber-600 dark:text-amber-500'
                              : 'text-neutral-400 dark:text-neutral-600'
                          }`}
                        >
                          <path
                            d="M16 1L2 7v10c0 8.3 5.9 16 14 18 8.1-2 14-9.7 14-18V7L16 1z"
                            fill="currentColor"
                            fillOpacity={isUnlocked ? 0.18 : 0.1}
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M16 7L8 10.5v6c0 4.15 2.95 8 8 9 5.05-1 8-4.85 8-9v-6L16 7z"
                            fill="currentColor"
                            fillOpacity={isUnlocked ? 0.35 : 0.15}
                          />
                          {isUnlocked && (
                            <path
                              d="M11.5 18l3 3 6-6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                        </svg>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className={`text-sm font-bold ${isUnlocked ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-500'}`}>
                            {badgeName}
                          </h3>
                          {isUnlocked && (
                            <span className="inline-block px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              Obtenida
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-snug">
                          {badgeDesc}
                        </p>
                        {isUnlocked && unlockedBadge.awarded_at && (
                          <p className="mt-2 text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                            {t('profile.unlockedAt', 'Desbloqueada el')}: {new Date(unlockedBadge.awarded_at).toLocaleDateString(i18n.language)}
                          </p>
                        )}
                        {!isUnlocked && (
                          <p className="mt-2 text-[10px] font-medium text-neutral-400 dark:text-neutral-500 italic">
                            {t('profile.lockedDesc', 'Requisitos pendientes')}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-[17px] font-bold text-neutral-900 dark:text-white">
                  {t('profile.leaderboard', 'Clasificación')}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {t('profile.leaderboardDesc', 'Estudiantes más activos por Karma')}
                </p>
              </div>

              {/* Selector de Facultad / Global */}
              <select
                value={leaderboardFaculty}
                onChange={(e) => setLeaderboardFaculty(e.target.value)}
                className="p-2 text-xs sm:text-sm font-semibold rounded-[10px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white outline-none focus:border-[#D41F2D] transition-colors"
              >
                <option value="all">{t('profile.globalLeaderboard', 'Clasificación Global')}</option>
                {FACULTIES.filter(f => f.id !== 'deportes' && f.id !== 'dti' && f.id !== 'biblioteca').map((f) => (
                  <option key={f.id} value={f.id}>
                    {i18n.language === 'en' ? f.name_en : f.name}
                  </option>
                ))}
              </select>
            </div>

            {leaderboardQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#D41F2D] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-hidden rounded-[14px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                      <th className="px-4 py-3 text-center w-10">#</th>
                      <th className="px-4 py-3">{t('profile.user', 'Usuario')}</th>
                      <th className="px-4 py-3 text-right pr-6">{t('profile.karma', 'Karma')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardQuery.data?.map((profile, idx) => {
                      const isMe = profile.id === user.id
                      const rank = idx + 1
                      const medalClass =
                        rank === 1 ? 'text-amber-400' :
                        rank === 2 ? 'text-neutral-400' :
                        rank === 3 ? 'text-amber-700' : 'text-neutral-400 dark:text-neutral-500'

                      return (
                        <tr
                          key={profile.id}
                          className={`border-b border-neutral-100 dark:border-neutral-850 last:border-0 transition-colors text-sm ${
                            isMe
                              ? 'bg-red-50/50 dark:bg-red-950/20 font-bold'
                              : 'hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30'
                          }`}
                        >
                          <td className={`px-4 py-3.5 text-center font-bold font-mono text-sm ${medalClass}`}>
                            {rank}
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => setPublicProfileId(profile.id)}
                              className="flex items-center gap-2.5 text-left hover:underline"
                            >
                              {profile.avatar_url ? (
                                <img
                                  src={profile.avatar_url}
                                  alt={profile.name || 'User'}
                                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-bold text-neutral-400 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 flex-shrink-0">
                                  {(profile.name || 'U').charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="truncate max-w-[140px] sm:max-w-none">
                                {profile.name || 'Estudiante UDP'}
                              </span>
                              {isMe && (
                                <span className="text-[10px] bg-red-100 dark:bg-red-950 text-[#D41F2D] font-mono px-1 rounded-md uppercase">
                                  Tú
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-right pr-6 font-mono font-bold text-amber-500">
                            {profile.karma}
                          </td>
                        </tr>
                      )
                    })}
                    {(!leaderboardQuery.data || leaderboardQuery.data.length === 0) && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-xs text-neutral-400 italic">
                          {t('profile.leaderboardEmpty', 'No hay usuarios registrados en esta clasificación.')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <EditProfileModal open={editOpen} onOpenChange={setEditOpen} />
      <PublicProfileModal userId={publicProfileId} onClose={() => setPublicProfileId(null)} />
    </div>
  )
}
