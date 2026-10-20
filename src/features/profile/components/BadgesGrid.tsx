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
        <div className="w-6 h-6 border-2 border-[#C22B38] dark:border-[#D93846] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const sortedBadges = [...badges].sort((a, b) => {
    const aUnlocked = userBadges.some((ub) => ub.badge_id === a.id) ? 1 : 0
    const bUnlocked = userBadges.some((ub) => ub.badge_id === b.id) ? 1 : 0
    return bUnlocked - aUnlocked
  })

  return (
    <div className="px-5 pb-6">
      <div className="mb-4">
        <h2 className="text-xs font-bold text-stone-500 dark:text-stone-400 m-0">
          {t('profile.badges', 'Insignias')}
        </h2>
        <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mt-1 mb-0">
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
              className={`relative flex items-start gap-3.5 p-4 rounded-2xl border transition-all ${
                isUnlocked
                  ? 'bg-white dark:bg-[#1E222D] border-[#E6E0D5] dark:border-white/[0.07] shadow-sm'
                  : 'bg-[#FAF8F5]/60 dark:bg-[#151820]/40 border-[#E6E0D5]/70 dark:border-white/[0.04] opacity-50'
              }`}
            >
              <div
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                  isUnlocked
                    ? 'bg-amber-100 dark:bg-amber-950/40'
                    : 'bg-[#EFECE4] dark:bg-white/[0.06]'
                }`}
              >
                <svg
                  viewBox="0 0 32 36"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-7 h-7 ${
                    isUnlocked
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-stone-400 dark:text-stone-600'
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
                  <h3 className={`text-sm font-bold m-0 ${isUnlocked ? 'text-stone-900 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`}>
                    {badgeName}
                  </h3>
                  {isUnlocked && (
                    <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Obtenida
                    </span>
                  )}
                </div>
                <p className="mt-1 mb-0 text-xs font-medium text-stone-500 dark:text-stone-400 leading-snug">
                  {badgeDesc}
                </p>
                {isUnlocked && unlockedBadge.awarded_at && (
                  <p className="mt-2 mb-0 text-[10px] font-medium text-stone-400 dark:text-stone-500 tabular-nums">
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
