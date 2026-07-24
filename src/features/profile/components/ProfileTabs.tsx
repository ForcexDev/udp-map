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
  'pb-3 text-[13.5px] font-medium text-neutral-500 dark:text-profile-faint cursor-pointer border-b-2 border-transparent -mb-[1px] transition-colors duration-150 data-[state=active]:text-neutral-900 dark:data-[state=active]:text-profile-text data-[state=active]:border-[#D41F2D] dark:data-[state=active]:border-profile-accent hover:text-neutral-700 dark:hover:text-profile-muted outline-none focus-visible:ring-2 focus-visible:ring-[#D41F2D] dark:focus-visible:ring-profile-accent'

export function ProfileTabs({ value, onValueChange, children, hideLeaderboard }: ProfileTabsProps) {
  const { t } = useTranslation()

  return (
    <Tabs.Root value={value} onValueChange={onValueChange} className="mt-[26px]">
      <Tabs.List className="flex gap-[26px] border-b border-neutral-200 dark:border-profile-line mb-6 px-[22px]">
        <Tabs.Trigger value="reports" className={triggerClass}>{t('profile.tabs.reports', 'Reportes')}</Tabs.Trigger>
        <Tabs.Trigger value="badges" className={triggerClass}>{t('profile.tabs.badges', 'Insignias')}</Tabs.Trigger>
        {!hideLeaderboard && (
          <Tabs.Trigger value="leaderboard" className={triggerClass}>{t('profile.tabs.leaderboard', 'Ranking')}</Tabs.Trigger>
        )}
      </Tabs.List>
      {children}
    </Tabs.Root>
  )
}
