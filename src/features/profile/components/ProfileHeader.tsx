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

export function ProfileHeader({ name, email, avatarUrl, role, onEditProfile, onAdminPanel }: ProfileHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="px-5 pt-5">
      <div className="flex items-center gap-4">
        <UserAvatar name={name} src={avatarUrl} className="w-[58px] h-[58px] text-[46px]" />
        <div className="min-w-0">
          <p className="text-[18px] font-black tracking-tight text-neutral-900 dark:text-white m-0 truncate">
            {name}
          </p>
          <p className="text-[12.5px] font-semibold text-neutral-400 m-0 mt-0.5 truncate">
            {handleFromEmail(email, name)}
          </p>
          <p className={`mt-1 text-[11px] font-black uppercase tracking-wider ${ROLE_COLORS[role]}`}>
            {t(`profile.roles.${role}`, role)}
          </p>
        </div>
      </div>

      {(onEditProfile || onAdminPanel) && (
        <div className="flex gap-2 mt-4">
          {onEditProfile && (
            <button
              onClick={onEditProfile}
              className="flex-1 px-4 h-9 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-bold text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              {t('profile.editProfile', 'Editar perfil')}
            </button>
          )}
          {role === 'admin' && onAdminPanel && (
            <button
              onClick={onAdminPanel}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 h-9 rounded-full bg-[#D41F2D] text-white text-xs font-bold hover:bg-[#b11a25] transition-colors cursor-pointer"
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
