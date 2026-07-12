import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, ShieldAlert } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { useAuthStore } from '@/features/auth/authStore'
import { FACULTIES, categoryById } from '@/shared/data/campusData'
import { relativeTime } from '@/shared/utils/datetime'

function memberSince(dateStr: string | null | undefined, lang: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const s = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CL', {
    month: 'short',
    year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
import { fetchPublicProfile, fetchUserPins, updateUserRole } from './publicProfileApi'
import type { Profile, Pin, Role } from '@/shared/types/database'

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
  const [loading, setLoading] = useState(false)
  const [updatingRole, setUpdatingRole] = useState(false)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setPins([])
      return
    }

    let isMounted = true
    setLoading(true)
    
    Promise.all([
      fetchPublicProfile(userId),
      fetchUserPins(userId)
    ]).then(([fetchedProfile, fetchedPins]) => {
      if (!isMounted) return
      setProfile(fetchedProfile)
      setPins(fetchedPins)
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
    { label: t('profile.memberSince', 'MIEMBRO DESDE'), value: memberSince(profile.created_at, i18n.language) },
    { label: t('profile.role', 'ROL'), value: t(`profile.roles.${profile.role}`, profile.role), className: ROLE_COLORS[profile.role] },
  ] : []

  if (myFaculty) {
    datums.push({
      label: t('profile.faculty', 'FACULTAD'),
      value: i18n.language === 'en' ? myFaculty.name_en : myFaculty.name,
    })
  }

  const handleFromEmail = (email: string) => {
    return '@' + email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_')
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
                      {handleFromEmail(profile.email)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Controles de admin */}
              {isAdmin && (
                <div className="mb-5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[10px] p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    <ShieldAlert size={16} className="text-[#D41F2D]" />
                    Gestión de Rol
                  </div>
                  <select
                    value={profile.role}
                    onChange={handleRoleChange}
                    disabled={updatingRole}
                    className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-semibold rounded-lg px-2 py-1 outline-none disabled:opacity-50"
                  >
                    <option value="student">Estudiante</option>
                    <option value="moderator">Moderador</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-px rounded-[10px] border border-neutral-200 dark:border-neutral-800 bg-neutral-200 dark:bg-neutral-800 overflow-hidden mb-5">
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
