import { useState } from 'react'
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

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  const days = Math.floor(diff / 86400)
  if (days < 365) return days === 1 ? 'hace 1 día' : `hace ${days} días`
  const years = Math.floor(days / 365)
  return years === 1 ? 'hace 1 año' : `hace ${years} años`
}

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
  const myFaculty = user.faculty_id ? FACULTIES.find((f) => f.id === user.faculty_id) : null

  const openOnMap = (pin: Pin) => {
    selectPin(pin.id)
    navigate('/mapa')
  }

  const sharePin = async (pin: Pin) => {
    const url = window.location.origin
    const text = `${pin.title} — UDP Map`
    try {
      if (navigator.share) {
        await navigator.share({ title: pin.title, text, url })
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        showToast(t('profile.linkCopied'))
      }
    } catch {
      // Compartir cancelado por el usuario
    }
  }

  const datums: { label: string; value: string; className?: string }[] = [
    { label: t('profile.reports'), value: String(myPins.length) },
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
      <div className="mx-auto w-full max-w-xl md:max-w-3xl px-4">

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-[10px] border border-neutral-200 dark:border-neutral-800 bg-neutral-200 dark:bg-neutral-800 overflow-hidden mb-5">
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

        {/* ── Historial de reportes ── */}
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
                          {timeAgo(pin.created_at)}
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
      </div>

      <EditProfileModal open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}
