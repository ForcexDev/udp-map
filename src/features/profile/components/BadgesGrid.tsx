import { useTranslation } from 'react-i18next'
import type { Badge, UserBadge } from '@/shared/types/database'

interface BadgesGridProps {
  badges: Badge[]
  userBadges: UserBadge[]
  loading: boolean
}

export function BadgesGrid({ badges, userBadges, loading }: BadgesGridProps) {
  const { t, i18n } = useTranslation()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#D41F2D] dark:border-profile-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const sortedBadges = [...badges].sort((a, b) => {
    const aUnlocked = userBadges.some((ub) => ub.badge_id === a.id) ? 1 : 0
    const bUnlocked = userBadges.some((ub) => ub.badge_id === b.id) ? 1 : 0
    return bUnlocked - aUnlocked
  })

  return (
    <div className="px-[22px] pb-6">
      <div className="mb-4">
        <h2 className="text-[17px] font-display font-bold text-neutral-900 dark:text-profile-text m-0">
          {t('profile.badges', 'Insignias')}
        </h2>
        <p className="text-xs text-neutral-500 dark:text-profile-faint mt-0.5">
          {t('profile.badgesDesc', 'Logros y reconocimientos en la comunidad')}
        </p>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {sortedBadges.map((badge) => {
          const unlockedBadge = userBadges.find((ub) => ub.badge_id === badge.id)
          const isUnlocked = !!unlockedBadge
          const badgeName = i18n.language === 'en' ? badge.name_en : badge.name
          const badgeDesc = i18n.language === 'en' ? badge.description_en : badge.description

          return (
            <div
              key={badge.id}
              className={`relative flex items-start gap-3.5 p-4 rounded-[14px] border transition-all ${
                isUnlocked
                  ? 'bg-white dark:bg-[#161719] border-neutral-200 dark:border-profile-line shadow-sm'
                  : 'bg-neutral-50 dark:bg-profile-bg border-neutral-200 dark:border-profile-line opacity-50'
              }`}
            >
              <div
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                  isUnlocked
                    ? 'bg-amber-100 dark:bg-amber-950/40'
                    : 'bg-neutral-200/80 dark:bg-neutral-800'
                }`}
              >
                <svg
                  viewBox="0 0 32 36"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-7 h-7 ${
                    isUnlocked
                      ? 'text-amber-600 dark:text-profile-gold'
                      : 'text-neutral-400 dark:text-neutral-600'
                  }`}
                >
                  <path
                    d="M16 1L2 7v10c0 8.3 5.9 16 14 18 8.1-2 14-9.7 14-18V7L16 1z"
                    fill="currentColor"
                    fillOpacity={isUnlocked ? 0.18 : 0.1}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 7L8 10.5v6c0 4.15 2.95 8 8 9 5.05-1 8-4.85 8-9v-6L16 7z"
                    fill="currentColor"
                    fillOpacity={isUnlocked ? 0.35 : 0.15}
                  />
                  {isUnlocked && (
                    <path
                      d="M11.5 18l3 3 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className={`text-sm font-bold m-0 ${isUnlocked ? 'text-neutral-900 dark:text-profile-text' : 'text-neutral-500 dark:text-profile-faint'}`}>
                    {badgeName}
                  </h3>
                  {isUnlocked && (
                    <span className="inline-block px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-[10px] font-bold text-emerald-600 dark:text-profile-green">
                      Obtenida
                    </span>
                  )}
                </div>
                <p className="mt-1 mb-0 text-xs text-neutral-500 dark:text-profile-muted leading-snug">
                  {badgeDesc}
                </p>
                {isUnlocked && unlockedBadge.awarded_at && (
                  <p className="mt-2 mb-0 text-[10px] font-mono text-neutral-400 dark:text-profile-faint">
                    {t('profile.unlockedAt', 'Desbloqueada el')}: {new Date(unlockedBadge.awarded_at).toLocaleDateString(i18n.language)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
