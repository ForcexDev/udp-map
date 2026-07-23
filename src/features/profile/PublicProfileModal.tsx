import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, ShieldAlert } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import { useAuthStore } from '@/features/auth/authStore'
import { FACULTIES, categoryById } from '@/shared/data/campusData'
import { relativeTime } from '@/shared/utils/datetime'
import { AdminBadge } from './AdminBadge'

function memberSince(dateStr: string | null | undefined, lang: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const s = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CL', {
    month: 'short',
    year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
import { fetchPublicProfile, fetchUserPins, updateUserRole, fetchUserBadges } from './publicProfileApi'
import type { Profile, Pin, Role, UserBadge } from '@/shared/types/database'

interface PublicProfileModalProps {
  userId: string | null
  onClose: () => void
}

const ROLE_COLORS: Record<Role, string> = {
  guest: 'text-neutral-500',
  student: 'text-blue-600',
  moderator: 'text-amber-600',
  admin: 'text-[#D41F2D]',
}

export function PublicProfileModal({ userId, onClose }: PublicProfileModalProps) {
  const { t, i18n } = useTranslation()
  const loggedInRole = useAuthStore((s) => s.role)
  const isAdmin = loggedInRole === 'admin'

  const [profile, setProfile] = useState<Profile | null>(null)
  const [pins, setPins] = useState<Pin[]>([])
  const [badges, setBadges] = useState<UserBadge[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingRole, setUpdatingRole] = useState(false)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setPins([])
      setBadges([])
      return
    }

    let isMounted = true
    setLoading(true)
    
    Promise.all([
      fetchPublicProfile(userId),
      fetchUserPins(userId),
      fetchUserBadges(userId)
    ]).then(([fetchedProfile, fetchedPins, fetchedBadges]) => {
      if (!isMounted) return
      setProfile(fetchedProfile)
      setPins(fetchedPins)
      setBadges(fetchedBadges)
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [userId])

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!profile) return
    const newRole = e.target.value as Role
    if (confirm(`¿Estás seguro de que quieres cambiar el rol de este usuario a ${newRole}?`)) {
      setUpdatingRole(true)
      const success = await updateUserRole(profile.id, newRole)
      if (success) {
        setProfile({ ...profile, role: newRole })
      } else {
        alert('Error al actualizar el rol.')
      }
      setUpdatingRole(false)
    }
  }

  // Si no hay ID, no renderizamos nada
  if (!userId) return null

  const myFaculty = profile?.faculty_id ? FACULTIES.find((f) => f.id === profile.faculty_id) : null

  const datums: { label: string; value: string; className?: string }[] = profile ? [
    { label: t('profile.reports', 'REPORTES'), value: String(pins.length) },
    { label: t('profile.karma', 'KARMA'), value: String(profile.karma), className: 'text-amber-500 font-bold' },
    { label: t('profile.memberSince', 'MIEMBRO DESDE'), value: memberSince(profile.created_at, i18n.language) },
    { label: t('profile.role', 'ROL'), value: t(`profile.roles.${profile.role}`, profile.role), className: ROLE_COLORS[profile.role] },
  ] : []

  if (myFaculty) {
    datums.push({
      label: t('profile.faculty', 'FACULTAD'),
      value: i18n.language === 'en' ? myFaculty.name_en : myFaculty.name,
    })
  }

  const handleFromEmail = (email: string | null | undefined, fallbackName: string | null) => {
    if (email) return '@' + email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_')
    if (fallbackName) return '@' + fallbackName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    return '@usuario'
  }

  return (
    <Dialog 
      open={!!userId} 
      onOpenChange={(open) => !open && onClose()}
      title="Perfil de Usuario"
      contentClassName="flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh] p-4 sm:p-6"
    >
      <div className="overflow-y-auto flex-1 -mx-2 px-2 sm:mx-0 sm:px-0">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="w-6 h-6 border-2 border-[#D41F2D] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : profile ? (
            <>
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 pb-5">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.name || 'User'}
                      className="w-[80px] h-[80px] rounded-full object-cover border border-neutral-200 dark:border-neutral-800 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-[80px] h-[80px] rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 grid place-items-center text-2xl font-bold text-neutral-400 flex-shrink-0">
                      {profile.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[21px] font-bold leading-tight text-neutral-900 dark:text-white break-words">
                      {profile.name || 'Estudiante UDP'}
                    </h2>
                    <p className="font-mono text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                      {handleFromEmail(profile.email, profile.name)}
                    </p>
                  </div>
                </div>
              </div>

              {profile.role === 'admin' && (
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#D41F2D]/20 bg-gradient-to-r from-red-50/90 via-amber-50/60 to-white p-3.5 dark:border-red-400/25 dark:from-red-950/40 dark:via-amber-950/20 dark:to-neutral-900">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D41F2D] text-white shadow-md shadow-red-900/15">
                    <span className="text-lg">★</span>
                  </div>
                  <div className="min-w-0">
                    <AdminBadge />
                    <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                      {t('profile.adminDescription', 'Cuenta oficial de administración de UDP Map')}
                    </p>
                  </div>
                </div>
              )}

              {/* Controles de admin */}
              {isAdmin && (
                <div className="mb-5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[10px] p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    <ShieldAlert size={16} className="text-[#D41F2D]" />
                    Gestión de Rol
                  </div>
                  <CustomSelect
                    options={[
                      { value: 'student', label: 'Estudiante' },
                      { value: 'moderator', label: 'Moderador' },
                      { value: 'admin', label: 'Admin' },
                    ]}
                    value={profile.role}
                    onChange={(val) => {
                      if (!updatingRole) {
                        const syntheticEvent = { target: { value: val } } as React.ChangeEvent<HTMLSelectElement>
                        handleRoleChange(syntheticEvent)
                      }
                    }}
                    className="min-w-[130px]"
                  />
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px rounded-[10px] border border-neutral-200 dark:border-neutral-800 bg-neutral-200 dark:bg-neutral-800 overflow-hidden mb-5">
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

              {/* Badges Section */}
              <div className="mb-5">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400 block mb-2">
                  {t('profile.badges', 'INSIGNIAS')}
                </span>
                {badges.length === 0 ? (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">
                    {t('profile.noBadges', 'Aún no tiene insignias.')}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {badges.map((ub) => {
                      const badge = ub.badge
                      if (!badge) return null
                      const badgeName = i18n.language === 'en' ? badge.name_en : badge.name
                      const badgeDesc = i18n.language === 'en' ? badge.description_en : badge.description
                  return (
                        <div
                          key={badge.id}
                          className="group relative flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-full px-3 py-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                        >
                          <svg
                            viewBox="0 0 32 36"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0"
                          >
                            <path
                              d="M16 1L2 7v10c0 8.3 5.9 16 14 18 8.1-2 14-9.7 14-18V7L16 1z"
                              fill="currentColor"
                              fillOpacity="0.2"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M16 7L8 10.5v6c0 4.15 2.95 8 8 9 5.05-1 8-4.85 8-9v-6L16 7z"
                              fill="currentColor"
                              fillOpacity="0.4"
                            />
                            <path
                              d="M11.5 18l3 3 6-6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <span>{badgeName}</span>
                          
                          {/* Rich Tooltip on Hover */}
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-lg bg-neutral-900 dark:bg-neutral-950 p-2 text-center text-xs font-normal text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 border border-neutral-800">
                            <p className="font-bold text-amber-400">{badgeName}</p>
                            <p className="mt-1 text-[11px] text-neutral-200 leading-snug">{badgeDesc}</p>
                            <div className="absolute top-full left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-neutral-900 dark:bg-neutral-950 border-r border-b border-neutral-800"></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Pins History */}
              <div className="flex items-baseline justify-between mb-2.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
                  {t('profile.history', 'HISTORIAL DE REPORTES')}
                </span>
                <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                  {pins.length} total
                </span>
              </div>

              {pins.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-8 text-center gap-3 rounded-[10px] border border-dashed border-neutral-200 dark:border-neutral-800 mb-6">
                  <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    <MapPin size={24} className="text-neutral-400" />
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">No hay reportes ni pines creados aún.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3 pb-6">
                  {pins.map((pin) => {
                    const category = pin.category_id ? categoryById(pin.category_id) : null
                    const faculty = pin.faculty_id
                      ? FACULTIES.find((f) => f.id === pin.faculty_id)
                      : null
                    const facultyName = faculty
                      ? i18n.language === 'en' ? faculty.name_en : faculty.name
                      : null
                    const { unit, value } = relativeTime(pin.created_at)

                    return (
                      <li key={pin.id} className="relative block overflow-hidden rounded-[14px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <h3 className="text-[15px] font-bold text-neutral-900 dark:text-white">
                            {pin.title}
                          </h3>
                          {category && (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: category.color }}>
                              <span className="text-[11px]">{category.emoji}</span>
                            </div>
                          )}
                        </div>
                        <div className="font-mono text-[10.5px] text-neutral-400 mb-2 truncate">
                          hace {value} {unit} · {facultyName ?? 'Campus'}
                        </div>
                        {pin.description && (
                          <p className="text-sm text-neutral-600 dark:text-neutral-300 line-clamp-2">
                            {pin.description}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : (
            <div className="py-10 text-center text-neutral-500 font-medium">
              Usuario no encontrado.
            </div>
          )}
        </div>
    </Dialog>
  )
}
