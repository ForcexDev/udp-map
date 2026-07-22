import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flag, Send, Trash2 } from 'lucide-react'
import { useComments } from './useComments'
import { useGuard } from '@/features/auth/useGuard'
import { useAuthStore } from '@/features/auth/authStore'
import { can } from '@/features/auth/permissions'
import { relativeTime } from '@/shared/utils/datetime'
import { Spinner } from '@/shared/ui/Spinner'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { PublicProfileModal } from '@/features/profile/PublicProfileModal'
import { UserAvatar } from '@/shared/ui/UserAvatar'
import { ReportContentDialog, type ReportTarget } from '@/features/moderation/ReportContentDialog'

const AGO_KEY = { minute: 'agoMinutes', hour: 'agoHours', day: 'agoDays' } as const

export function CommentSection({ pinId }: { pinId: string }) {
  const { t } = useTranslation()
  const { comments, isLoading, send, remove } = useComments(pinId)
  const guard = useGuard()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const [body, setBody] = useState('')
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)

  const submit = () => {
    const text = body.trim()
    if (!text) return
    if (!guard('pin.comment')) return
    send.mutate(text)
    setBody('')
  }

  return (
    <section aria-label={t('comments.title')}>
      <h3 className="mb-3 text-[17px] font-bold text-neutral-900 dark:text-neutral-100">
        {t('comments.title')} ({comments.length})
      </h3>

      {isLoading ? (
        <Spinner className="mx-auto my-4 text-udp-600" />
      ) : comments.length === 0 ? (
        <p className="my-3 text-sm text-neutral-500">{t('comments.empty')}</p>
      ) : (
        <ul 
          className="flex max-h-[260px] flex-col overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-200 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-700 hover:[&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:hover:[&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-thumb]:rounded-full"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {comments.map((c) => {
            const rel = relativeTime(c.created_at)
            const isMe = user && user.id === c.author_id
            const canDelete = isMe || can(role, 'pin.moderate')
            
            return (
              <li key={c.id} className="group relative flex gap-3 border-b border-neutral-100 py-3 last:border-0 dark:border-neutral-800">
                <UserAvatar
                  name={c.author_name}
                  src={c.author_avatar_url || (isMe ? user?.avatarUrl : null)}
                  className="mt-0.5 h-10 w-10 text-4xl"
                />
                
                <div className="flex flex-1 flex-col relative">
                  <button
                    onClick={() => c.author_id && setProfileId(c.author_id)}
                    className="pr-6 text-left text-[14.5px] font-bold leading-tight text-neutral-900 dark:text-neutral-100 hover:underline"
                  >
                    {c.author_name ?? t('auth.guest')}
                  </button>
                  
                  <p className="pr-6 text-[14px] leading-snug text-neutral-800 dark:text-neutral-200 break-words">
                    {c.body}
                  </p>
                  
                  <span className="mt-0.5 text-[11.5px] text-neutral-500">
                    {t(`time.${AGO_KEY[rel.unit]}`, { n: rel.value })}
                  </span>

                  <div className="absolute right-0 top-0 flex items-center gap-0.5">
                    {user && !isMe && role !== 'guest' && (
                      <button onClick={() => setReportTarget({ type: 'pin_comment', id: c.id })} className="p-1 -mt-1 text-neutral-400 transition-colors hover:text-[#D41F2D]" aria-label="Reportar comentario"><Flag size={14} /></button>
                    )}
                    {canDelete && (
                      <button onClick={() => setCommentToDelete(c.id)} className="p-1 -mr-1 -mt-1 text-[#9d2235]/70 transition-colors hover:text-[#9d2235]" aria-label={t('common.delete', 'Eliminar')}><Trash2 size={15} /></button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('comments.placeholder')}
          maxLength={400}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-udp-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={!body.trim() || send.isPending}
          aria-label={t('comments.send')}
          className="rounded-lg bg-udp-700 p-2 text-white hover:bg-udp-800 disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>

      <ConfirmDialog
        open={!!commentToDelete}
        onOpenChange={(open) => !open && setCommentToDelete(null)}
        title={t('pin.confirmDeleteComment', '¿Eliminar comentario?')}
        description={t('pin.confirmDeleteCommentDesc', 'Esta acción no se puede deshacer.')}
        confirmText={t('common.delete', 'Eliminar')}
        onConfirm={() => commentToDelete && remove.mutate(commentToDelete)}
      />

      <PublicProfileModal userId={profileId} onClose={() => setProfileId(null)} />
      <ReportContentDialog target={reportTarget} onClose={() => setReportTarget(null)} />
    </section>
  )
}
