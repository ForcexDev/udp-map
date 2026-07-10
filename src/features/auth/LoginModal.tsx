import { useTranslation } from 'react-i18next'
import { GraduationCap, ShieldCheck } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from './authStore'
import { isSupabaseConfigured } from '@/shared/lib/supabase'

export function LoginModal() {
  const { t } = useTranslation()
  const open = useUIStore((s) => s.loginModalOpen)
  const close = useUIStore((s) => s.closeLoginModal)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const signInDemo = useAuthStore((s) => s.signInDemo)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title={t('auth.guestGateTitle')}
      description={t('auth.guestGateBody')}
    >
      <div className="flex flex-col gap-2">
        {isSupabaseConfigured ? (
          <Button onClick={() => void signInWithGoogle()}>
            <GraduationCap size={18} />
            {t('auth.continueWithGoogle')}
          </Button>
        ) : (
          <>
            <p className="text-xs text-neutral-500">{t('auth.demoMode')}</p>
            <Button
              onClick={() => {
                signInDemo('student')
                close()
              }}
            >
              <GraduationCap size={18} />
              {t('auth.demoStudent')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                signInDemo('admin')
                close()
              }}
            >
              <ShieldCheck size={18} />
              {t('auth.demoAdmin')}
            </Button>
          </>
        )}
        <p className="mt-1 text-center text-xs text-neutral-500">{t('auth.onlyUdp')}</p>
      </div>
    </Dialog>
  )
}
