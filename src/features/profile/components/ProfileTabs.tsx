import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import * as Tabs from '@radix-ui/react-tabs'

interface ProfileTabsProps {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  hideLeaderboard?: boolean
  /** Solo en el perfil propio: qué eventos marcó uno no es de nadie más. */
  showEvents?: boolean
}

const triggerClass =
  'pb-2.5 text-xs font-semibold text-stone-500 dark:text-stone-400 cursor-pointer border-b-2 border-transparent -mb-px transition-colors data-[state=active]:text-stone-900 dark:data-[state=active]:text-stone-100 data-[state=active]:border-[#C22B38] dark:data-[state=active]:border-[#D93846] hover:text-stone-800 dark:hover:text-stone-200 outline-none focus-visible:ring-2 focus-visible:ring-[#C22B38] dark:focus-visible:ring-[#D93846] rounded-t-sm'

export function ProfileTabs({ value, onValueChange, children, hideLeaderboard, showEvents }: ProfileTabsProps) {
  const { t } = useTranslation()

  return (
    <Tabs.Root value={value} onValueChange={onValueChange} className="mt-6">
      <Tabs.List className="mb-5 flex gap-6 border-b border-[#E5DEC9] px-5 dark:border-white/10">
        <Tabs.Trigger value="reports" className={triggerClass}>{t('profile.tabs.reports', 'Reportes')}</Tabs.Trigger>
        <Tabs.Trigger value="badges" className={triggerClass}>{t('profile.tabs.badges', 'Insignias')}</Tabs.Trigger>
        {showEvents && (
          <Tabs.Trigger value="events" className={triggerClass}>{t('profile.tabs.events', 'Eventos')}</Tabs.Trigger>
        )}
        {!hideLeaderboard && (
          <Tabs.Trigger value="leaderboard" className={triggerClass}>{t('profile.tabs.leaderboard', 'Clasificación')}</Tabs.Trigger>
        )}
      </Tabs.List>
      {children}
    </Tabs.Root>
  )
}
