import { useTranslation } from 'react-i18next'
import { GraduationCap, ShieldCheck } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { useUIStore } from '@/shared/stores/uiStore'
import { GoogleLogin } from '@react-oauth/google'
import { useAuthStore } from './authStore'
import { isSupabaseConfigured } from '@/shared/lib/supabase'

export function LoginModal() {
  const { t } = useTranslation()
  const open = useUIStore((s) => s.loginModalOpen)
  const close = useUIStore((s) => s.closeLoginModal)
  const signInWithIdToken = useAuthStore((s) => s.signInWithIdToken)
  const signInDemo = useAuthStore((s) => s.signInDemo)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title={t('auth.guestGateTitle')}
      description={t('auth.guestGateBody')}
      contentClassName="!bg-[#FAF8F5] dark:!bg-[#151820] border border-[#E5DEC9] dark:border-white/10 rounded-3xl premium-shadow"
    >
      <div className="flex flex-col gap-2.5">
        {isSupabaseConfigured ? (
          <div className="flex flex-col items-center justify-center py-2 gap-3">
            <GoogleLogin
              onSuccess={(res) => {
                if (res.credential) {
                  void signInWithIdToken(res.credential)
                  close()
                }
              }}
              onError={() => console.error('Google Login Error')}
              useOneTap
              hosted_domain="mail.udp.cl"
              shape="rectangular"
              theme="outline"
              text="continue_with"
            />
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{t('auth.demoMode')}</p>
            <Button
              className="rounded-2xl bg-[#C22B38] hover:bg-[#A82430] dark:bg-[#D93846] dark:hover:bg-[#C22B38] text-white font-semibold shadow-xs"
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
              className="rounded-2xl font-semibold bg-[#EFECE4] text-stone-700 hover:bg-stone-200 dark:bg-white/[0.08] dark:text-stone-200 dark:hover:bg-white/[0.12]"
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
        <p className="mt-1 text-center text-xs text-stone-500 dark:text-stone-400">{t('auth.onlyUdp')}</p>
      </div>
    </Dialog>
  )
}
