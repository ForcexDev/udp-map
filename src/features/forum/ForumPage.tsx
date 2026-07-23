import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, MessagesSquare, Plus, Pin, MessageSquare, ThumbsUp, ThumbsDown, SlidersHorizontal, ChevronRight, ChevronDown, Megaphone, GraduationCap, Search } from 'lucide-react'
import { FACULTIES } from '@/shared/data/campusData'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from '@/features/auth/authStore'
import { useGuard } from '@/features/auth/useGuard'
import { useThreads, useVoteThread, useUserVoteOnThread } from './useForum'
import { CreateThreadModal } from './CreateThreadModal'
import { ThreadDetailModal } from './ThreadDetailModal'
import { Dialog } from '@/shared/ui/Dialog'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import type { ForumThread } from '@/shared/types/database'

import { UserAvatar } from '@/shared/ui/UserAvatar'
import { relativeTime } from '@/shared/utils/datetime'

function ThreadCard({ thread, onSelect }: { thread: ForumThread; onSelect: (id: string) => void }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const showToast = useUIStore((s) => s.showToast)
  
  const voteMutation = useVoteThread()
  const { data: userVote = null } = useUserVoteOnThread(thread.id)

  const relTime = relativeTime(thread.created_at)

  const handleCardVote = (e: React.MouseEvent, val: 1 | -1) => {
    e.stopPropagation()
    if (voteMutation.isPending) return
    if (!user || role === 'guest') {
      showToast(t('auth.loginRequired', 'Debes iniciar sesión con tu correo UDP'))
      return
    }
    voteMutation.mutate({ threadId: thread.id, value: val })
  }

  const faculty = FACULTIES.find((f) => f.id === thread.faculty_id)

  return (
    <div
      onClick={() => onSelect(thread.id)}
      className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-4 sm:p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all cursor-pointer relative group"
    >
      {/* Header: Author Avatar + Name + Relative Time + Category Badge */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <UserAvatar
            name={thread.author_name}
            src={thread.author_avatar_url || (user && user.id === thread.author_id ? user.avatarUrl : null)}
            className="h-8.5 w-8.5 text-2xl shrink-0"
          />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[13.5px] font-extrabold text-neutral-900 dark:text-neutral-100 leading-tight">
              <span className="flex items-center gap-1.5 truncate">
                {thread.is_official
                  ? (thread.official_entity_name || t('pin.officialEntityDefault', 'Administración UDP'))
                  : (thread.author_name || 'Estudiante UDP')}
                {thread.is_official && <BadgeCheck size={14} className="text-blue-500 shrink-0" aria-label={t('forum.official', 'Oficial')} />}
              </span>
            </span>
            <span className="text-[10px] text-neutral-400 font-medium leading-none mt-0.5">
              {relTime.value === 0 ? 'Ahora' : `hace ${relTime.value} ${relTime.unit === 'day' ? 'd' : relTime.unit === 'hour' ? 'h' : 'min'}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {thread.is_pinned && (
            <span className="bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200 dark:border-amber-800/50 shrink-0">
              <Pin size={10} />
              {t('forum.pinned', 'Fijado')}
            </span>
          )}
          <span className="bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full whitespace-nowrap">
            {faculty ? faculty.name.replace('Facultad de ', '') : t('forum.general', 'General')}
          </span>
        </div>
      </div>

      {/* Body: Title & Content */}
      <div className="space-y-1">
        <h3 className="font-extrabold text-[15px] sm:text-[16px] leading-snug text-neutral-900 dark:text-white group-hover:text-[#D41F2D] transition-colors line-clamp-2">
          {thread.title}
        </h3>
        {thread.content && (
          <p className="text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
            {thread.content}
          </p>
        )}
      </div>

      {/* Tags */}
      {thread.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {thread.tags.map((tag) => (
            <span
              key={tag}
              className="bg-neutral-100 text-neutral-600 dark:bg-neutral-800/70 dark:text-neutral-400 text-[10px] font-bold px-2 py-0.5 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Vote Segment + Comment Count */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800/60 mt-1">
        {/* Unified Vote Segment (Matching PinDetail) */}
        <div
          role="group"
          aria-label={t('forum.voteGroup', 'Votar hilo')}
          onClick={(e) => e.stopPropagation()}
          className="flex items-stretch overflow-hidden rounded-full border border-neutral-200 dark:border-neutral-700 h-8 bg-neutral-50 dark:bg-neutral-900/50"
        >
          <button
            type="button"
            onClick={(e) => handleCardVote(e, 1)}
            disabled={voteMutation.isPending}
            className={`px-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
              userVote === 1
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
            }`}
          >
            <ThumbsUp size={13} strokeWidth={2.5} />
            <span>{thread.votes_up}</span>
          </button>
          <div className="w-px bg-neutral-200 dark:bg-neutral-700" />
          <button
            type="button"
            onClick={(e) => handleCardVote(e, -1)}
            disabled={voteMutation.isPending}
            className={`px-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
              userVote === -1
                ? 'bg-red-50 text-[#D41F2D] dark:bg-red-950/30 dark:text-red-400'
                : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
            }`}
          >
            <ThumbsDown size={13} strokeWidth={2.5} />
            <span>{thread.votes_down}</span>
          </button>
        </div>

        {/* Comment Count Chip */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-300 text-xs font-bold">
          <MessageSquare size={13} className="text-neutral-400" />
          <span>{thread.comment_count ?? 0}</span>
          <span className="hidden sm:inline font-semibold text-neutral-400 text-[11px] ml-0.5">respuestas</span>
        </div>
      </div>
    </div>
  )
}

export function ForumPage() {
  const { t } = useTranslation()
  const guard = useGuard()
  const showToast = useUIStore((s) => s.showToast)
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeFacultyId, setActiveFacultyId] = useState<string | null>(null) // null = General Tab
  const [sortBy, setSortBy] = useState<'recent' | 'top'>('recent')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [channelDrawerOpen, setChannelDrawerOpen] = useState(false)
  const [channelSearch, setChannelSearch] = useState('')
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(() => searchParams.get('thread'))

  const [lastVisitedMap, setLastVisitedMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('udp_map_forum_last_visited')
      return saved ? (JSON.parse(saved) as Record<string, string>) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    const linkedThread = searchParams.get('thread')
    if (linkedThread) setSelectedThreadId(linkedThread)
  }, [searchParams])

  const markChannelVisited = (channelId: string | null) => {
    const key = channelId || 'general'
    const nowIso = new Date().toISOString()
    setLastVisitedMap((prev) => {
      const next = { ...prev, [key]: nowIso }
      try {
        localStorage.setItem('udp_map_forum_last_visited', JSON.stringify(next))
      } catch (err) {
        void err
      }
      return next
    })
  }

  // Actualizar marca de lectura al cambiar de canal activo
  useEffect(() => {
    markChannelVisited(activeFacultyId)
  }, [activeFacultyId])

  const closeThread = () => {
    setSelectedThreadId(null)
    if (searchParams.has('thread')) {
      const next = new URLSearchParams(searchParams)
      next.delete('thread')
      setSearchParams(next, { replace: true })
    }
  }

  // Fetch todos los hilos recientes para calcular los puntos de lectura
  const { data: allRecentThreads = [] } = useThreads(null, 'recent')
  const { data: threads = [], isLoading, error } = useThreads(activeFacultyId, sortBy)

  // Map de canal -> boolean (true si hay un hilo no visto en ese canal)
  const recentActivityMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    const latestThreadByChannel: Record<string, string> = {}

    allRecentThreads.forEach((t) => {
      const key = t.faculty_id || 'general'
      if (!latestThreadByChannel[key] || new Date(t.created_at) > new Date(latestThreadByChannel[key])) {
        latestThreadByChannel[key] = t.created_at
      }
    })

    const currentActiveKey = activeFacultyId || 'general'

    Object.keys(latestThreadByChannel).forEach((key) => {
      const threadTime = new Date(latestThreadByChannel[key]).getTime()
      const visitedTime = lastVisitedMap[key] ? new Date(lastVisitedMap[key]).getTime() : 0

      if (threadTime > visitedTime && currentActiveKey !== key) {
        map[key] = true
      }
    })

    return map
  }, [allRecentThreads, lastVisitedMap, activeFacultyId])

  const handleCreateClick = () => {
    if (!guard('forum.post')) return
    setCreateModalOpen(true)
  }

  const filteredFaculties = useMemo(() => {
    if (!channelSearch.trim()) return FACULTIES
    const query = channelSearch.toLowerCase()
    return FACULTIES.filter((f) => f.name.toLowerCase().includes(query))
  }, [channelSearch])

  const activeChannelName = activeFacultyId
    ? FACULTIES.find((f) => f.id === activeFacultyId)?.name
    : t('forum.generalTab', 'Tablón General')

  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden bg-neutral-50 dark:bg-neutral-950 pt-safe">
      
      {/* ── BARRA LATERAL (PC Deskop) ── */}
      <div className="hidden lg:flex w-72 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 flex-col overflow-y-auto">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-900">
          <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest">
            {t('forum.channels', 'Canales / Foros')}
          </h2>
        </div>
        <div className="flex flex-col p-2 gap-1 overflow-y-auto">
          <button
            onClick={() => setActiveFacultyId(null)}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
              activeFacultyId === null
                ? 'bg-[#D41F2D] text-white shadow-sm'
                : 'bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Megaphone size={15} /> 
              {t('forum.generalTab', 'Tablón General')}
              {recentActivityMap['general'] && activeFacultyId !== null && (
                <span className="h-2 w-2 rounded-full bg-[#D41F2D] animate-pulse shrink-0" title="Publicaciones recientes" />
              )}
            </span>
            <ChevronRight size={14} className="opacity-50" />
          </button>

          {FACULTIES.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFacultyId(f.id)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                activeFacultyId === f.id
                  ? 'bg-[#D41F2D] text-white shadow-sm'
                  : 'bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <span className="truncate flex items-center gap-2">
                <GraduationCap size={15} className="shrink-0" /> 
                {f.name}
                {recentActivityMap[f.id] && activeFacultyId !== f.id && (
                  <span className="h-2 w-2 rounded-full bg-[#D41F2D] animate-pulse shrink-0" title="Publicaciones recientes" />
                )}
              </span>
              <ChevronRight size={14} className="opacity-50" />
            </button>
          ))}
        </div>
      </div>

      {/* ── BARRA SELECTORA DE CANAL EN MÓVIL (Reemplazo de Píldoras Cortadas) ── */}
      <div className="lg:hidden p-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-2">
        <button
          onClick={() => setChannelDrawerOpen(true)}
          className="flex-1 flex items-center justify-between bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold text-neutral-900 dark:text-white transition-all cursor-pointer border border-neutral-200 dark:border-neutral-700/60 shadow-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            {activeFacultyId === null ? (
              <Megaphone size={16} className="text-[#D41F2D] shrink-0" />
            ) : (
              <GraduationCap size={16} className="text-[#D41F2D] shrink-0" />
            )}
            <span className="truncate text-[13px]">{activeChannelName}</span>
            {recentActivityMap[activeFacultyId || 'general'] && (
              <span className="h-2 w-2 rounded-full bg-[#D41F2D] animate-pulse shrink-0" title="Hilo nuevo reciente" />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 text-[11px] font-bold shrink-0 ml-2">
            <span>Cambiar foro</span>
            <ChevronDown size={14} />
          </div>
        </button>
      </div>

      {/* ── SECCIÓN CENTRAL: Listado de Hilos ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header / HUD */}
        <div className="p-3.5 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/20 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="hidden lg:flex text-xl sm:text-2xl font-black text-neutral-900 dark:text-white items-center gap-2">
              <MessagesSquare className="text-[#D41F2D]" />
              {activeChannelName}
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              {t('forum.desc', 'Foro comunitario para debatir, informar y consultar.')}
            </p>
          </div>
          
          <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
            {/* Sort Dropdown (CustomSelect Capsule Button) */}
            <CustomSelect
              options={[
                { value: 'recent', label: t('forum.sortByRecent', 'Más Recientes'), icon: <SlidersHorizontal size={13} className="text-neutral-400" /> },
                { value: 'top', label: t('forum.sortByTop', 'Más Votados'), icon: <SlidersHorizontal size={13} className="text-neutral-400" /> },
              ]}
              value={sortBy}
              onChange={(val) => setSortBy(val as 'recent' | 'top')}
              buttonClassName="!rounded-full !h-9 !px-3.5 !py-0 !border-neutral-200 dark:!border-neutral-700/80 !bg-white dark:!bg-neutral-900 text-xs font-bold"
            />

            {/* Create Thread Button (Sleek Capsule Button matching Eventos) */}
            <button
              onClick={handleCreateClick}
              className="flex items-center justify-center gap-1.5 bg-[#D41F2D] text-white hover:bg-[#b11a25] font-bold text-xs uppercase tracking-wider px-4 h-9 rounded-full shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Plus size={15} />
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
        onCreated={(newThread) => {
          const targetFaculty = newThread.faculty_id
          markChannelVisited(targetFaculty)
          setActiveFacultyId(targetFaculty)
          setSelectedThreadId(newThread.id)
          const targetName = targetFaculty
            ? (FACULTIES.find((f) => f.id === targetFaculty)?.name ?? 'Facultad')
            : t('forum.generalTab', 'Tablón General')
          showToast(`Hilo publicado exitosamente en ${targetName}`)
        }}
      />
      {selectedThreadId && (
        <ThreadDetailModal
          threadId={selectedThreadId}
          onClose={closeThread}
        />
      )}

      {/* ── MODAL SELECTOR DE CANALES EN MÓVIL ── */}
      <Dialog
        open={channelDrawerOpen}
        onOpenChange={setChannelDrawerOpen}
        title={t('forum.selectChannel', 'Seleccionar Foro / Facultad')}
        contentClassName="!bg-white dark:!bg-neutral-900 flex flex-col max-h-[85dvh] sm:max-w-md"
      >
        <div className="flex flex-col gap-3 py-2">
          {/* Buscador de Canales */}
          <div className="relative flex items-center">
            <Search size={15} className="absolute left-3 text-neutral-400" />
            <input
              type="text"
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder="Buscar facultad..."
              className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-[#D41F2D] transition-all"
            />
          </div>

          {/* Lista de Canales / Facultades */}
          <div className="flex flex-col gap-1 max-h-[55dvh] overflow-y-auto pr-1">
            {/* Tablón General */}
            <button
              onClick={() => {
                setActiveFacultyId(null)
                setChannelDrawerOpen(false)
              }}
              className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                activeFacultyId === null
                  ? 'bg-[#D41F2D] text-white shadow-sm'
                  : 'bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200'
              }`}
            >
              <span className="flex items-center gap-2 font-extrabold text-[13px]">
                <Megaphone size={16} /> Tablón General
              </span>
              {recentActivityMap['general'] && activeFacultyId !== null && (
                <span className="h-2.5 w-2.5 rounded-full bg-[#D41F2D] animate-pulse" title="Hilo nuevo" />
              )}
            </button>

            {/* Facultades */}
            {filteredFaculties.map((f: (typeof FACULTIES)[number]) => {
              const isActive = activeFacultyId === f.id
              const hasNew = recentActivityMap[f.id]
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setActiveFacultyId(f.id)
                    setChannelDrawerOpen(false)
                  }}
                  className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-[#D41F2D] text-white shadow-sm'
                      : 'bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <span className="flex items-center gap-2 font-bold truncate text-[12.5px]">
                    <GraduationCap size={16} className="shrink-0" /> {f.name}
                  </span>
                  {hasNew && !isActive && (
                    <span className="h-2.5 w-2.5 rounded-full bg-[#D41F2D] animate-pulse shrink-0" title="Hilo nuevo" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </Dialog>
    </div>
  )
}
