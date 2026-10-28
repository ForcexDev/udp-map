import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import { UserAvatar } from '@/shared/ui/UserAvatar'
import { handleFromEmail, ROLE_COLORS } from '../utils'
import type { Role } from '@/shared/types/database'

interface ProfileHeaderProps {
  name: string | null
  email: string | null
  avatarUrl: string | null
  role: Role
  onEditProfile?: () => void
  onAdminPanel?: () => void
}

export function ProfileHeader({
  name,
  email,
  avatarUrl,
  role,
  onEditProfile,
  onAdminPanel,
}: ProfileHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="px-5 pt-5">
      <div className="flex items-center gap-4">
        <UserAvatar name={name} src={avatarUrl} className="w-[58px] h-[58px] text-[46px]" />
        <div className="min-w-0">
          <p className="m-0 truncate text-[18px] font-bold tracking-tight text-stone-900 dark:text-stone-100">
            {name}
          </p>
          <p className="m-0 mt-0.5 truncate text-xs font-medium text-stone-500 dark:text-stone-400">
            {handleFromEmail(email, name)}
          </p>
          <p className={`mt-1 text-xs font-semibold ${ROLE_COLORS[role]}`}>
            {t(`profile.roles.${role}`, role)}
          </p>
        </div>
      </div>

      {(onEditProfile || onAdminPanel) && (
        <div className="mt-4 flex gap-2">
          {onEditProfile && (
            <button
              onClick={onEditProfile}
              className="flex-1 cursor-pointer rounded-2xl border border-[#E6E0D5] bg-white px-4 h-9 text-xs font-semibold text-stone-900 shadow-xs transition-all hover:bg-[#FAF8F5] dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-100 dark:hover:bg-white/[0.04]"
            >
              {t('profile.editProfile', 'Editar perfil')}
            </button>
          )}
          {role === 'admin' && onAdminPanel && (
            <button
              onClick={onAdminPanel}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-[#C22B38] px-4 h-9 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#a8242f] dark:bg-[#D93846] dark:hover:bg-[#c22b38]"
            >
              <ShieldAlert size={14} />
              Panel admin
            </button>
          )}
        </div>
      )}
    </div>
  )
}
