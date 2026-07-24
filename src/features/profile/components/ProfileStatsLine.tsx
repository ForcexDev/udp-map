import { useTranslation } from 'react-i18next'
import { memberSince } from '../utils'

interface ProfileStatsLineProps {
  postCount: number
  karma: number
  createdAt: string | null | undefined
}

export function ProfileStatsLine({ postCount, karma, createdAt }: ProfileStatsLineProps) {
  const { i18n } = useTranslation()
  const sinceStr = memberSince(createdAt, i18n.language)

  return (
    <p className="mt-[18px] px-[22px] text-[12.5px] text-neutral-500 dark:text-profile-faint m-0">
      <b className="font-semibold text-neutral-900 dark:text-profile-text">{postCount}</b> publicaciones ·{' '}
      <b className="font-semibold text-amber-500 dark:text-profile-gold">{karma}</b> karma ·{' '}
      en la u desde {sinceStr.toLowerCase()}
    </p>
  )
}
