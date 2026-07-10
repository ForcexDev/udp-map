import { useTranslation } from 'react-i18next'
import { MessagesSquare } from 'lucide-react'

export function ForumPage() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <MessagesSquare size={48} className="text-udp-400" aria-hidden />
      <h1 className="text-xl font-semibold">{t('forum.title')}</h1>
      <p className="max-w-sm text-sm text-neutral-500">{t('forum.comingSoon')}</p>
    </div>
  )
}
