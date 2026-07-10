import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Trash2 } from 'lucide-react'
import { useComments } from './useComments'
import { useGuard } from '@/features/auth/useGuard'
import { useAuthStore } from '@/features/auth/authStore'
import { can } from '@/features/auth/permissions'
import { relativeTime } from '@/shared/utils/datetime'
import { Spinner } from '@/shared/ui/Spinner'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'

const AGO_KEY = { minute: 'agoMinutes', hour: 'agoHours', day: 'agoDays' } as const

export function CommentSection({ pinId }: { pinId: string }) {
  const { t } = useTranslation()
  const { comments, isLoading, send, remove } = useComments(pinId)
  const guard = useGuard()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const [body, setBody] = useState('')
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null)

  const submit = () => {
    const text = body.trim()
    if (!text) return
    if (!guard('pin.comment')) return
    send.mutate(text)
    setBody('')
  }

  return (
    <section aria-label={t('comments.title')}>
      <h3 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        {t('comments.title')} ({comments.length})
      </h3>

      {isLoading ? (
        <Spinner className="mx-auto my-4 text-udp-600" />
      ) : comments.length === 0 ? (
        <p className="my-3 text-sm text-neutral-500">{t('comments.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((c) => {
            const rel = relativeTime(c.created_at)
            const canDelete = (user && user.id === c.author_id) || can(role, 'pin.moderate')
            
            return (
              <li key={c.id} className="rounded-lg bg-neutral-100 p-2.5 dark:bg-neutral-800 group relative">
                <div className="mb-0.5 flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-udp-700 dark:text-udp-300">
                    {c.author_name ?? t('auth.guest')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">
                      {t(`time.${AGO_KEY[rel.unit]}`, { n: rel.value })}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => setCommentToDelete(c.id)}
                        className="text-neutral-400 hover:text-red-500 transition-colors"
                        aria-label={t('common.delete', 'Eliminar')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm break-words pr-4">{c.body}</p>
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
    </section>
  )
}
