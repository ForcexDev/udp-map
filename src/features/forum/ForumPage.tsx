import { localizedName } from '@/shared/utils/localized'
import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BadgeCheck,
  MessagesSquare,
  Plus,
  Pin,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  Megaphone,
  GraduationCap,
  Search,
} from 'lucide-react'
import { useFaculties } from '@/shared/data/facultyStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from '@/features/auth/authStore'
import { useGuard } from '@/features/auth/useGuard'
import { useThreads, useVoteThread, useUserVoteOnThread } from './useForum'
import { CreateThreadModal } from './CreateThreadModal'
import { ThreadDetailModal } from './ThreadDetailModal'
import { Dialog } from '@/shared/ui/Dialog'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import type { Faculty, ForumThread } from '@/shared/types/database'

import { UserAvatar } from '@/shared/ui/UserAvatar'
import { relativeTime } from '@/shared/utils/datetime'

function ThreadCard({ thread, onSelect }: { thread: ForumThread; onSelect: (id: string) => void }) {
  const { t, i18n } = useTranslation()
  const faculties = useFaculties()
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

  const faculty = faculties.find((f) => f.id === thread.faculty_id)

  return (
    <div
      onClick={() => onSelect(thread.id)}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-[#E6E0D5] bg-white p-4 shadow-xs transition-all hover:shadow-md sm:p-5 dark:border-white/[0.07] dark:bg-[#1E222D]"
    >
      {/* Header: Author Avatar + Name + Relative Time + Category Badge */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <UserAvatar
            name={thread.author_name}
            src={
              thread.author_avatar_url ||
              (user && user.id === thread.author_id ? user.avatarUrl : null)
            }
            className="h-8.5 w-8.5 text-2xl shrink-0"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13.5px] font-bold leading-tight text-stone-900 dark:text-stone-100">
              <span className="flex items-center gap-1.5 truncate">
                {thread.is_official
                  ? thread.official_entity_name ||
                    t('pin.officialEntityDefault', 'Administración UDP')
                  : thread.author_name || 'Estudiante UDP'}
                {thread.is_official && (
                  <BadgeCheck
                    size={14}
                    className="text-blue-500 shrink-0"
                    aria-label={t('forum.official', 'Oficial')}
                  />
                )}
              </span>
            </span>
            <span className="mt-0.5 text-[11px] font-medium leading-none text-stone-400 dark:text-stone-500">
              {relTime.value === 0
                ? 'Ahora'
                : `hace ${relTime.value} ${relTime.unit === 'day' ? 'd' : relTime.unit === 'hour' ? 'h' : 'min'}`}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {thread.is_pinned && (
            <span className="flex shrink-0 items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-400">
              <Pin size={11} />
              {t('forum.pinned', 'Fijado')}
            </span>
          )}
          <span className="rounded-xl bg-[#EFECE4] px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-stone-700 dark:bg-white/[0.08] dark:text-stone-300">
            {faculty
              ? localizedName(faculty, i18n.language).replace(/^Facultad de |^Faculty of /, '')
              : t('forum.general', 'General')}
          </span>
        </div>
      </div>

      {/* Body: Title & Content */}
      <div className="space-y-1">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-stone-900 transition-colors group-hover:text-[#C22B38] sm:text-[16px] dark:text-stone-100 dark:group-hover:text-[#D93846]">
          {thread.title}
        </h3>
        {thread.content && (
          <p className="line-clamp-2 text-xs leading-relaxed text-stone-600 sm:text-[13px] dark:text-stone-400">
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
              className="rounded-xl bg-[#EFECE4] px-2.5 py-0.5 text-xs font-medium text-stone-700 dark:bg-white/[0.08] dark:text-stone-300"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Vote Segment + Comment Count */}
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-[#E5DEC9] pt-2.5 dark:border-white/10">
        {/* Unified Vote Segment (Matching PinDetail) */}
        <div
          role="group"
          aria-label={t('forum.voteGroup', 'Votar hilo')}
          onClick={(e) => e.stopPropagation()}
          className="flex h-8 items-stretch overflow-hidden rounded-xl border border-[#E6E0D5] bg-[#FAF8F5] dark:border-white/[0.07] dark:bg-[#151820]"
        >
          <button
            type="button"
            onClick={(e) => handleCardVote(e, 1)}
            disabled={voteMutation.isPending}
            className={`flex cursor-pointer items-center justify-center gap-1.5 px-3 text-xs font-semibold transition-colors ${
              userVote === 1
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'text-stone-500 hover:bg-[#EFECE4] dark:text-stone-400 dark:hover:bg-white/[0.08]'
            }`}
          >
            <ThumbsUp size={13} strokeWidth={2.2} />
            <span className="tabular-nums">{thread.votes_up}</span>
          </button>
          <div className="w-px bg-[#E6E0D5] dark:bg-white/[0.07]" />
          <button
            type="button"
            onClick={(e) => handleCardVote(e, -1)}
            disabled={voteMutation.isPending}
            className={`flex cursor-pointer items-center justify-center gap-1.5 px-3 text-xs font-semibold transition-colors ${
              userVote === -1
                ? 'border border-[#F2D0CE] bg-[#FBECEB] text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300'
                : 'text-stone-500 hover:bg-[#EFECE4] dark:text-stone-400 dark:hover:bg-white/[0.08]'
            }`}
          >
            <ThumbsDown size={13} strokeWidth={2.2} />
            <span className="tabular-nums">{thread.votes_down}</span>
          </button>
        </div>

        {/* Comment Count Chip */}
        <div className="flex items-center gap-1.5 rounded-xl bg-[#EFECE4] px-3 py-1 text-xs font-semibold text-stone-700 dark:bg-white/[0.08] dark:text-stone-300">
          <MessageSquare size={13} className="text-stone-400 dark:text-stone-500" />
          <span className="tabular-nums">{thread.comment_count ?? 0}</span>
          <span className="ml-0.5 hidden text-[11px] font-medium text-stone-500 sm:inline dark:text-stone-400">
            respuestas
          </span>
        </div>
      </div>
    </div>
  )
}

export function ForumPage() {
  const { t, i18n } = useTranslation()
  const faculties = useFaculties()
  const guard = useGuard()
  const showToast = useUIStore((s) => s.showToast)
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeFacultyId, setActiveFacultyId] = useState<string | null>(null) // null = General Tab
  const [sortBy, setSortBy] = useState<'recent' | 'top'>('recent')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [channelDrawerOpen, setChannelDrawerOpen] = useState(false)
  const [channelSearch, setChannelSearch] = useState('')
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(() =>
    searchParams.get('thread'),
  )

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
      if (
        !latestThreadByChannel[key] ||
        new Date(t.created_at) > new Date(latestThreadByChannel[key])
      ) {
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
    if (!channelSearch.trim()) return faculties
    const query = channelSearch.toLowerCase()
    return faculties.filter((f) => localizedName(f, i18n.language).toLowerCase().includes(query))
    // `i18n.language` entra en las dependencias: al cambiar de idioma, buscar
    // "engineering" tiene que encontrar lo que en español era "ingeniería".
  }, [faculties, channelSearch, i18n.language])

  const activeChannelName = activeFacultyId
    ? faculties.find((f) => f.id === activeFacultyId)?.name
    : t('forum.generalTab', 'Tablón General')

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#FAF8F5] pt-safe lg:flex-row dark:bg-[#151820]">
      {/* ── BARRA LATERAL (PC Deskop) ── */}
      <div className="hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-[#E5DEC9] bg-white lg:flex dark:border-white/10 dark:bg-[#1E222D]/60">
        <div className="border-b border-[#E5DEC9] p-4 dark:border-white/10">
          <h2 className="text-xs font-bold text-stone-500 dark:text-stone-400">
            {t('forum.channels', 'Canales / Foros')}
          </h2>
        </div>
        <div className="flex flex-col gap-1 overflow-y-auto p-2">
          <button
            onClick={() => setActiveFacultyId(null)}
            className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-left text-xs font-semibold transition-all ${
              activeFacultyId === null
                ? 'bg-[#C22B38] text-white shadow-xs dark:bg-[#D93846]'
                : 'bg-transparent text-stone-700 hover:bg-[#EFECE4] dark:text-stone-300 dark:hover:bg-white/[0.08]'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Megaphone size={15} />
              {t('forum.generalTab', 'Tablón General')}
              {recentActivityMap['general'] && activeFacultyId !== null && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-[#C22B38] animate-pulse dark:bg-[#D93846]"
                  title="Publicaciones recientes"
                />
              )}
            </span>
            <ChevronRight size={14} className="opacity-50" />
          </button>

          {faculties.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFacultyId(f.id)}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-left text-xs font-semibold transition-all ${
                activeFacultyId === f.id
                  ? 'bg-[#C22B38] text-white shadow-xs dark:bg-[#D93846]'
                  : 'bg-transparent text-stone-700 hover:bg-[#EFECE4] dark:text-stone-300 dark:hover:bg-white/[0.08]'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <GraduationCap size={15} className="shrink-0" />
                {localizedName(f, i18n.language)}
                {recentActivityMap[f.id] && activeFacultyId !== f.id && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-[#C22B38] animate-pulse dark:bg-[#D93846]"
                    title="Publicaciones recientes"
                  />
                )}
              </span>
              <ChevronRight size={14} className="opacity-50" />
            </button>
          ))}
        </div>
      </div>

      {/* ── BARRA SELECTORA DE CANAL EN MÓVIL (Reemplazo de Píldoras Cortadas) ── */}
      <div className="flex items-center justify-between gap-2 border-b border-[#E5DEC9] bg-white p-3 lg:hidden dark:border-white/10 dark:bg-[#1E222D]">
        <button
          onClick={() => setChannelDrawerOpen(true)}
          className="flex flex-1 cursor-pointer items-center justify-between rounded-2xl border border-[#E6E0D5] bg-[#FAF8F5] px-3.5 py-2.5 text-xs font-semibold text-stone-900 shadow-xs transition-all hover:bg-[#EFECE4] dark:border-white/[0.07] dark:bg-[#151820] dark:text-stone-100 dark:hover:bg-white/[0.08]"
        >
          <div className="flex min-w-0 items-center gap-2">
            {activeFacultyId === null ? (
              <Megaphone size={16} className="shrink-0 text-[#C22B38] dark:text-[#D93846]" />
            ) : (
              <GraduationCap size={16} className="shrink-0 text-[#C22B38] dark:text-[#D93846]" />
            )}
            <span className="truncate text-[13px]">{activeChannelName}</span>
            {recentActivityMap[activeFacultyId || 'general'] && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[#C22B38] animate-pulse dark:bg-[#D93846]"
                title="Hilo nuevo reciente"
              />
            )}
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400">
            <span>Cambiar foro</span>
            <ChevronDown size={14} />
          </div>
        </button>
      </div>

      {/* ── SECCIÓN CENTRAL: Listado de Hilos ── */}
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Header / HUD */}
        <div className="flex flex-col justify-between gap-3 border-b border-[#E5DEC9] bg-white p-3.5 sm:p-5 lg:flex-row lg:items-center dark:border-white/10 dark:bg-[#1E222D]/30">
          <div>
            <h1 className="hidden items-center gap-2 text-xl font-bold tracking-tight text-stone-900 sm:text-2xl lg:flex dark:text-stone-100">
              <MessagesSquare className="text-[#C22B38] dark:text-[#D93846]" />
              {activeChannelName}
            </h1>
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              {t('forum.desc', 'Foro comunitario para debatir, informar y consultar.')}
            </p>
          </div>

          <div className="flex w-full items-center justify-between gap-2.5 lg:w-auto lg:justify-end">
            {/* Sort Dropdown (CustomSelect Capsule Button) */}
            <CustomSelect
              options={[
                {
                  value: 'recent',
                  label: t('forum.sortByRecent', 'Más Recientes'),
                  icon: <SlidersHorizontal size={13} className="text-stone-400" />,
                },
                {
                  value: 'top',
                  label: t('forum.sortByTop', 'Más Votados'),
                  icon: <SlidersHorizontal size={13} className="text-stone-400" />,
                },
              ]}
              value={sortBy}
              onChange={(val) => setSortBy(val as 'recent' | 'top')}
              buttonClassName="!rounded-2xl !h-9 !px-3.5 !py-0 !border-[#E6E0D5] dark:!border-white/[0.07] !bg-white dark:!bg-[#1E222D] text-xs font-semibold text-stone-700 dark:text-stone-200"
            />

            {/* Create Thread Button */}
            <button
              onClick={handleCreateClick}
              className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-[#C22B38] px-4 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#a8242f] active:scale-95 dark:bg-[#D93846] dark:hover:bg-[#c22b38]"
            >
              <Plus size={15} />
              {t('forum.createThread', 'Crear Hilo')}
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm font-semibold text-stone-500">
              {t('common.loading')}
            </div>
          ) : error ? (
            <div className="flex h-64 items-center justify-center text-sm font-semibold text-red-500">
              {t('common.error')}
            </div>
          ) : threads.length === 0 ? (
            <div className="mx-auto mt-12 flex max-w-md flex-col items-center gap-2 rounded-3xl border border-[#E6E0D5] bg-white p-12 text-center text-stone-400 shadow-xs dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-500">
              <MessagesSquare
                size={40}
                strokeWidth={1.5}
                className="text-stone-300 dark:text-stone-600"
              />
              <h3 className="mt-2 font-bold text-stone-700 dark:text-stone-300">
                {t('forum.noThreadsTitle', 'No hay hilos aún')}
              </h3>
              <p className="text-xs">
                {t(
                  'forum.noThreadsDesc',
                  '¡Sé el primero en iniciar la conversación publicando una pregunta o anuncio!',
                )}
              </p>
            </div>
          ) : (
            <div className="grid max-w-4xl grid-cols-1 gap-4">
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
            ? (faculties.find((f) => f.id === targetFaculty)?.name ?? 'Facultad')
            : t('forum.generalTab', 'Tablón General')
          showToast(`Hilo publicado exitosamente en ${targetName}`)
        }}
      />
      {selectedThreadId && <ThreadDetailModal threadId={selectedThreadId} onClose={closeThread} />}

      {/* ── MODAL SELECTOR DE CANALES EN MÓVIL ── */}
      <Dialog
        open={channelDrawerOpen}
        onOpenChange={setChannelDrawerOpen}
        title={t('forum.selectChannel', 'Seleccionar Foro / Facultad')}
        contentClassName="!bg-white dark:!bg-[#1E222D] border border-[#E6E0D5] dark:border-white/[0.07] flex flex-col max-h-[85dvh] sm:max-w-md rounded-3xl"
      >
        <div className="flex flex-col gap-3 py-2">
          {/* Buscador de Canales */}
          <div className="relative flex items-center">
            <Search size={15} className="absolute left-3 text-stone-400" />
            <input
              type="text"
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder={t('map.searchFaculty', 'Buscar facultad…')}
              className="w-full rounded-2xl border border-[#E6E0D5] bg-[#FAF8F5] py-2.5 pl-9 pr-3 text-xs font-medium text-stone-900 placeholder:text-stone-400 outline-none transition-all focus:border-[#C22B38] dark:border-white/[0.07] dark:bg-[#151820] dark:text-stone-100 dark:focus:border-[#D93846]"
            />
          </div>

          {/* Lista de Canales / Facultades */}
          <div className="flex max-h-[55dvh] flex-col gap-1 overflow-y-auto pr-1">
            {/* Tablón General */}
            <button
              onClick={() => {
                setActiveFacultyId(null)
                setChannelDrawerOpen(false)
              }}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl px-3.5 py-3 text-left text-xs font-semibold transition-all ${
                activeFacultyId === null
                  ? 'bg-[#C22B38] text-white shadow-xs dark:bg-[#D93846]'
                  : 'bg-[#FAF8F5] text-stone-800 hover:bg-[#EFECE4] dark:bg-[#151820] dark:text-stone-200 dark:hover:bg-white/[0.08]'
              }`}
            >
              <span className="flex items-center gap-2 font-bold text-[13px]">
                <Megaphone size={16} /> Tablón General
              </span>
              {recentActivityMap['general'] && activeFacultyId !== null && (
                <span
                  className="h-2.5 w-2.5 rounded-full bg-[#C22B38] animate-pulse dark:bg-[#D93846]"
                  title="Hilo nuevo"
                />
              )}
            </button>

            {/* Facultades */}
            {filteredFaculties.map((f: Faculty) => {
              const isActive = activeFacultyId === f.id
              const hasNew = recentActivityMap[f.id]
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setActiveFacultyId(f.id)
                    setChannelDrawerOpen(false)
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl px-3.5 py-3 text-left text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#C22B38] text-white shadow-xs dark:bg-[#D93846]'
                      : 'bg-[#FAF8F5] text-stone-800 hover:bg-[#EFECE4] dark:bg-[#151820] dark:text-stone-200 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate font-semibold text-[12.5px]">
                    <GraduationCap size={16} className="shrink-0" />{' '}
                    {localizedName(f, i18n.language)}
                  </span>
                  {hasNew && !isActive && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#C22B38] animate-pulse dark:bg-[#D93846]"
                      title="Hilo nuevo"
                    />
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
