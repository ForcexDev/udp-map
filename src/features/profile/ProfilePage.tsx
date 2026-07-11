import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Star, UserRound } from 'lucide-react'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { fetchFavoriteIds, fetchPins } from '@/features/pins/api'
import { PinBadges } from '@/features/pins/PinBadges'


export function ProfilePage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const signOut = useAuthStore((s) => s.signOut)
  const openLoginModal = useUIStore((s) => s.openLoginModal)
  const selectPin = useUIStore((s) => s.selectPin)

  const favorites = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: () => (user ? fetchFavoriteIds(user.id) : Promise.resolve([])),
    enabled: Boolean(user),
  })
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
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <UserRound size={48} className="text-udp-400" aria-hidden />
        <h1 className="text-xl font-semibold">{t('profile.title')}</h1>
        <p className="max-w-sm text-sm text-neutral-500">{t('auth.guestGateBody')}</p>
        <Button onClick={openLoginModal}>{t('auth.signIn')}</Button>
      </div>
    )
  }

  const favoriteIds = new Set(favorites.data ?? [])
  const favoritePins = (allPins.data ?? []).filter((p) => favoriteIds.has(p.id))

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col gap-4 overflow-y-auto p-4">
      <header className="flex items-center gap-3">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-14 w-14 rounded-full" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-full bg-udp-100 text-udp-700 dark:bg-udp-900 dark:text-udp-200">
            <UserRound size={28} />
          </span>
        )}
        <div>
          <h1 className="text-lg font-semibold">{user.name}</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
          <div className="mt-1 flex gap-2">
            <Badge tone="udp">
              {t('profile.role')}: {t(`profile.roles.${role}`)}
            </Badge>
            <Badge>{t('profile.karma')}: 0</Badge>
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Star size={16} className="text-amber-500" /> {t('profile.myFavorites')}
        </h2>
        {favoritePins.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('profile.noFavorites')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {favoritePins.map((pin) => (
              <li key={pin.id}>
                <button
                  onClick={() => selectPin(pin.id)}
                  className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-left hover:border-udp-300 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <p className="mb-1 text-sm font-medium">{pin.title}</p>
                  <PinBadges pin={pin} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button variant="secondary" onClick={() => void signOut()} className="mt-auto">
        {t('auth.signOut')}
      </Button>
    </div>
  )
}
