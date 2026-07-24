import { UserAvatar } from '@/shared/ui/UserAvatar'
import { handleFromEmail, ROLE_COLORS } from '../utils'
import type { Role } from '@/shared/types/database'
import { ShieldAlert } from 'lucide-react'

interface ProfileHeaderProps {
  name: string | null
  email: string | null
  avatarUrl: string | null
  role: Role
  onEditProfile?: () => void
  onAdminPanel?: () => void
}

export function ProfileHeader({ name, email, avatarUrl, role, onEditProfile, onAdminPanel }: ProfileHeaderProps) {
  return (
    <div className="px-[22px] pt-[22px]">
      <div className="flex items-center gap-4">
        <UserAvatar name={name} src={avatarUrl} className="w-[54px] h-[54px] text-[20px] font-display font-semibold" />
        <div>
          <p className="font-display text-[18px] font-semibold text-neutral-900 dark:text-profile-text m-0 mb-0.5">
            {name}
          </p>
          <p className="font-mono text-[12px] text-neutral-500 dark:text-profile-faint m-0">
            {handleFromEmail(email, name)}
          </p>
          <p className={`mt-1.5 text-[12px] font-medium ${ROLE_COLORS[role]}`}>
            {role === 'guest' ? 'Invitado' : role === 'student' ? 'Estudiante' : role === 'moderator' ? 'Moderador' : 'Admin'}
          </p>
        </div>
      </div>

      {(onEditProfile || onAdminPanel) && (
        <div className="flex gap-[22px] mt-5">
          {onEditProfile && (
            <button
              onClick={onEditProfile}
              className="font-medium text-[13.5px] bg-transparent border-none p-0 cursor-pointer text-neutral-900 dark:text-profile-text font-semibold hover:opacity-80 transition-opacity"
            >
              Editar perfil
            </button>
          )}
          {role === 'admin' && onAdminPanel && (
            <button
              onClick={onAdminPanel}
              className="flex items-center gap-1 font-medium text-[13.5px] bg-transparent border-none p-0 cursor-pointer text-neutral-500 dark:text-profile-muted hover:text-neutral-900 dark:hover:text-profile-text transition-colors"
            >
              Panel admin <ShieldAlert size={14} className="ml-1" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
