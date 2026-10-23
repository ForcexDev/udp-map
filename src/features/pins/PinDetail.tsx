import { localizedName } from '@/shared/utils/localized'
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
  Pencil,
  Move,
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
import { FACULTIES } from '@/shared/data/campusData'
import { floorName } from '@/features/mapping/areaStyles'
import { locationBreadcrumb, useMapping } from '@/features/mapping/useMapping'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { LinkedText } from '@/shared/ui/LinkedText'
import { PinBadges } from './PinBadges'
import { EventSchedule } from './EventSchedule'
import { CommentSection } from './CommentSection'
import { isEventLive } from '@/shared/utils/eventState'
import { useNowTick } from '@/shared/lib/useNowTick'
import { usePinActions } from './usePinActions'
import { DraggableBottomSheet } from '@/shared/ui/DraggableBottomSheet'
import { PhotoCarousel } from '@/shared/ui/PhotoCarousel'
import { BOUNDARY_RECT } from '@/features/map/campusBoundary'
import { ReportContentDialog, type ReportTarget } from '@/features/moderation/ReportContentDialog'
import { RoomMicroaddress } from '@/features/wayfinding/RoomMicroaddress'

interface PinDetailProps {
  pin: Pin
  isFavorite: boolean
  userLocation?: { lat: number; lng: number } | null
}

// Grupo unido para útil / no útil (un solo control dividido, no dos píldoras
// sueltas) y un botón circular solo-ícono para favorito.
const VOTE_SEGMENT =
  'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors cursor-pointer'
const VOTE_INACTIVE = 'text-stone-600 hover:bg-[#F4F0E8] dark:text-stone-300 dark:hover:bg-white/[0.05]'
const LIKE_ACTIVE = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
const DISLIKE_ACTIVE = 'bg-[#FBECEB] text-[#B02330] dark:bg-[#D93846]/20 dark:text-rose-300'
const FAVORITE_CIRCLE_ACTIVE =
  'border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
const FAVORITE_CIRCLE_INACTIVE =
  'border-[#E6E0D5] bg-white text-stone-600 hover:bg-[#F4F0E8] dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-300 dark:hover:bg-white/[0.05]'

const ACTION_CHIP =
  'flex whitespace-nowrap shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[#E6E0D5] dark:border-white/[0.07] bg-white dark:bg-[#1E222D] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 transition-colors hover:bg-[#F4F0E8] dark:hover:bg-[#252A37]'

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
  const { t, i18n } = useTranslation()
  const guard = useGuard()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const selectPin = useUIStore((s) => s.selectPin)
  const setRouteTarget = useUIStore((s) => s.setRouteTarget)
  const startMovingPin = useUIStore((s) => s.startMovingPin)
  const openCreateModal = useUIStore((s) => s.openCreateModal)
  const { vote, remove, promote, unverify, extendTTL, favorite } = usePinActions()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)

  const faculty = FACULTIES.find((f) => f.id === pin.faculty_id)
  const { mapping } = useMapping()
  const indoorParts = locationBreadcrumb(mapping, pin, floorName)
  const isOwner = user !== null && pin.creator_id === user.id
  const canDelete = isOwner || can(role, 'pin.moderate')
  const canEdit = isOwner || can(role, 'pin.moderate')
  // Verificar o extender no lo decide la categoría, sino el pin concreto: la
  // misma categoría puede describir algo fijo del campus ("el casino está acá")
  // o algo que está pasando ahora ("hay fila en el casino"). Eso solo lo sabe
  // quien lee el pin, así que al moderador se le ofrecen las dos opciones y
  // decide él.
  const canPromote = can(role, 'pin.makePermanent') && !pin.is_permanent && pin.type === 'report'
  const canExtend = can(role, 'pin.extendTime') && !pin.is_permanent && pin.type === 'report'
  // Solo se deshace lo que salió de una verificación: un lugar creado
  // directamente por un moderador nunca fue un reporte.
  const canUnverify = can(role, 'pin.makePermanent') && pin.is_permanent && !!pin.verifier_entity_name
  const canMove = can(role, 'pin.update.location')
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
          url: url,
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
            <h2 className="text-xl font-bold leading-snug tracking-tight text-stone-900 sm:text-2xl dark:text-stone-100">
              {pin.title}
            </h2>
            <button
              type="button"
              onClick={() => selectPin(null)}
              aria-label={t('common.close', 'Cerrar')}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#EFECE4] text-stone-700 transition-colors hover:bg-stone-200 dark:bg-white/[0.08] dark:text-stone-200 dark:hover:bg-white/15"
            >
              <X size={18} />
            </button>
          </div>

          <PinBadges pin={pin} />

          {/* Dónde está, de fuera hacia dentro: facultad · edificio · piso ·
              área. Si tiene room_code, se destaca con badge tabular cálido. */}
          {(faculty || indoorParts.length > 0 || pin.room_code) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-600 dark:text-stone-300">
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="shrink-0 text-[#C22B38] dark:text-[#D93846]" />
                <span>{localizedName(faculty, i18n.language)}</span>
                {indoorParts.length > 0 && (
                  <span className="text-stone-500 dark:text-stone-400">
                    {faculty ? ' · ' : ''}
                    {indoorParts.join(' · ')}
                  </span>
                )}
              </div>
              {pin.room_code && (
                <span className="rounded-lg border border-[#F2D0CE] bg-[#FBECEB] px-2.5 py-1 text-xs font-bold tabular-nums text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300">
                  {pin.room_code}
                </span>
              )}
            </div>
          )}

          {/* Microdirección: dónde está la sala dentro del edificio, derivada
              del grafo de navegación. Sin grafo no se muestra nada. */}
          <RoomMicroaddress pin={pin} />

          {pin.description && (
            <div className="mt-4 rounded-2xl border border-[#E6E0D5] bg-white p-3.5 dark:border-white/[0.07] dark:bg-[#1E222D]">
              <h3 className="mb-1 text-xs font-semibold text-stone-500 dark:text-stone-400">
                {t('pin.description', 'Descripción')}
              </h3>
              <LinkedText
                text={pin.description}
                className="text-sm font-normal leading-relaxed text-stone-800 dark:text-stone-200"
              />
            </div>
          )}

          {/* Fotos, debajo de la descripción. El carrusel es el mismo que usa
              la galería de facultades y edificios (shared/ui/PhotoCarousel),
              con su visor a pantalla completa incluido. */}
          {photos.length > 0 && (
            <div className="mt-4">
              <PhotoCarousel photos={photos} />
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
                className="flex h-9 flex-1 items-stretch overflow-hidden rounded-2xl border border-[#E6E0D5] bg-white shadow-xs dark:border-white/[0.07] dark:bg-[#1E222D]"
              >
                <button
                  type="button"
                  onClick={() => onVote(1)}
                  disabled={vote.isPending}
                  aria-label={t('pin.useful', 'Útil')}
                  aria-pressed={userVote === 1}
                  className={`${VOTE_SEGMENT} ${userVote === 1 ? LIKE_ACTIVE : VOTE_INACTIVE}`}
                >
                  <ThumbsUp size={14} strokeWidth={2.2} /> <span className="tabular-nums">{pin.votes_up}</span>
                </button>
                <div className="w-px bg-[#E6E0D5] dark:bg-white/[0.07]" />
                <button
                  type="button"
                  onClick={() => onVote(-1)}
                  disabled={vote.isPending}
                  aria-label={t('pin.notUseful', 'No útil')}
                  aria-pressed={userVote === -1}
                  className={`${VOTE_SEGMENT} ${userVote === -1 ? DISLIKE_ACTIVE : VOTE_INACTIVE}`}
                >
                  <ThumbsDown size={14} strokeWidth={2.2} /> <span className="tabular-nums">{pin.votes_down}</span>
                </button>
              </div>
            )}

            {pin.type === 'event' && pin.starts_at && pin.ends_at && (
              <div className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-2xl border border-[#E6E0D5] bg-white px-3 text-xs font-semibold text-stone-700 shadow-xs dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-300">
                <Calendar size={14} className="shrink-0 text-stone-500" />
                <span className="truncate">
                  {formatEventDate(pin.starts_at, pin.ends_at)}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onFavorite}
              aria-label={t('pin.favorite', 'Favorito')}
              aria-pressed={isFavorite}
              className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-2xl border shadow-xs transition-colors ${
                isFavorite ? FAVORITE_CIRCLE_ACTIVE : FAVORITE_CIRCLE_INACTIVE
              }`}
            >
              <Star size={16} fill={isFavorite ? '#F5B400' : 'none'} strokeWidth={isFavorite ? 1.5 : 2} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label={t('pin.share', 'Compartir')}
              className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-2xl border shadow-xs transition-colors ${FAVORITE_CIRCLE_INACTIVE}`}
            >
              <Share2 size={16} strokeWidth={2} />
            </button>
            {user && !isOwner && role !== 'guest' && (
              <button
                type="button"
                onClick={() => setReportTarget({ type: 'pin', id: pin.id })}
                aria-label={t('report.action', 'Reportar')}
                title={t('report.action', 'Reportar contenido')}
                className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-2xl border shadow-xs transition-colors hover:border-red-300 hover:text-red-500 dark:hover:border-red-800 ${FAVORITE_CIRCLE_INACTIVE}`}
              >
                <Flag size={15} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Botón CTA Prominente: "Cómo llegar" */}
          <button
            type="button"
            onClick={onDirectionsClick}
            className={`mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all active:scale-[0.98] ${
              isOutOfArea
                ? 'cursor-not-allowed bg-stone-300 text-stone-500 dark:bg-stone-800 dark:text-stone-500'
                : 'bg-[#C22B38] hover:opacity-95 dark:bg-[#D93846]'
            }`}
          >
            <Navigation size={15} strokeWidth={2.2} />
            <span>{t('pin.directions', 'Cómo llegar')}</span>
          </button>

          {(canDelete || canPromote || canExtend || canUnverify || canEdit) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {canEdit && (
                <button type="button" onClick={() => openCreateModal(pin.id)} className={ACTION_CHIP}>
                  <Pencil size={14} /> {t('pin.edit', 'Editar')}
                </button>
              )}
              {canMove && (
                <button type="button" onClick={() => startMovingPin(pin.id)} className={ACTION_CHIP}>
                  <Move size={14} /> {t('pin.move', 'Mover')}
                </button>
              )}
              {canPromote && (
                <button
                  type="button"
                  onClick={() =>
                    promote.mutate({
                      pinId: pin.id,
                      verifierName: role === 'admin' ? 'Administración UDP' : 'Centro de Alumnos FIC',
                    })
                  }
                  className={ACTION_CHIP}
                >
                  <BadgeCheck size={14} className="text-sky-500" /> {t('pin.verifyAndFix', 'Verificar y Fijar')}
                </button>
              )}
              {canExtend && (
                <button
                  type="button"
                  onClick={() => extendTTL.mutate({ pinId: pin.id, hours: 24 })}
                  className={ACTION_CHIP}
                >
                  <Clock size={14} className="text-amber-500" /> {t('pin.extendTime', 'Extender (+24h)')}
                </button>
              )}
              {canUnverify && (
                <button
                  type="button"
                  onClick={() => unverify.mutate({ pinId: pin.id, hours: 24 })}
                  className={ACTION_CHIP}
                >
                  <BadgeX size={14} className="text-amber-500" /> {t('pin.unverify', 'Quitar verificación')}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-rose-300 bg-rose-50/50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <Trash2 size={14} /> {t('pin.delete', 'Eliminar pin')}
                </button>
              )}
            </div>
          )}

          <hr className="my-4 border-[#E5DEC9] dark:border-white/10" />
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
    </>
  )
}
