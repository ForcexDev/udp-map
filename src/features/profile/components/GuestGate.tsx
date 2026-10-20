import { useTranslation } from 'react-i18next'
import { UserRound } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { useUIStore } from '@/shared/stores/uiStore'

export function GuestGate() {
  const { t } = useTranslation()
  const openLoginModal = useUIStore((s) => s.openLoginModal)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center bg-[#FAF8F5] dark:bg-[#151820]">
      <div className="w-20 h-20 rounded-full bg-[#EFECE4] dark:bg-white/[0.08] flex items-center justify-center">
        <UserRound size={40} className="text-stone-400 dark:text-stone-500" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{t('profile.title', 'Perfil')}</h1>
        <p className="mt-1 text-sm font-medium text-stone-500 dark:text-stone-400">{t('auth.guestGateBody', 'Inicia sesión para ver tu perfil.')}</p>
      </div>
      <Button onClick={openLoginModal} className="mt-2 px-8 rounded-2xl bg-[#C22B38] hover:bg-[#a8242f] dark:bg-[#D93846] text-white">{t('auth.signIn', 'Iniciar sesión')}</Button>
    </div>
  )
}
