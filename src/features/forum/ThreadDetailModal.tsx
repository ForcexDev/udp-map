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
    <div className={`relative flex gap-3 ${depth > 0 ? 'mt-2.5' : 'border-b border-neutral-100 dark:border-neutral-800/80 pb-3.5 last:border-0'}`}>
      <UserAvatar
        name={node.author_name}
        src={node.author_avatar_url || (isCommentOwner ? user?.avatarUrl : null)}
        className={`mt-0.5 ${avatarSize} text-2xl shrink-0`}
      />
      
      <div className="flex flex-1 flex-col relative min-w-0">
        {/* Author + Timestamp */}
        <div className="flex items-center justify-between gap-2 pr-1">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => node.author_id && onUserClick(node.author_id)}
              className="text-[13.5px] font-extrabold leading-tight text-neutral-900 dark:text-neutral-100 hover:underline text-left"
            >
              {node.author_name || 'Estudiante UDP'}
            </button>
            <span className="text-[10.5px] text-neutral-400 font-medium shrink-0">
              {relTime.value === 0 ? 'Ahora' : `hace ${relTime.value} ${relTime.unit === 'day' ? 'd' : relTime.unit === 'hour' ? 'h' : 'min'}`}
            </span>
          </div>

          {/* Quick Actions (Reply, Report, Delete) */}
          <div className="flex items-center gap-1 shrink-0">
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
              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors rounded-lg cursor-pointer"
              title={t('forum.reply', 'Responder')}
            >
              <Reply size={13} />
            </button>
            {user && !isCommentOwner && role !== 'guest' && (
              <button
                onClick={() => onReport({ type: 'forum_comment', id: node.id })}
                className="p-1 text-neutral-400 hover:text-[#D41F2D] transition-colors rounded-lg cursor-pointer"
                title="Reportar respuesta"
              >
                <Flag size={13} />
              </button>
            )}
            {(isCommentOwner || isModerator) && (
              <button
                onClick={() => onDeleteComment(node.id)}
                className="p-1 text-neutral-400 hover:text-red-500 transition-colors rounded-lg cursor-pointer"
                title={t('common.delete', 'Eliminar')}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <p className="mt-1 text-[13.5px] leading-snug text-neutral-800 dark:text-neutral-200 break-words whitespace-pre-line">
          {node.content}
        </p>

        {/* Inline Reply Form */}
        {isReplying && (
          <div className="flex flex-col gap-2 mt-2.5 bg-neutral-50 dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t('forum.replyPlaceholder', 'Escribe tu respuesta...')}
              rows={2}
              autoFocus
              className="w-full bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#D41F2D] transition-all resize-none font-medium text-neutral-900 dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setReplyingToId(null)}
                className="px-3 py-1 text-xs font-bold text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => onAddReply(node.id, node.author_name)}
                disabled={!replyText.trim() || isSubmitting}
                className="px-3.5 py-1 text-xs font-bold bg-[#D41F2D] hover:bg-[#b11a25] disabled:opacity-50 text-white rounded-full transition-colors shadow-sm cursor-pointer"
              >
                {t('forum.sendReply', 'Responder')}
              </button>
            </div>
          </div>
        )}

        {/* Nested Replies Tree (Left Aligned starting near root avatar - Red Line Alignment) */}
        {node.replies.length > 0 && (
          <div className={`flex flex-col mt-2 ${depth === 0 ? '-ml-7 sm:-ml-8 pl-2 space-y-2' : ''}`}>
            {depth === 0 && (
              <button
                type="button"
                onClick={() => setShowAllReplies((current) => !current)}
                className="self-start flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold text-neutral-600 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors my-1 cursor-pointer"
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
      contentClassName="!bg-white dark:!bg-neutral-900 sm:max-w-xl flex flex-col !overflow-hidden h-[90dvh] max-h-[90dvh] sm:h-[650px] sm:max-h-[85dvh] !rounded-t-[28px] sm:!rounded-2xl max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:top-auto max-sm:w-full"
    >
      {isLoadingThread && !thread ? (
        <div className="flex h-48 items-center justify-center text-sm font-semibold text-neutral-500">
          {t('common.loading')}
        </div>
      ) : (
        thread && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Scrollable Area (Body, Vote bar, Comments) */}
            <div className="flex-1 overflow-y-auto -mx-6 px-6 flex flex-col gap-4 min-h-0 pb-20">
              {/* Header info / Meta */}
              <div className="flex items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    name={thread.author_name}
                    src={thread.author_avatar_url || (user && user.id === thread.author_id ? user.avatarUrl : null)}
                    className="h-10 w-10 text-3xl shrink-0 cursor-pointer"
                    onClick={() => thread.author_id && setProfileId(thread.author_id)}
                  />
                  <div className="flex flex-col min-w-0">
                    <button
                      onClick={() => thread.author_id && setProfileId(thread.author_id)}
                      className="text-[14px] font-extrabold text-neutral-900 dark:text-neutral-100 text-left hover:underline"
                    >
                      <span className="flex items-center gap-1.5">
                        {thread.is_official
                          ? (thread.official_entity_name || t('pin.officialEntityDefault', 'Administración UDP'))
                          : (thread.author_name || 'Estudiante UDP')}
                        {thread.is_official && <BadgeCheck size={15} className="text-blue-500" aria-label={t('forum.official', 'Oficial')} />}
                      </span>
                    </button>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-medium flex-wrap">
                      <span>{relTime ? (relTime.value === 0 ? 'Ahora' : `hace ${relTime.value} ${relTime.unit === 'day' ? 'd' : relTime.unit === 'hour' ? 'h' : 'min'}`) : ''}</span>
                      <span>•</span>
                      <span className="font-extrabold text-[#D41F2D]">
                        {faculty ? localizedName(faculty, i18n.language) : t('forum.general', 'General')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions: Pin, Delete, Report */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {thread.is_pinned && (
                    <span className="bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200 dark:border-amber-800/50">
                      <PinIcon size={10} />
                      Fijado
                    </span>
                  )}
                  {user && !isOwner && role !== 'guest' && (
                    <button
                      onClick={() => setReportTarget({ type: 'forum_thread', id: thread.id })}
                      className="w-9 h-9 border border-neutral-200 dark:border-neutral-700 rounded-full text-neutral-500 hover:text-red-500 hover:border-red-300 dark:hover:border-red-800 transition-colors flex items-center justify-center cursor-pointer"
                      title="Reportar hilo"
                    >
                      <Flag size={15} />
                    </button>
                  )}
                  {isModerator && (
                    <button
                      onClick={handlePinToggle}
                      className={`w-9 h-9 border rounded-full transition-colors flex items-center justify-center cursor-pointer ${
                        thread.is_pinned
                          ? 'border-amber-400 text-amber-500 bg-amber-50 dark:bg-amber-950/20'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-amber-500'
                      }`}
                      title={thread.is_pinned ? t('forum.unpin', 'Desfijar') : t('forum.pin', 'Fijar')}
                    >
                      <PinIcon size={15} />
                    </button>
                  )}
                  {(isOwner || isModerator) && (
                    <button
                      onClick={handleDeleteThread}
                      className="w-9 h-9 border border-neutral-200 dark:border-neutral-700 rounded-full text-neutral-500 hover:text-red-500 hover:border-red-300 dark:hover:border-red-800 transition-colors flex items-center justify-center cursor-pointer"
                      title={t('common.delete')}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Title & Structured Description Block (Matching PinDetail) */}
              <div className="space-y-3">
                <h2 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white leading-tight">
                  {thread.title}
                </h2>
                {thread.content && (
                  <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 p-4 border border-neutral-100 dark:border-neutral-700/60">
                    <span className="block mb-1 text-[10px] font-black uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                      {t('forum.description', 'DESCRIPCIÓN')}
                    </span>
                    <p className="text-[13.5px] sm:text-[14px] leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-line font-normal">
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
                      className="bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
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
                  className="flex items-stretch overflow-hidden rounded-full border border-neutral-200 dark:border-neutral-700 h-9 bg-neutral-50 dark:bg-neutral-900/50"
                >
                  <button
                    type="button"
                    onClick={() => handleVote(1)}
                    disabled={voteMutation.isPending}
                    className={`px-4 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      userVote === 1
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <ThumbsUp size={14} strokeWidth={2.5} />
                    <span>{thread.votes_up}</span>
                  </button>
                  <div className="w-px bg-neutral-200 dark:bg-neutral-700" />
                  <button
                    type="button"
                    onClick={() => handleVote(-1)}
                    disabled={voteMutation.isPending}
                    className={`px-4 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      userVote === -1
                        ? 'bg-red-50 text-[#D41F2D] dark:bg-red-950/30 dark:text-red-400'
                        : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <ThumbsDown size={14} strokeWidth={2.5} />
                    <span>{thread.votes_down}</span>
                  </button>
                </div>
              </div>

              {/* Comments Section Header (Matching PinDetail) */}
              <div className="mt-4 border-t border-neutral-100 dark:border-neutral-800 pt-4 flex items-center justify-between">
                <h3 className="text-[16px] sm:text-[17px] font-extrabold text-neutral-900 dark:text-neutral-100">
                  {t('forum.repliesCount', { defaultValue: 'Comentarios ({{count}})', count: comments.length })}
                </h3>
              </div>

              {/* Comments List */}
              {isLoadingComments ? (
                <div className="text-center py-6 text-xs font-semibold text-neutral-400">{t('common.loading')}</div>
              ) : commentTree.length === 0 ? (
                <p className="text-xs text-neutral-400 py-6 text-center italic">{t('forum.noComments', 'Sé el primero en comentar...')}</p>
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
              className="flex items-center gap-2 mt-auto pt-3.5 pb-4 border-t border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 -mx-6 -mb-6 px-6 rounded-b-[28px] sm:rounded-b-2xl z-10 shrink-0 overflow-hidden"
            >
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={t('forum.addCommentPlaceholder', 'Escribe un comentario...')}
                className="min-w-0 flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 px-3 py-2 text-sm outline-none focus:border-[#D41F2D] font-medium text-neutral-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={createCommentMutation.isPending || !newCommentText.trim()}
                className="rounded-lg bg-[#D41F2D] p-2.5 text-white hover:bg-[#b11a25] disabled:opacity-50 transition-colors shrink-0 cursor-pointer flex items-center justify-center"
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
