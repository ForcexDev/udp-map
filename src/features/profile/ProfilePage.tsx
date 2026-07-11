import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { UserRound, Calendar, ThumbsUp, MapPin, MoreHorizontal } from 'lucide-react'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { Button } from '@/shared/ui/Button'
import { fetchPins } from '@/features/pins/api'
import { FACULTIES, categoryById } from '@/shared/data/campusData'

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  const days = Math.floor(diff / 86400)
  if (days < 365) return `hace ${days} días`
  return `hace ${Math.floor(days / 365)} años`
}

function memberSince(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
}

function handleFromEmail(email: string): string {
  return '@' + email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_')
}

export function ProfilePage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const signOut = useAuthStore((s) => s.signOut)
  const openLoginModal = useUIStore((s) => s.openLoginModal)
  const selectPin = useUIStore((s) => s.selectPin)

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

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white dark:bg-neutral-950">

      {/* ── Header ── */}
      <div className="px-4 pt-6 pb-4">
        {/* Avatar + Name row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-shrink-0">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center">
                <UserRound size={32} className="text-neutral-500 dark:text-neutral-400" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white leading-tight truncate">
              {user.name}
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
              {handleFromEmail(user.email)}
            </p>
            <span className={`inline-block mt-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
              role === 'admin'
                ? 'bg-[#D41F2D]/10 text-[#D41F2D]'
                : role === 'moderator'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : role === 'student'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
            }`}>
              {t(`profile.roles.${role}`)}
            </span>
          </div>
        </div>

        {/* Edit Profile button */}
        <button
          className="w-full py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors uppercase tracking-wide"
          onClick={() => {/* TODO: open edit profile */}}
        >
          Editar perfil
        </button>

        {/* Meta info */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            <Calendar size={14} className="flex-shrink-0" />
            <span>Miembro desde {memberSince(new Date().toISOString())}</span>
          </div>
        </div>


        <div className="mt-1.5">
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">{myPins.length}</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400 ml-1">
            {myPins.length === 1 ? 'Reporte' : 'Reportes'}
          </span>
        </div>
      </div>

      {/* ── Tabs / Section header ── */}
      <div className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex">
          <button className="flex-1 py-3 text-sm font-bold text-[#D41F2D] border-b-2 border-[#D41F2D]">
            Reportes
          </button>
        </div>
      </div>

      {/* ── Pin list ── */}
      <div className="flex-1">
        {allPins.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#D41F2D] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : myPins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <MapPin size={24} className="text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Aún no has creado ningún reporte.
            </p>
          </div>
        ) : (
          <ul>
            {myPins.map((pin) => {
              const category = pin.category_id ? categoryById(pin.category_id) : null
              const faculty = pin.faculty_id ? FACULTIES.find((f) => f.id === pin.faculty_id) : null
              const photo = pin.pin_photos?.[0]

              return (
                <li key={pin.id} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                  <button
                    onClick={() => selectPin(pin.id)}
                    className="w-full text-left px-4 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors active:bg-neutral-100 dark:active:bg-neutral-800"
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: category?.color ?? '#64748b' }}
                      >
                        <ThumbsUp size={18} className="text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-neutral-900 dark:text-white leading-snug">
                              {pin.title}
                            </span>
                            {' '}
                            <span className="text-neutral-400 dark:text-neutral-500 text-xs">
                              · {timeAgo(pin.created_at)}
                            </span>
                          </div>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0 p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-full"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </div>

                        {pin.description && (
                          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300 line-clamp-2 leading-snug">
                            {pin.description}
                          </p>
                        )}

                        {/* Map thumbnail */}
                        {photo ? (
                          <div className="mt-2.5 rounded-xl overflow-hidden border border-neutral-100 dark:border-neutral-800">
                            <img
                              src={photo.url}
                              alt={pin.title}
                              className="w-full h-36 object-cover"
                            />
                          </div>
                        ) : (
                          <div className="mt-2.5 rounded-xl overflow-hidden border border-neutral-100 dark:border-neutral-800 h-28 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                            <MapPin size={20} className="text-neutral-300 dark:text-neutral-600" />
                          </div>
                        )}

                        {/* Location */}
                        {faculty && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                            <MapPin size={11} className="flex-shrink-0" />
                            <span>{faculty.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Footer: role badge + sign out ── */}
      <div className="px-4 py-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#D41F2D]/10 text-[#D41F2D] uppercase tracking-wide">
            {t(`profile.roles.${role}`)}
          </span>
        </div>
        <button
          onClick={() => void signOut()}
          className="text-sm font-medium text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        >
          {t('auth.signOut')}
        </button>
      </div>
    </div>
  )
}
