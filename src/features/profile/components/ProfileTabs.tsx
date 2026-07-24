import { useTranslation } from 'react-i18next'
import { Tabs } from '@/shared/ui/Tabs'
import React from 'react'

interface ProfileTabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  hideLeaderboard?: boolean
}

export function ProfileTabs({ value, onValueChange, children, hideLeaderboard }: ProfileTabsProps) {
  const { t } = useTranslation()

  return (
    <Tabs.Root value={value} onValueChange={onValueChange} className="mt-[26px]">
      <Tabs.List>
        <Tabs.Trigger value="reports">{t('profile.tabs.reports', 'Reportes')}</Tabs.Trigger>
        <Tabs.Trigger value="badges">{t('profile.tabs.badges', 'Insignias')}</Tabs.Trigger>
        {!hideLeaderboard && <Tabs.Trigger value="leaderboard">{t('profile.tabs.leaderboard', 'Ranking')}</Tabs.Trigger>}
      </Tabs.List>
      {children}
    </Tabs.Root>
  )
}
