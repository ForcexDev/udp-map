import { useTranslation } from 'react-i18next'
import { UserRound } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { useUIStore } from '@/shared/stores/uiStore'

export function GuestGate() {
  const { t } = useTranslation()
  const openLoginModal = useUIStore((s) => s.openLoginModal)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center bg-neutral-50 dark:bg-neutral-950">
      <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
        <UserRound size={40} className="text-neutral-400" />
      </div>
      <div>
        <h1 className="text-xl font-black text-neutral-900 dark:text-white">{t('profile.title', 'Perfil')}</h1>
        <p className="mt-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">{t('auth.guestGateBody', 'Inicia sesión para ver tu perfil.')}</p>
      </div>
      <Button onClick={openLoginModal} className="mt-2 px-8">{t('auth.signIn', 'Iniciar sesión')}</Button>
    </div>
  )
}
