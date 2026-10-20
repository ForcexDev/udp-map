import { localizedName } from '@/shared/utils/localized'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, ChevronDown, Pin as PinIcon, Trash2, Reply, ThumbsUp, ThumbsDown, Send, Flag } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { PublicProfileModal } from '@/features/profile/PublicProfileModal'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { relativeTime } from '@/shared/utils/datetime'
import { FACULTIES } from '@/shared/data/campusData'
import {
  useThread,
  useComments,
  useCreateComment,
  useDeleteComment,
  useVoteThread,
  useUserVoteOnThread,
  useDeleteThread,
  useTogglePinThread,
} from './useForum'
import { buildCommentTree, buildReplyContent, countNestedReplies, type CommentNode } from './utils'
import { UserAvatar } from '@/shared/ui/UserAvatar'
import { ReportContentDialog, type ReportTarget } from '@/features/moderation/ReportContentDialog'

interface ThreadDetailModalProps {
  threadId: string | null
  onClose: () => void
}

interface CommentItemProps {
  node: CommentNode
  depth?: number
  replyingToId: string | null
  setReplyingToId: (id: string | null) => void
  replyText: string
  setReplyText: (text: string) => void
  isSubmitting: boolean
  onAddReply: (parentId: string, authorName?: string | null) => void
  onDeleteComment: (commentId: string) => void
  onUserClick: (userId: string) => void
  onReport: (target: ReportTarget) => void
}

function CommentItem({
  node,
  depth = 0,
  replyingToId,
  setReplyingToId,
  replyText,
  setReplyText,
  isSubmitting,
  onAddReply,
  onDeleteComment,
  onUserClick,
  onReport,
}: CommentItemProps) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const isModerator = role === 'admin' || role === 'moderator'
  const isCommentOwner = user && node.author_id === user.id
  const isReplying = replyingToId === node.id
  const [showAllReplies, setShowAllReplies] = useState(false)
  const replyCount = countNestedReplies(node)
  const visibleReplies = depth === 0 && !showAllReplies ? [] : node.replies
  const relTime = relativeTime(node.created_at)

  const avatarSize = depth > 0 ? 'h-7 w-7' : 'h-9 w-9'

  return (
    <div className={`relative flex gap-3 ${depth > 0 ? 'mt-2.5' : 'border-b border-[#E5DEC9] pb-3.5 last:border-0 dark:border-white/10'}`}>
      <UserAvatar
        name={node.author_name}
        src={node.author_avatar_url || (isCommentOwner ? user?.avatarUrl : null)}
        className={`mt-0.5 ${avatarSize} text-2xl shrink-0`}
      />
      
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Author + Timestamp */}
        <div className="flex items-center justify-between gap-2 pr-1">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => node.author_id && onUserClick(node.author_id)}
              className="text-left text-[13.5px] font-bold leading-tight text-stone-900 hover:underline dark:text-stone-100 cursor-pointer"
            >
              {node.author_name || 'Estudiante UDP'}
            </button>
            <span className="shrink-0 text-[11px] font-medium text-stone-400 dark:text-stone-500">
              {relTime.value === 0 ? 'Ahora' : `hace ${relTime.value} ${relTime.unit === 'day' ? 'd' : relTime.unit === 'hour' ? 'h' : 'min'}`}
            </span>
          </div>

          {/* Quick Actions (Reply, Report, Delete) */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => {
                if (isReplying) {
                  setReplyingToId(null)
                  setReplyText('')
                } else {
                  setReplyingToId(node.id)
                  setReplyText('')
                }
              }}
              className="cursor-pointer rounded-lg p-1 text-stone-400 transition-colors hover:text-stone-700 dark:hover:text-stone-200"
              title={t('forum.reply', 'Responder')}
            >
              <Reply size={13} />
            </button>
            {user && !isCommentOwner && role !== 'guest' && (
              <button
                onClick={() => onReport({ type: 'forum_comment', id: node.id })}
                className="cursor-pointer rounded-lg p-1 text-stone-400 transition-colors hover:text-[#C22B38] dark:hover:text-[#D93846]"
                title="Reportar respuesta"
              >
                <Flag size={13} />
              </button>
            )}
            {(isCommentOwner || isModerator) && (
              <button
                onClick={() => onDeleteComment(node.id)}
                className="cursor-pointer rounded-lg p-1 text-stone-400 transition-colors hover:text-red-500"
                title={t('common.delete', 'Eliminar')}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <p className="mt-1 break-words text-[13.5px] leading-snug whitespace-pre-line text-stone-800 dark:text-stone-200">
          {node.content}
        </p>

        {/* Inline Reply Form */}
        {isReplying && (
          <div className="mt-2.5 flex flex-col gap-2 rounded-2xl border border-[#E6E0D5] bg-[#FAF8F5] p-3 dark:border-white/[0.07] dark:bg-[#151820]">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t('forum.replyPlaceholder', 'Escribe tu respuesta...')}
              rows={2}
              autoFocus
              className="w-full resize-none rounded-xl border border-[#E6E0D5] bg-white px-3 py-2 text-xs font-medium text-stone-900 outline-none transition-all focus:border-[#C22B38] dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-100 dark:focus:border-[#D93846]"
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setReplyingToId(null)}
                className="cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold text-stone-500 transition-colors hover:bg-[#EFECE4] dark:hover:bg-white/[0.08]"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => onAddReply(node.id, node.author_name)}
                disabled={!replyText.trim() || isSubmitting}
                className="cursor-pointer rounded-xl bg-[#C22B38] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#a8242f] disabled:opacity-50 dark:bg-[#D93846] dark:hover:bg-[#c22b38]"
              >
                {t('forum.sendReply', 'Responder')}
              </button>
            </div>
          </div>
        )}

        {/* Nested Replies Tree (Left Aligned starting near root avatar - Red Line Alignment) */}
        {node.replies.length > 0 && (
          <div className={`mt-2 flex flex-col ${depth === 0 ? '-ml-7 space-y-2 pl-2 sm:-ml-8' : ''}`}>
            {depth === 0 && (
              <button
                type="button"
                onClick={() => setShowAllReplies((current) => !current)}
                className="my-1 flex cursor-pointer items-center gap-1.5 self-start rounded-xl bg-[#EFECE4] px-3 py-1 text-xs font-semibold text-stone-700 transition-colors hover:bg-[#e4dfd4] dark:bg-white/[0.08] dark:text-stone-300 dark:hover:bg-white/[0.12]"
                aria-expanded={showAllReplies}
              >
                {showAllReplies
                  ? t('forum.hideReplies', 'Ocultar respuestas')
                  : t('forum.replyCount', { count: replyCount, defaultValue: '{{count}} respuestas' })}
                <ChevronDown
                  size={13}
                  strokeWidth={2.5}
                  className={`transition-transform ${showAllReplies ? 'rotate-180' : ''}`}
                />
              </button>
            )}
            {visibleReplies.map((reply) => (
              <CommentItem 
                key={reply.id} 
                node={reply} 
                depth={1}
                replyingToId={replyingToId}
                setReplyingToId={setReplyingToId}
                replyText={replyText}
                setReplyText={setReplyText}
                isSubmitting={isSubmitting}
                onAddReply={onAddReply}
                onDeleteComment={onDeleteComment}
                onUserClick={onUserClick}
                onReport={onReport}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function ThreadDetailModal({ threadId, onClose }: ThreadDetailModalProps) {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const showToast = useUIStore((s) => s.showToast)

  const { data: thread, isLoading: isLoadingThread } = useThread(threadId || '')
  const { data: comments = [], isLoading: isLoadingComments } = useComments(threadId || '')

  const createCommentMutation = useCreateComment()
  const deleteCommentMutation = useDeleteComment()
  const deleteThreadMutation = useDeleteThread()
  const togglePinMutation = useTogglePinThread()
  const voteMutation = useVoteThread()
  const { data: userVote = null } = useUserVoteOnThread(threadId || '')

  const [newCommentText, setNewCommentText] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)

  if (!threadId) return null

  const isModerator = role === 'admin' || role === 'moderator'
  const isOwner = thread && user && thread.author_id === user.id
  const faculty = thread ? FACULTIES.find((f) => f.id === thread.faculty_id) : null
  const relTime = thread ? relativeTime(thread.created_at) : null

  const handleVote = (val: 1 | -1) => {
    if (!user || role === 'guest') {
      showToast(t('auth.loginRequired', 'Debes iniciar sesión con tu correo UDP'))
      return
    }
    if (voteMutation.isPending) return
    voteMutation.mutate({ threadId: threadId, value: val })
  }

  const handlePinToggle = () => {
    if (!thread) return
    togglePinMutation.mutate(
      { threadId: thread.id, isPinned: !thread.is_pinned },
      {
        onSuccess: () => {
          showToast(
            thread.is_pinned
              ? t('forum.threadUnpinned', 'Hilo desfijado')
              : t('forum.threadPinned', 'Hilo fijado al inicio')
          )
        },
      }
    )
  }

  const handleDeleteThread = () => {
    if (!thread) return
    if (window.confirm(t('forum.confirmDeleteThread', '¿Estás seguro de que quieres eliminar este hilo?'))) {
      deleteThreadMutation.mutate(thread.id, {
        onSuccess: () => {
          showToast(t('forum.threadDeleted', 'Hilo eliminado correctamente'))
          onClose()
        },
      })
    }
  }

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || role === 'guest') {
      showToast(t('auth.loginRequired', 'Debes iniciar sesión para comentar'))
      return
    }
    if (!newCommentText.trim() || createCommentMutation.isPending) return

    createCommentMutation.mutate(
      {
        threadId: threadId,
        parentCommentId: null,
        content: newCommentText.trim(),
        authorId: user.id,
        authorName: user.name,
        authorAvatarUrl: user.avatarUrl,
      },
      {
        onSuccess: () => {
          setNewCommentText('')
        },
      }
    )
  }

  const handleAddReply = (parentId: string, authorName?: string | null) => {
    if (!user || role === 'guest') {
      showToast(t('auth.loginRequired', 'Debes iniciar sesión para responder'))
      return
    }
    if (!replyText.trim() || createCommentMutation.isPending) return

    createCommentMutation.mutate(
      {
        threadId: threadId,
        parentCommentId: parentId,
        content: buildReplyContent(replyText, authorName),
        authorId: user.id,
        authorName: user.name,
        authorAvatarUrl: user.avatarUrl,
      },
      {
        onSuccess: () => {
          setReplyText('')
          setReplyingToId(null)
        },
      }
    )
  }

  const handleDeleteComment = (commentId: string) => {
    if (window.confirm(t('forum.confirmDeleteComment', '¿Quieres eliminar este comentario?'))) {
      deleteCommentMutation.mutate({ commentId, threadId })
    }
  }

  const commentTree = buildCommentTree(comments)

  return (
    <Dialog
      open={true}
      onOpenChange={(o) => !o && onClose()}
      title={t('forum.threadDetail', 'Hilo de Foro')}
      contentClassName="!bg-white dark:!bg-[#1E222D] border border-[#E6E0D5] dark:border-white/[0.07] sm:max-w-xl flex flex-col !overflow-hidden h-[90dvh] max-h-[90dvh] sm:h-[650px] sm:max-h-[85dvh] !rounded-t-[32px] sm:!rounded-3xl max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:top-auto max-sm:w-full"
    >
      {isLoadingThread && !thread ? (
        <div className="flex h-48 items-center justify-center text-sm font-semibold text-stone-500">
          {t('common.loading')}
        </div>
      ) : (
        thread && (
          <div className="flex flex-1 flex-col min-h-0">
            {/* Scrollable Area (Body, Vote bar, Comments) */}
            <div className="-mx-6 flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-20">
              {/* Header info / Meta */}
              <div className="flex items-center justify-between gap-3 border-b border-[#E5DEC9] pb-3.5 dark:border-white/10">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar
                    name={thread.author_name}
                    src={thread.author_avatar_url || (user && user.id === thread.author_id ? user.avatarUrl : null)}
                    className="h-10 w-10 shrink-0 cursor-pointer text-3xl"
                    onClick={() => thread.author_id && setProfileId(thread.author_id)}
                  />
                  <div className="flex min-w-0 flex-col">
                    <button
                      onClick={() => thread.author_id && setProfileId(thread.author_id)}
                      className="cursor-pointer text-left text-[14px] font-bold text-stone-900 hover:underline dark:text-stone-100"
                    >
                      <span className="flex items-center gap-1.5">
                        {thread.is_official
                          ? (thread.official_entity_name || t('pin.officialEntityDefault', 'Administración UDP'))
                          : (thread.author_name || 'Estudiante UDP')}
                        {thread.is_official && <BadgeCheck size={15} className="text-blue-500" aria-label={t('forum.official', 'Oficial')} />}
                      </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-stone-400 dark:text-stone-500">
                      <span>{relTime ? (relTime.value === 0 ? 'Ahora' : `hace ${relTime.value} ${relTime.unit === 'day' ? 'd' : relTime.unit === 'hour' ? 'h' : 'min'}`) : ''}</span>
                      <span>•</span>
                      <span className="font-bold text-[#C22B38] dark:text-[#D93846]">
                        {faculty ? localizedName(faculty, i18n.language) : t('forum.general', 'General')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions: Pin, Delete, Report */}
                <div className="flex shrink-0 items-center gap-1.5">
                  {thread.is_pinned && (
                    <span className="flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-400">
                      <PinIcon size={11} />
                      Fijado
                    </span>
                  )}
                  {user && !isOwner && role !== 'guest' && (
                    <button
                      onClick={() => setReportTarget({ type: 'forum_thread', id: thread.id })}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[#E6E0D5] text-stone-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-white/[0.07] dark:text-stone-400 dark:hover:border-red-900/50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      title="Reportar hilo"
                    >
                      <Flag size={15} />
                    </button>
                  )}
                  {isModerator && (
                    <button
                      onClick={handlePinToggle}
                      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
                        thread.is_pinned
                          ? 'border-amber-400 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                          : 'border-[#E6E0D5] text-stone-500 hover:text-amber-600 dark:border-white/[0.07] dark:text-stone-400'
                      }`}
                      title={thread.is_pinned ? t('forum.unpin', 'Desfijar') : t('forum.pin', 'Fijar')}
                    >
                      <PinIcon size={15} />
                    </button>
                  )}
                  {(isOwner || isModerator) && (
                    <button
                      onClick={handleDeleteThread}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[#E6E0D5] text-stone-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-white/[0.07] dark:text-stone-400 dark:hover:border-red-900/50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      title={t('common.delete')}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Title & Structured Description Block (Matching PinDetail) */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold leading-tight text-stone-900 sm:text-xl dark:text-stone-100">
                  {thread.title}
                </h2>
                {thread.content && (
                  <div className="rounded-2xl border border-[#E6E0D5] bg-[#FAF8F5] p-4 dark:border-white/[0.07] dark:bg-[#151820]">
                    <span className="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">
                      {t('forum.description', 'Descripción')}
                    </span>
                    <p className="text-[13.5px] leading-relaxed font-normal whitespace-pre-line text-stone-800 sm:text-[14px] dark:text-stone-200">
                      {thread.content}
                    </p>
                  </div>
                )}
              </div>

              {/* Tags */}
              {thread.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {thread.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-xl bg-[#EFECE4] px-2.5 py-0.5 text-xs font-semibold text-stone-700 dark:bg-white/[0.08] dark:text-stone-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Unified Vote Segment (Matching PinDetail) */}
              <div className="flex items-center gap-3 pt-1">
                <div
                  role="group"
                  aria-label={t('forum.voteGroup', 'Votar hilo')}
                  className="flex h-9 items-stretch overflow-hidden rounded-xl border border-[#E6E0D5] bg-[#FAF8F5] dark:border-white/[0.07] dark:bg-[#151820]"
                >
                  <button
                    type="button"
                    onClick={() => handleVote(1)}
                    disabled={voteMutation.isPending}
                    className={`flex cursor-pointer items-center justify-center gap-1.5 px-4 text-xs font-semibold transition-colors ${
                      userVote === 1
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'text-stone-500 hover:bg-[#EFECE4] dark:text-stone-400 dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    <ThumbsUp size={14} strokeWidth={2.2} />
                    <span className="tabular-nums">{thread.votes_up}</span>
                  </button>
                  <div className="w-px bg-[#E6E0D5] dark:bg-white/[0.07]" />
                  <button
                    type="button"
                    onClick={() => handleVote(-1)}
                    disabled={voteMutation.isPending}
                    className={`flex cursor-pointer items-center justify-center gap-1.5 px-4 text-xs font-semibold transition-colors ${
                      userVote === -1
                        ? 'border border-[#F2D0CE] bg-[#FBECEB] text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300'
                        : 'text-stone-500 hover:bg-[#EFECE4] dark:text-stone-400 dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    <ThumbsDown size={14} strokeWidth={2.2} />
                    <span className="tabular-nums">{thread.votes_down}</span>
                  </button>
                </div>
              </div>

              {/* Comments Section Header (Matching PinDetail) */}
              <div className="mt-4 flex items-center justify-between border-t border-[#E5DEC9] pt-4 dark:border-white/10">
                <h3 className="text-[16px] font-bold text-stone-900 sm:text-[17px] dark:text-stone-100">
                  {t('forum.repliesCount', { defaultValue: 'Comentarios ({{count}})', count: comments.length })}
                </h3>
              </div>

              {/* Comments List */}
              {isLoadingComments ? (
                <div className="py-6 text-center text-xs font-semibold text-stone-400">{t('common.loading')}</div>
              ) : commentTree.length === 0 ? (
                <p className="py-6 text-center text-xs italic text-stone-400">{t('forum.noComments', 'Sé el primero en comentar...')}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {commentTree.map((node) => (
                    <CommentItem 
                      key={node.id} 
                      node={node} 
                      depth={0} 
                      replyingToId={replyingToId}
                      setReplyingToId={setReplyingToId}
                      replyText={replyText}
                      setReplyText={setReplyText}
                      isSubmitting={createCommentMutation.isPending}
                      onAddReply={handleAddReply}
                      onDeleteComment={handleDeleteComment}
                      onUserClick={setProfileId}
                      onReport={setReportTarget}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Fixed Bottom Reply Input Bar (Matching CommentSection.tsx rectangular style) */}
            <form 
              onSubmit={handleAddComment} 
              className="-mx-6 -mb-6 mt-auto flex shrink-0 items-center gap-2 overflow-hidden rounded-b-[32px] border-t border-[#E5DEC9] bg-white px-6 pt-3.5 pb-4 sm:rounded-b-3xl dark:border-white/10 dark:bg-[#1E222D]"
            >
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={t('forum.addCommentPlaceholder', 'Escribe un comentario...')}
                className="min-w-0 flex-1 rounded-2xl border border-[#E6E0D5] bg-[#FAF8F5] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-stone-900 outline-none transition-all focus:border-[#C22B38] dark:border-white/[0.07] dark:bg-[#151820] dark:text-stone-100 dark:focus:border-[#D93846]"
              />
              <button
                type="submit"
                disabled={createCommentMutation.isPending || !newCommentText.trim()}
                className="flex shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-[#C22B38] p-2.5 text-white transition-colors hover:bg-[#a8242f] disabled:opacity-50 dark:bg-[#D93846] dark:hover:bg-[#c22b38]"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )
      )}
      
      {/* Public Profile Modal */}
      <PublicProfileModal userId={profileId} onClose={() => setProfileId(null)} />
      <ReportContentDialog target={reportTarget} onClose={() => setReportTarget(null)} />
    </Dialog>
  )
}
