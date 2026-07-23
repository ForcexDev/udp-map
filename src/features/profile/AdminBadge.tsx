import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function AdminBadge() {
  const { t } = useTranslation()

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/60 bg-gradient-to-r from-[#B51D2A] via-[#D41F2D] to-[#A51422] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-[0_3px_10px_rgba(180,29,42,0.25)] dark:border-amber-300/40"
      title={t('profile.adminDescription', 'Cuenta oficial de administración de UDP Map')}
    >
      <ShieldCheck size={13} className="text-amber-200" strokeWidth={2.7} />
      <span>{t('profile.adminBadge', 'Admin')}</span>
    </span>
  )
}
