import { useTranslation } from 'react-i18next'
import { memberSince } from '../utils'

interface ProfileStatsLineProps {
  postCount: number
  karma: number
  createdAt: string | null | undefined
}

export function ProfileStatsLine({ postCount, karma, createdAt }: ProfileStatsLineProps) {
  const { t, i18n } = useTranslation()
  const sinceStr = memberSince(createdAt, i18n.language)

  return (
    <p className="mt-4 px-5 text-[12.5px] font-medium text-stone-500 dark:text-stone-400 m-0">
      <b className="font-bold text-stone-900 dark:text-stone-100 tabular-nums">{postCount}</b>{' '}
      {t('profile.posts', { count: postCount, defaultValue: 'publicaciones' })} ·{' '}
      <b className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">{karma}</b>{' '}
      {t('profile.karma', 'Karma').toLowerCase()} ·{' '}
      {t('profile.memberSince', 'Miembro desde')} {sinceStr.toLowerCase()}
    </p>
  )
}
