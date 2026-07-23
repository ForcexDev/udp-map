import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface AdminBadgeProps {
  compact?: boolean
}

export function AdminBadge({ compact = false }: AdminBadgeProps) {
  const { t } = useTranslation()

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#D41F2D]/25 bg-gradient-to-r from-red-50 to-amber-50 font-black uppercase tracking-[0.08em] text-[#B51D2A] shadow-sm dark:border-red-400/30 dark:from-red-950/50 dark:to-amber-950/30 dark:text-red-200 ${
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
      }`}
      title={t('profile.adminDescription', 'Cuenta oficial de administración de UDP Map')}
    >
      <ShieldCheck size={compact ? 11 : 14} strokeWidth={2.5} />
      <span>{t('profile.adminBadge', 'Administrador UDP')}</span>
    </span>
  )
}
