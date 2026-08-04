import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import * as Tabs from '@radix-ui/react-tabs'

interface ProfileTabsProps {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  hideLeaderboard?: boolean
}

const triggerClass =
  'pb-2.5 text-[13px] font-bold text-neutral-500 dark:text-neutral-400 cursor-pointer border-b-2 border-transparent -mb-px transition-colors data-[state=active]:text-neutral-900 dark:data-[state=active]:text-white data-[state=active]:border-[#D41F2D] hover:text-neutral-700 dark:hover:text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-[#D41F2D] rounded-t-sm'

export function ProfileTabs({ value, onValueChange, children, hideLeaderboard }: ProfileTabsProps) {
  const { t } = useTranslation()

  return (
    <Tabs.Root value={value} onValueChange={onValueChange} className="mt-6">
      <Tabs.List className="flex gap-6 border-b border-neutral-200 dark:border-neutral-800 mb-5 px-5">
        <Tabs.Trigger value="reports" className={triggerClass}>{t('profile.tabs.reports', 'Reportes')}</Tabs.Trigger>
        <Tabs.Trigger value="badges" className={triggerClass}>{t('profile.tabs.badges', 'Insignias')}</Tabs.Trigger>
        {!hideLeaderboard && (
          <Tabs.Trigger value="leaderboard" className={triggerClass}>{t('profile.tabs.leaderboard', 'Clasificación')}</Tabs.Trigger>
        )}
      </Tabs.List>
      {children}
    </Tabs.Root>
  )
}
