import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Pin as PinIcon, Trash2, Reply, MessageSquare, ThumbsUp, ThumbsDown, Send } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { PublicProfileModal } from '@/features/profile/PublicProfileModal'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'
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
  onUserClick
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

  const avatarSrc = isCommentOwner && user?.avatarUrl
    ? user.avatarUrl
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        node.author_name ?? 'U'
      )}&background=F3F4F6&color=374151&bold=true`

  const avatarSize = depth > 0 ? 'h-6 w-6' : 'h-7.5 w-7.5'
  const textSize = depth > 0 ? 'text-[11.5px]' : 'text-[12.5px]'
  const nameSize = depth > 0 ? 'text-[12px]' : 'text-[13px]'

  return (
    <div className={`relative flex gap-2.5 ${depth > 0 ? 'mt-2.5' : 'border-b border-neutral-100 dark:border-neutral-900 pb-3 last:border-0'}`}>
      <div className={`mt-0.5 flex ${avatarSize} shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400`}>
        <img src={avatarSrc} alt={node.author_name ?? ''} className="h-full w-full object-cover" loading="lazy" />
      </div>
      
      <div className="flex flex-1 flex-col relative min-w-0">
        <div className="flex items-center gap-1.5 pr-10 flex-wrap">
          <button 
            onClick={() => node.author_id && onUserClick(node.author_id)}
            className={`${nameSize} font-extrabold leading-tight text-neutral-850 dark:text-neutral-100 hover:underline truncate`}
          >
            {node.author_name || 'Estudiante UDP'}
          </button>
          <span className="text-[10px] text-neutral-400 font-medium">
            {new Date(node.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <p className={`mt-0.5 ${textSize} leading-normal text-neutral-700 dark:text-neutral-300 break-words whitespace-pre-line`}>
          {node.content}
        </p>
        
        <div className="absolute right-0 top-0 flex items-center gap-0.5">
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
            className="p-1 -mr-1 -mt-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-700 transition-colors"
            title={t('forum.reply', 'Responder')}
          >
            <Reply size={12} />
          </button>
          {(isCommentOwner || isModerator) && (
            <button
              onClick={() => onDeleteComment(node.id)}
              className="p-1 -mt-1 text-neutral-400 hover:text-red-500 transition-colors"
              title={t('common.delete', 'Eliminar')}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

      {isReplying && (
        <div className="flex flex-col gap-1.5 mt-2 bg-neutral-50 dark:bg-neutral-900/50 p-2 rounded-lg border border-neutral-100 dark:border-neutral-800/80">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={t('forum.replyPlaceholder', 'Escribe tu respuesta...')}
            rows={2}
            autoFocus
            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#D41F2D] transition-colors resize-none"
          />
          <div className="flex justify-end gap-1">
            <button 
              onClick={() => setReplyingToId(null)}
              className="px-2.5 py-1 text-[10px] font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-850 rounded transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => onAddReply(node.id, node.author_name)}
              disabled={!replyText.trim() || isSubmitting}
              className="px-2.5 py-1 text-[10px] font-bold bg-[#D41F2D] hover:bg-[#b11a25] disabled:opacity-50 text-white rounded transition-colors"
            >
              {t('forum.sendReply', 'Responder')}
            </button>
          </div>
        </div>
      )}

      {node.replies.length > 0 && (
        <div className={`flex flex-col mt-1.5 ${depth === 0 ? 'pl-2 border-l border-neutral-200 dark:border-neutral-800' : '-ml-[34px]'}`}>
          {depth === 0 && (
            <button
              type="button"
              onClick={() => setShowAllReplies((current) => !current)}
              className="self-start flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800 transition-colors"
              aria-expanded={showAllReplies}
            >
              {showAllReplies
                ? t('forum.hideReplies', 'Ocultar respuestas')
                : t('forum.replyCount', { count: replyCount, defaultValue: '{{count}} respuestas' })}
              <ChevronDown
                size={14}
                strokeWidth={2.5}
                className={`transition-transform ${showAllReplies ? 'rotate-180' : ''}`}
              />
            </button>
          )}
          {visibleReplies.map((reply) => (
            <CommentItem 
              key={reply.id} 
              node={reply} 
              depth={depth + 1}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              replyText={replyText}
              setReplyText={setReplyText}
              isSubmitting={isSubmitting}
              onAddReply={onAddReply}
              onDeleteComment={onDeleteComment}
              onUserClick={onUserClick}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

export function ThreadDetailModal({ threadId, onClose }: ThreadDetailModalProps) {
  const { t } = useTranslation()
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

  if (!threadId) return null

  const isModerator = role === 'admin' || role === 'moderator'
  const isOwner = thread && user && thread.author_id === user.id

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
      title={thread?.title || t('common.loading')}
      contentClassName="flex flex-col !overflow-hidden max-h-[85dvh] h-[580px] md:h-[620px]"
    >
      {isLoadingThread && !thread ? (
        <div className="flex h-48 items-center justify-center text-sm font-semibold text-neutral-500">
          {t('common.loading')}
        </div>
      ) : (
        thread && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Scrollable Area (Body, Vote bar, Comments) */}
            <div className="flex-1 overflow-y-auto -mx-6 px-6 flex flex-col gap-4 min-h-0 pb-2">
              {/* Header info / Meta */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-900 pb-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black uppercase text-[#D41F2D]">
                      {thread.faculty_id ? thread.faculty_id : t('forum.general', 'General')}
                    </span>
                    {thread.is_pinned && (
                      <span className="bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <PinIcon size={10} />
                        {t('forum.pinned', 'Fijado')}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-semibold">
                    {t('forum.by', 'Por:')} <span className="text-neutral-700 dark:text-neutral-300 font-bold">{thread.author_name}</span> •{' '}
                    {new Date(thread.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </div>
                </div>

                {/* Actions: Pin & Delete */}
                <div className="flex items-center gap-1.5">
                  {isModerator && (
                    <button
                      onClick={handlePinToggle}
                      className={`p-1.5 border rounded-full transition-colors flex items-center justify-center ${
                        thread.is_pinned
                          ? 'border-amber-400 text-amber-500 bg-amber-50/55 dark:bg-amber-950/10'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-amber-500'
                      }`}
                      title={thread.is_pinned ? t('forum.unpin', 'Desfijar') : t('forum.pin', 'Fijar')}
                    >
                      <PinIcon size={14} />
                    </button>
                  )}
                  {(isOwner || isModerator) && (
                    <button
                      onClick={handleDeleteThread}
                      className="p-1.5 border border-neutral-200 dark:border-neutral-700 rounded-full text-neutral-400 hover:text-red-500 hover:border-red-500/20 transition-colors flex items-center justify-center"
                      title={t('common.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Content body */}
              <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line border-b border-neutral-100 dark:border-neutral-900 pb-4">
                {thread.content}
              </p>

              {/* Tags */}
              {thread.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {thread.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Vote Bar */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-stretch overflow-hidden rounded-full border border-neutral-200 dark:border-neutral-700 h-9 bg-neutral-50 dark:bg-neutral-900/50">
                  <button
                    onClick={() => handleVote(1)}
                    disabled={voteMutation.isPending}
                    className={`px-3.5 flex items-center justify-center gap-1.5 transition-colors ${
                      userVote === 1
                        ? 'bg-red-50 text-[#D41F2D] dark:bg-red-950/30 dark:text-red-400'
                        : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <ThumbsUp size={14} strokeWidth={2.5} />
                    <span className="text-[13px] font-bold">{thread.votes_up}</span>
                  </button>
                  <div className="w-px bg-neutral-200 dark:bg-neutral-700" />
                  <button
                    onClick={() => handleVote(-1)}
                    disabled={voteMutation.isPending}
                    className={`px-3.5 flex items-center justify-center gap-1.5 transition-colors ${
                      userVote === -1
                        ? 'bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                        : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <ThumbsDown size={14} strokeWidth={2.5} />
                    <span className="text-[13px] font-bold">{thread.votes_down}</span>
                  </button>
                </div>
              </div>

              {/* Comments Header */}
              <div className="mt-4 border-t border-neutral-100 dark:border-neutral-900 pt-4 flex items-center gap-1 text-sm font-bold text-neutral-800 dark:text-neutral-200">
                <MessageSquare size={16} />
                <span>{t('forum.repliesCount', { defaultValue: 'Respuestas ({{count}})', count: comments.length })}</span>
              </div>

              {/* Comments List */}
              {isLoadingComments ? (
                <div className="text-center py-4 text-xs text-neutral-400">{t('common.loading')}</div>
              ) : commentTree.length === 0 ? (
                <p className="text-xs text-neutral-400 py-4 italic">{t('forum.noComments', 'Sé el primero en responder...')}</p>
              ) : (
                <div className="flex flex-col gap-4">
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
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Fixed Bottom Comment Form */}
            <form 
              onSubmit={handleAddComment} 
              className="flex items-center gap-2 mt-auto pt-3 pb-6 border-t border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 -mx-6 -mb-6 px-6 rounded-b-[24px] z-10 shrink-0"
            >
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={t('forum.addCommentPlaceholder', 'Escribe una respuesta...')}
                className="flex-1 h-9 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 rounded-full px-4 py-2 text-xs outline-none focus:border-[#D41F2D] focus:bg-white dark:focus:bg-neutral-900 transition-all font-medium text-neutral-850 dark:text-neutral-100"
              />
              <button
                type="submit"
                disabled={createCommentMutation.isPending || !newCommentText.trim()}
                className="bg-[#D41F2D] hover:bg-[#b11a25] disabled:bg-neutral-100 dark:disabled:bg-neutral-850 disabled:text-neutral-400 disabled:opacity-50 text-white h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        )
      )}
      
      {/* Public Profile Modal superimposed on top of this one */}
      <PublicProfileModal userId={profileId} onClose={() => setProfileId(null)} />
    </Dialog>
  )
}
