import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Navigation,
  MapPin,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
  Layers,
  Pencil,
  Move,
  ChevronLeft,
  ChevronRight,
  Share2,
  Calendar,
  BadgeCheck,
  BadgeX,
  Clock,
  Flag,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Pin } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from '@/features/auth/authStore'
import { useGuard } from '@/features/auth/useGuard'
import { can } from '@/features/auth/permissions'
import { FACULTIES, DEMO_FLOOR_PLANS } from '@/shared/data/campusData'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { PinBadges } from './PinBadges'
import { EventSchedule } from './EventSchedule'
import { CommentSection } from './CommentSection'
import { isEventLive } from '@/shared/utils/eventState'
import { useNowTick } from '@/shared/lib/useNowTick'
import { usePinActions } from './usePinActions'
import { DraggableBottomSheet } from '@/shared/ui/DraggableBottomSheet'
import { BOUNDARY_RECT } from '@/features/map/campusBoundary'
import { ReportContentDialog, type ReportTarget } from '@/features/moderation/ReportContentDialog'

interface PinDetailProps {
  pin: Pin
  isFavorite: boolean
  userLocation?: { lat: number; lng: number } | null
}

// Grupo unido para útil / no útil (un solo control dividido, no dos píldoras
// sueltas) y un botón circular solo-ícono para favorito. Menos formas
// compitiendo entre sí = más limpio.
const VOTE_SEGMENT =
  'flex flex-1 items-center justify-center gap-1.5 py-2 text-[14px] font-bold transition-colors'
const VOTE_INACTIVE = 'text-neutral-500 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800'
const LIKE_ACTIVE = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
const DISLIKE_ACTIVE = 'bg-red-50 text-[#D41F2D] dark:bg-red-950/30 dark:text-red-400'
const FAVORITE_CIRCLE_ACTIVE = 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
const FAVORITE_CIRCLE_INACTIVE =
  'border-neutral-300 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800'

const ACTION_CHIP =
  'flex whitespace-nowrap shrink-0 items-center gap-1.5 rounded-full border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-[13px] font-semibold text-neutral-700 dark:text-neutral-200 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800'

function formatEventDate(startsAt: string, endsAt: string) {
  const d1 = new Date(startsAt)
  const d2 = new Date(endsAt)
  const isSameDay = d1.toDateString() === d2.toDateString()
  
  const dateOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }
  
  if (isSameDay) {
    return `${d1.toLocaleDateString('es-CL', dateOpts)}, ${d1.toLocaleTimeString('es-CL', timeOpts)} - ${d2.toLocaleTimeString('es-CL', timeOpts)}`
  } else {
    return `${d1.toLocaleDateString('es-CL', dateOpts)} ${d1.toLocaleTimeString('es-CL', timeOpts)} - ${d2.toLocaleDateString('es-CL', dateOpts)} ${d2.toLocaleTimeString('es-CL', timeOpts)}`
  }
}

export function PinDetail({ pin, isFavorite, userLocation }: PinDetailProps) {
  const { t } = useTranslation()
  const guard = useGuard()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const selectPin = useUIStore((s) => s.selectPin)
  const setRouteTarget = useUIStore((s) => s.setRouteTarget)
  const setIndoor = useUIStore((s) => s.setIndoor)
  const startMovingPin = useUIStore((s) => s.startMovingPin)
  const openCreateModal = useUIStore((s) => s.openCreateModal)
  const { vote, remove, promote, unverify, extendTTL, favorite } = usePinActions()

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)

  const faculty = FACULTIES.find((f) => f.id === pin.faculty_id)
  const isOwner = user !== null && pin.creator_id === user.id
  const canDelete = isOwner || can(role, 'pin.moderate')
  const canEdit = isOwner || can(role, 'pin.moderate')
  // Verificar o extender no lo decide la categoría, sino el pin concreto: la
  // misma categoría puede describir algo fijo del campus ("el casino está acá")
  // o algo que está pasando ahora ("hay fila en el casino"). Eso solo lo sabe
  // quien lee el pin, así que al moderador se le ofrecen las dos opciones y
  // decide él. Antes había aquí una lista de cinco categorías escrita a mano
  // que las repartía por adelantado, y que además no existía en la base.
  const canPromote = can(role, 'pin.makePermanent') && !pin.is_permanent && pin.type === 'report'
  const canExtend = can(role, 'pin.extendTime') && !pin.is_permanent && pin.type === 'report'
  // Solo se deshace lo que salió de una verificación: un lugar creado
  // directamente por un moderador nunca fue un reporte.
  const canUnverify = can(role, 'pin.makePermanent') && pin.is_permanent && !!pin.verifier_entity_name
  const canMove = can(role, 'pin.update.location')
  const hasIndoor =
    pin.type === 'place' && DEMO_FLOOR_PLANS.some((fp) => fp.faculty_id === pin.faculty_id)
  const photos = pin.pin_photos ?? []

  const now = useNowTick()
  const isLive = pin.type === 'event' && isEventLive(pin.starts_at, pin.ends_at, now)

  const { data: userVote = 0 } = useQuery({
    queryKey: ['pin_vote', pin.id, user?.id],
    queryFn: async () => {
      if (!supabase || !user) return 0
      const { data } = await supabase
        .from('pin_votes')
        .select('value')
        .eq('pin_id', pin.id)
        .eq('user_id', user.id)
        .maybeSingle()
      return data?.value ?? 0
    },
    enabled: !!user && !!supabase,
  })

  const onVote = (value: 1 | -1) => {
    if (!guard('pin.vote')) return
    if (vote.isPending) return
    vote.mutate({ pinId: pin.id, value })
  }

  const onFavorite = () => {
    if (!guard('pin.favorite')) return
    favorite.mutate({ pinId: pin.id, next: !isFavorite })
  }

  const onDelete = () => {
    setShowDeleteConfirm(true)
  }

  const onPhotoScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.clientWidth === 0) return
    setPhotoIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const devUnlockMap = useUIStore((s) => s.devUnlockMap)
  const adminMapUnlocked = role === 'admin' && devUnlockMap
  const isOutOfArea = !adminMapUnlocked && userLocation
    ? userLocation.lat < BOUNDARY_RECT.south ||
    userLocation.lat > BOUNDARY_RECT.north ||
    userLocation.lng < BOUNDARY_RECT.west ||
    userLocation.lng > BOUNDARY_RECT.east
    : false

  const onDirectionsClick = () => {
    if (isOutOfArea) {
      useUIStore
        .getState()
        .showToast(t('map.outOfBounds', 'Estás demasiado lejos del campus para trazar una ruta a pie.'))
    } else {
      setRouteTarget(pin.id)
      selectPin(null)
    }
  }
  const handleShare = async () => {
    const url = `${window.location.origin}/mapa?pin=${pin.id}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: pin.title,
          text: pin.description ?? undefined,
          url: url
        })
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          navigator.clipboard.writeText(url)
          useUIStore.getState().showToast(t('common.copied', 'Enlace copiado al portapapeles'))
        }
      }
    } else {
      navigator.clipboard.writeText(url)
      useUIStore.getState().showToast(t('common.copied', 'Enlace copiado al portapapeles'))
    }
  }

  return (
    <>
      <DraggableBottomSheet isOpen={true} onClose={() => selectPin(null)} ariaLabel={pin.title}>
        <div className="flex flex-col px-5 pb-6 pt-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="text-[26px] font-black tracking-tight leading-none text-neutral-900 dark:text-white">
              {pin.title}
            </h2>
            <button
              onClick={() => selectPin(null)}
              aria-label={t('common.close', 'Cerrar')}
              className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          <PinBadges pin={pin} />

          {faculty && (
            <div className="mt-2 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide text-[#9d2235] dark:text-red-400">
              <MapPin size={13} />
              <span>{faculty.name}</span>
            </div>
          )}

          {pin.description && (
            <div className="mt-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 p-3">
              <h3 className="mb-1 text-[12px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {t('pin.description', 'Descripción')}
              </h3>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">
                {pin.description}
              </p>
            </div>
          )}

          {/* Fotos, debajo de la descripción */}
          {photos.length > 0 && (
            <div className="group relative mt-4 h-[220px] overflow-hidden rounded-xl sm:h-[260px]">
              {photos.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      document.getElementById('pin-photos-scroll')?.scrollBy({ left: -250, behavior: 'smooth' })
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 hidden rounded-full bg-black/50 p-2 text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100 sm:block"
                    aria-label={t('pin.prevPhoto', 'Foto anterior')}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      document.getElementById('pin-photos-scroll')?.scrollBy({ left: 250, behavior: 'smooth' })
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 hidden rounded-full bg-black/50 p-2 text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100 sm:block"
                    aria-label={t('pin.nextPhoto', 'Foto siguiente')}
                  >
                    <ChevronRight size={20} />
                  </button>

                  {/* Contador de fotos */}
                  <div className="absolute right-3 top-3 z-10 rounded-full bg-black/50 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-md">
                    {photoIndex + 1} / {photos.length}
                  </div>

                  {/* Indicadores (puntos) */}
                  <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
                    {photos.map((ph, i) => (
                      <span
                        key={ph.id}
                        className={`h-1.5 rounded-full transition-all ${i === photoIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                          }`}
                      />
                    ))}
                  </div>
                </>
              )}
              <div
                id="pin-photos-scroll"
                onScroll={onPhotoScroll}
                className="flex h-full w-full overflow-x-auto snap-x snap-mandatory no-scrollbar bg-neutral-100 dark:bg-neutral-900"
              >
                {photos.map((ph) => (
                  <img
                    key={ph.id}
                    src={ph.url}
                    alt=""
                    loading="lazy"
                    onClick={() => setSelectedPhoto(ph.url)}
                    className="h-full w-full flex-none shrink-0 snap-center object-cover cursor-pointer"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Programa: justo tras las fotos, porque hoy el programa se sube
              como foto y ahí es donde la gente lo busca. Antes de la fila de
              acciones para que "Cómo llegar" siga siendo lo último. */}
          {pin.type === 'event' && <EventSchedule pinId={pin.id} isLive={isLive} />}

          <div className="mt-4 flex items-center gap-2">
            {pin.type !== 'event' && (
              <div
                role="group"
                aria-label={t('pin.voteGroup', 'Votar si es útil')}
                className="flex flex-1 items-stretch overflow-hidden rounded-full border border-neutral-200 dark:border-neutral-700 h-9"
              >
                <button
                  onClick={() => onVote(1)}
                  disabled={vote.isPending}
                  aria-label={t('pin.useful', 'Útil')}
                  aria-pressed={userVote === 1}
                  className={`${VOTE_SEGMENT} ${userVote === 1 ? LIKE_ACTIVE : VOTE_INACTIVE}`}
                >
                  <ThumbsUp size={15} strokeWidth={2.5} /> {pin.votes_up}
                </button>
                <div className="w-px bg-neutral-200 dark:bg-neutral-700" />
                <button
                  onClick={() => onVote(-1)}
                  disabled={vote.isPending}
                  aria-label={t('pin.notUseful', 'No útil')}
                  aria-pressed={userVote === -1}
                  className={`${VOTE_SEGMENT} ${userVote === -1 ? DISLIKE_ACTIVE : VOTE_INACTIVE}`}
                >
                  <ThumbsDown size={15} strokeWidth={2.5} /> {pin.votes_down}
                </button>
              </div>
            )}
            
            {pin.type === 'event' && pin.starts_at && pin.ends_at && (
              <div className="flex flex-1 min-w-0 items-center gap-1.5 px-3 rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800/50 h-9 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                <Calendar size={14} className="text-neutral-500 flex-shrink-0" />
                <span className="truncate">
                  {formatEventDate(pin.starts_at, pin.ends_at)}
                </span>
              </div>
            )}
            <button
              onClick={onFavorite}
              aria-label={t('pin.favorite', 'Favorito')}
              aria-pressed={isFavorite}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${isFavorite ? FAVORITE_CIRCLE_ACTIVE : FAVORITE_CIRCLE_INACTIVE
                }`}
            >
              <Star size={16} fill={isFavorite ? '#F5B400' : 'none'} strokeWidth={isFavorite ? 1.5 : 2} />
            </button>
            <button
              onClick={handleShare}
              aria-label={t('pin.share', 'Compartir')}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${FAVORITE_CIRCLE_INACTIVE}`}
            >
              <Share2 size={16} strokeWidth={2} />
            </button>
            {user && !isOwner && role !== 'guest' && (
              <button
                onClick={() => setReportTarget({ type: 'pin', id: pin.id })}
                aria-label={t('report.action', 'Reportar')}
                title={t('report.action', 'Reportar contenido')}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors hover:text-red-500 hover:border-red-300 dark:hover:border-red-800 ${FAVORITE_CIRCLE_INACTIVE}`}
              >
                <Flag size={15} strokeWidth={2} />
              </button>
            )}
          </div>

          <button
            onClick={onDirectionsClick}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-[14px] font-bold shadow-sm transition-all active:scale-[0.98] ${isOutOfArea
                ? 'cursor-not-allowed bg-neutral-200 text-neutral-400 dark:bg-neutral-800'
                : 'bg-[#9d2235] text-white hover:bg-[#701d2e]'
              }`}
          >
            <Navigation size={15} strokeWidth={2.5} /> {t('pin.directions', 'Cómo llegar')}
          </button>

          {(canDelete || canPromote || canExtend || canUnverify || canEdit || hasIndoor) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {hasIndoor && (
                <button onClick={() => setIndoor(pin.faculty_id)} className={ACTION_CHIP}>
                  <Layers size={14} /> {t('indoor.title', 'Interior')}
                </button>
              )}
              {canEdit && (
                <button onClick={() => openCreateModal(pin.id)} className={ACTION_CHIP}>
                  <Pencil size={14} /> {t('pin.edit', 'Editar')}
                </button>
              )}
              {canMove && (
                <button onClick={() => startMovingPin(pin.id)} className={ACTION_CHIP}>
                  <Move size={14} /> {t('pin.move', 'Mover')}
                </button>
              )}
              {canPromote && (
                <button 
                  onClick={() => promote.mutate({ 
                    pinId: pin.id,
                    verifierName: role === 'admin' ? 'Administración UDP' : 'Centro de Alumnos FIC'
                  })} 
                  className={ACTION_CHIP}
                >
                  <BadgeCheck size={14} className="text-blue-500" /> {t('pin.verifyAndFix', 'Verificar y Fijar')}
                </button>
              )}
              {canExtend && (
                <button onClick={() => extendTTL.mutate({ pinId: pin.id, hours: 24 })} className={ACTION_CHIP}>
                  <Clock size={14} className="text-amber-500" /> {t('pin.extendTime', 'Extender (+24h)')}
                </button>
              )}
              {canUnverify && (
                <button onClick={() => unverify.mutate({ pinId: pin.id, hours: 24 })} className={ACTION_CHIP}>
                  <BadgeX size={14} className="text-amber-500" /> {t('pin.unverify', 'Quitar verificación')}
                </button>
              )}
              {canDelete && (
                <button
                  onClick={onDelete}
                  className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D41F2D] px-3 py-1.5 text-[13px] font-semibold text-[#D41F2D] transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 size={14} /> {t('pin.delete', 'Eliminar pin')}
                </button>
              )}
            </div>
          )}

          <hr className="my-4 border-neutral-200 dark:border-neutral-800" />
          <CommentSection pinId={pin.id} />
        </div>
      </DraggableBottomSheet>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('pin.confirmDeleteTitle', '¿Eliminar este pin?')}
        description={t(
          'pin.confirmDeleteDesc',
          'Sus fotos y comentarios se borrarán también. Esta acción no se puede deshacer.',
        )}
        confirmText={t('common.delete', 'Eliminar')}
        onConfirm={() => remove.mutate(pin)}
      />

      <ReportContentDialog target={reportTarget} onClose={() => setReportTarget(null)} />

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 animate-fade-in"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-neutral-800/50 p-2 text-white backdrop-blur-md hover:bg-neutral-700/80"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedPhoto(null)
            }}
            aria-label={t('common.close', 'Cerrar')}
          >
            <X size={24} />
          </button>
          <img
            src={selectedPhoto}
            alt={t('pin.expandedPhoto', 'Vista ampliada')}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
