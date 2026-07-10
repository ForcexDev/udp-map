import { useTranslation } from 'react-i18next'
import { LogIn, LogOut, UserRound } from 'lucide-react'
import { useAuthStore } from './authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { Badge } from '@/shared/ui/Badge'

export function AuthMenu() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const signOut = useAuthStore((s) => s.signOut)
  const openLoginModal = useUIStore((s) => s.openLoginModal)

  if (!user) {
    return (
      <button
        onClick={openLoginModal}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-udp-700 hover:bg-udp-50 dark:text-udp-300 dark:hover:bg-neutral-800"
      >
        <LogIn size={16} />
        {t('auth.signIn')}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full" />
      ) : (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-udp-100 text-udp-700 dark:bg-udp-900 dark:text-udp-200">
          <UserRound size={16} />
        </span>
      )}
      <span className="hidden max-w-32 truncate text-sm sm:block">{user.name}</span>
      {role !== 'student' && <Badge tone="udp">{t(`profile.roles.${role}`)}</Badge>}
      <button
        onClick={() => void signOut()}
        title={t('auth.signOut')}
        aria-label={t('auth.signOut')}
        className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
      >
        <LogOut size={16} />
      </button>
    </div>
  )
}
