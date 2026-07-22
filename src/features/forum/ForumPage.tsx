import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessagesSquare, Plus, Pin, MessageSquare, ThumbsUp, ThumbsDown, SlidersHorizontal, ChevronRight, Megaphone, GraduationCap } from 'lucide-react'
import { FACULTIES } from '@/shared/data/campusData'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from '@/features/auth/authStore'
import { useGuard } from '@/features/auth/useGuard'
import { useThreads, useVoteThread, useUserVoteOnThread } from './useForum'
import { CreateThreadModal } from './CreateThreadModal'
import { ThreadDetailModal } from './ThreadDetailModal'
import type { ForumThread } from '@/shared/types/database'

function ThreadCard({ thread, onSelect }: { thread: ForumThread; onSelect: (id: string) => void }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const showToast = useUIStore((s) => s.showToast)
  
  const voteMutation = useVoteThread()
  const { data: userVote = null } = useUserVoteOnThread(thread.id)

  const handleCardVote = (e: React.MouseEvent, val: 1 | -1) => {
    e.stopPropagation()
    if (voteMutation.isPending) return
    if (!user || role === 'guest') {
      showToast(t('auth.loginRequired', 'Debes iniciar sesión con tu correo UDP'))
      return
    }
    voteMutation.mutate({ threadId: thread.id, value: val })
  }

  const netVotes = thread.votes_up - thread.votes_down

  return (
    <div
      onClick={() => onSelect(thread.id)}
      className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 flex flex-col sm:flex-row gap-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden"
    >
      {/* Panel de Votos (Lado Izquierdo en Desktop) */}
      <div className="flex sm:flex-col items-center justify-center gap-1.5 sm:w-12 shrink-0 border-r border-neutral-100 dark:border-neutral-800 sm:pr-4">
        <button
          onClick={(e) => handleCardVote(e, 1)}
          disabled={voteMutation.isPending}
          className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${
            userVote === 1
              ? 'bg-[#D41F2D] text-white'
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-[#D41F2D]'
          }`}
        >
          <ThumbsUp size={14} strokeWidth={2.5} />
        </button>
        <span className={`text-xs font-black sm:w-full text-center ${netVotes > 0 ? 'text-[#D41F2D]' : netVotes < 0 ? 'text-neutral-500' : 'text-neutral-400'}`}>
          {netVotes}
        </span>
        <button
          onClick={(e) => handleCardVote(e, -1)}
          disabled={voteMutation.isPending}
          className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${
            userVote === -1
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <ThumbsDown size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Contenido (Lado Derecho) */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {thread.is_pinned && (
              <span className="bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <Pin size={10} />
                {t('forum.pinned', 'Fijado')}
              </span>
            )}
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              {thread.faculty_id ? thread.faculty_id : t('forum.general', 'General')}
            </span>
          </div>
          <span className="text-[10px] text-neutral-400 font-medium shrink-0">
            {new Date(thread.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </span>
        </div>

        <h3 className="font-bold text-[15px] leading-snug text-neutral-900 dark:text-white hover:text-[#D41F2D] transition-colors line-clamp-1">
          {thread.title}
        </h3>

        <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
          {thread.content}
        </p>

        <div className="flex items-center justify-between gap-4 mt-2 pt-2 border-t border-neutral-50 dark:border-neutral-900/50">
          <span className="text-[10px] text-neutral-400 font-semibold truncate">
            {t('forum.by', 'Por:')} <span className="text-neutral-700 dark:text-neutral-300 font-bold">{thread.author_name}</span>
          </span>
          <div className="flex items-center gap-1.5 text-neutral-400">
            <MessageSquare size={13} />
            <span className="text-xs font-bold">{thread.comment_count ?? 0}</span>
          </div>
        </div>

        {/* Tags */}
        {thread.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {thread.tags.map((tag) => (
              <span
                key={tag}
                className="bg-neutral-50 text-neutral-500 dark:bg-neutral-800/40 dark:text-neutral-400 text-[9px] font-bold px-1.5 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function ForumPage() {
  const { t } = useTranslation()
  const guard = useGuard()

  const [activeFacultyId, setActiveFacultyId] = useState<string | null>(null) // null = General Tab
  const [sortBy, setSortBy] = useState<'recent' | 'top'>('recent')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)

  const { data: threads = [], isLoading, error } = useThreads(activeFacultyId, sortBy)

  const handleCreateClick = () => {
    if (!guard('pin.create.report')) return // Requires student/auth
    setCreateModalOpen(true)
  }



  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden bg-neutral-50 dark:bg-neutral-950 pt-safe">
      
      {/* ── BARRA LATERAL: Selección de Facultad/Tablón ── */}
      <div className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 overflow-y-auto max-h-48 lg:max-h-full">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-900 hidden lg:block">
          <h2 className="text-sm font-black text-neutral-400 uppercase tracking-widest">
            {t('forum.channels', 'Canales / Foros')}
          </h2>
        </div>
        <div className="flex lg:flex-col p-2 gap-2 lg:gap-1 overflow-x-auto lg:overflow-x-visible items-center lg:items-stretch hide-scrollbar">
          <button
            onClick={() => setActiveFacultyId(null)}
            className={`w-max lg:w-full text-left px-3.5 py-1.5 lg:py-2.5 rounded-full lg:rounded-xl text-xs font-bold shrink-0 transition-all flex items-center justify-between gap-2 ${
              activeFacultyId === null
                ? 'bg-[#D41F2D] text-white shadow-sm'
                : 'bg-white lg:bg-transparent border border-neutral-200 lg:border-transparent dark:border-neutral-800 dark:bg-neutral-900 lg:dark:bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <span className="flex items-center gap-1.5"><Megaphone size={14} /> {t('forum.generalTab', 'Tablón General')}</span>
            <ChevronRight size={14} className="opacity-50 hidden lg:block" />
          </button>
          {FACULTIES.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFacultyId(f.id)}
              className={`w-max lg:w-full text-left px-3.5 py-1.5 lg:py-2.5 rounded-full lg:rounded-xl text-xs font-bold shrink-0 transition-all flex items-center justify-between gap-2 truncate ${
                activeFacultyId === f.id
                  ? 'bg-[#D41F2D] text-white shadow-sm'
                  : 'bg-white lg:bg-transparent border border-neutral-200 lg:border-transparent dark:border-neutral-800 dark:bg-neutral-900 lg:dark:bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <span className="truncate flex items-center gap-1.5"><GraduationCap size={14} className="shrink-0" /> {f.name}</span>
              <ChevronRight size={14} className="opacity-50 hidden lg:block" />
            </button>
          ))}
        </div>
      </div>

      {/* ── SECCIÓN CENTRAL: Listado de Hilos ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header / HUD */}
        <div className="p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <MessagesSquare className="text-[#D41F2D]" />
              {activeFacultyId
                ? FACULTIES.find((f) => f.id === activeFacultyId)?.name
                : t('forum.generalTab', 'Tablón General')}
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              {t('forum.desc', 'Foro comunitario para debatir, informar y consultar.')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 h-10 bg-white dark:bg-neutral-900 text-xs font-bold text-neutral-700 dark:text-neutral-300">
              <SlidersHorizontal size={14} className="text-neutral-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'top')}
                className="bg-transparent outline-none cursor-pointer border-none font-bold"
              >
                <option value="recent">{t('forum.sortByRecent', 'Más Recientes')}</option>
                <option value="top">{t('forum.sortByTop', 'Más Votados')}</option>
              </select>
            </div>
            <button
              onClick={handleCreateClick}
              className="flex items-center gap-1.5 bg-[#D41F2D] text-white hover:bg-[#b11a25] font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer h-10"
            >
              <Plus size={16} />
              {t('forum.createThread', 'Crear Hilo')}
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm font-semibold text-neutral-500">
              {t('common.loading')}
            </div>
          ) : error ? (
            <div className="flex h-64 items-center justify-center text-sm font-semibold text-red-500">
              {t('common.error')}
            </div>
          ) : threads.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900/50 rounded-3xl border border-neutral-100 dark:border-neutral-800/80 p-12 text-center text-neutral-400 dark:text-neutral-500 flex flex-col items-center gap-2 max-w-md mx-auto mt-12 shadow-sm">
              <MessagesSquare size={40} strokeWidth={1.5} className="text-neutral-300 dark:text-neutral-700" />
              <h3 className="font-bold text-neutral-700 dark:text-neutral-300 mt-2">
                {t('forum.noThreadsTitle', 'No hay hilos aún')}
              </h3>
              <p className="text-xs">
                {t('forum.noThreadsDesc', '¡Sé el primero en iniciar la conversación publicando una pregunta o anuncio!')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 max-w-4xl">
              {threads.map((thread) => (
                <ThreadCard key={thread.id} thread={thread} onSelect={setSelectedThreadId} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MODALES ── */}
      <CreateThreadModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        defaultFacultyId={activeFacultyId}
      />
      {selectedThreadId && (
        <ThreadDetailModal
          threadId={selectedThreadId}
          onClose={() => setSelectedThreadId(null)}
        />
      )}
    </div>
  )
}
