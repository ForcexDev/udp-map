import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Navigation, Star, ThumbsDown, ThumbsUp, Trash2, X, Layers, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from '@/features/auth/authStore'
import { useGuard } from '@/features/auth/useGuard'
import { can } from '@/features/auth/permissions'
import { FACULTIES, DEMO_FLOOR_PLANS } from '@/shared/data/campusData'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { PinBadges } from './PinBadges'
import { CommentSection } from './CommentSection'
import { usePinActions } from './usePinActions'

interface PinDetailProps {
  pin: Pin
  isFavorite: boolean
}

export function PinDetail({ pin, isFavorite }: PinDetailProps) {
  const { t } = useTranslation()
  const guard = useGuard()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const selectPin = useUIStore((s) => s.selectPin)
  const setRouteTarget = useUIStore((s) => s.setRouteTarget)
  const setIndoor = useUIStore((s) => s.setIndoor)
  const startMovingPin = useUIStore((s) => s.startMovingPin)
  const openCreateModal = useUIStore((s) => s.openCreateModal)
  const { vote, remove, promote, favorite } = usePinActions()

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const faculty = FACULTIES.find((f) => f.id === pin.faculty_id)
  const isOwner = user !== null && pin.creator_id === user.id
  const canDelete = isOwner || can(role, 'pin.moderate')
  const canEdit = isOwner || can(role, 'pin.moderate')
  const canPromote = can(role, 'pin.makePermanent') && !pin.is_permanent && pin.type === 'report'
  const canMove = can(role, 'pin.update.location')
  const hasIndoor =
    pin.type === 'place' && DEMO_FLOOR_PLANS.some((fp) => fp.faculty_id === pin.faculty_id)
  const photos = pin.pin_photos ?? []

  const onVote = (value: 1 | -1) => {
    if (!guard('pin.vote')) return
    vote.mutate({ pinId: pin.id, value })
  }

  const onFavorite = () => {
    if (!guard('pin.favorite')) return
    favorite.mutate({ pinId: pin.id, next: !isFavorite })
  }

  const onDelete = () => {
    setShowDeleteConfirm(true)
  }

  return (
    <>
      <aside
        aria-label={pin.title}
        className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 max-h-[60dvh] sm:max-h-[calc(100dvh-6rem)] overflow-y-auto no-scrollbar rounded-t-[22px] glass-hud shadow-3xl p-5 animate-slide-in-bottom sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96 sm:rounded-[22px]"
      >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold leading-tight">{pin.title}</h2>
        <button
          onClick={() => selectPin(null)}
          aria-label={t('common.close')}
          className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <X size={18} />
        </button>
      </div>

      <PinBadges pin={pin} />

      {faculty && <p className="mt-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#D41F2D]">{faculty.name}</p>}
      
      {pin.is_official ? (
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500 font-medium">
          Añadido por <span className="text-emerald-600 dark:text-emerald-400 font-bold">Administración UDP</span>
        </p>
      ) : pin.creator_name ? (
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500 font-medium">
          Añadido por <span className="text-neutral-600 dark:text-neutral-300 font-bold">{pin.creator_name}</span>
        </p>
      ) : null}

      {pin.description && <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">{pin.description}</p>}

      {photos.length > 0 && (
        <div className="relative mt-4 group">
          {photos.length > 1 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); document.getElementById('pin-photos-scroll')?.scrollBy({ left: -250, behavior: 'smooth' })}}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-black/50 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block shadow-lg"
                aria-label="Anterior foto"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); document.getElementById('pin-photos-scroll')?.scrollBy({ left: 250, behavior: 'smooth' })}}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-black/50 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block shadow-lg"
                aria-label="Siguiente foto"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <div 
            id="pin-photos-scroll"
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0"
          >
            {photos.map((ph) => (
              <img
                key={ph.id}
                src={ph.url}
                alt=""
                loading="lazy"
                onClick={() => setSelectedPhoto(ph.url)}
                className={`flex-none shrink-0 snap-center rounded-[20px] object-cover cursor-pointer shadow-[0_8px_24px_-12px_rgba(0,0,0,0.2)] border border-neutral-100 dark:border-neutral-800 transition-transform hover:scale-[1.02] ${
                  photos.length === 1 ? 'w-full aspect-[4/3] sm:aspect-video' : 'w-[80%] sm:w-[65%] aspect-[4/3]'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pin.type !== 'event' && (
          <>
            <button
              onClick={() => onVote(1)}
              aria-label={t('pin.useful')}
              className="flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-sm hover:bg-emerald-100 dark:bg-neutral-800 dark:hover:bg-emerald-900"
            >
              <ThumbsUp size={15} /> {pin.votes_up}
            </button>
            <button
              onClick={() => onVote(-1)}
              aria-label={t('pin.notUseful')}
              className="flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-sm hover:bg-red-100 dark:bg-neutral-800 dark:hover:bg-red-900"
            >
              <ThumbsDown size={15} /> {pin.votes_down}
            </button>
          </>
        )}
        <button
          onClick={onFavorite}
          aria-label={t('pin.favorite')}
          aria-pressed={isFavorite}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm ${
            isFavorite
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
              : 'bg-neutral-100 hover:bg-amber-100 dark:bg-neutral-800'
          }`}
        >
          <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        <button
          onClick={() => setRouteTarget(pin.id)}
          className="flex items-center gap-1 rounded-lg bg-udp-700 px-2.5 py-1.5 text-sm text-white hover:bg-udp-800"
        >
          <Navigation size={15} /> {t('pin.directions')}
        </button>
        {hasIndoor && (
          <button
            onClick={() => setIndoor(pin.faculty_id)}
            className="flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-sm hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            <Layers size={15} /> {t('indoor.title')}
          </button>
        )}
      </div>

      {(canDelete || canPromote || canEdit) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {canEdit && (
            <button
              onClick={() => openCreateModal(pin.id)}
              className="flex items-center gap-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <Navigation size={14} className="rotate-90" /> {t('pin.edit', 'Editar')}
            </button>
          )}
          {canPromote && (
            <button
              onClick={() => promote.mutate(pin.id)}
              className="flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
            >
              <Lock size={14} /> {t('pin.makePermanent')}
            </button>
          )}
          {canMove && (
            <button
              onClick={() => startMovingPin(pin.id)}
              className="flex items-center gap-1 rounded-lg border border-blue-300 px-2.5 py-1.5 text-sm text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950"
            >
              <Navigation size={14} /> {t('pin.move', 'Mover')}
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              <Trash2 size={14} /> {t('pin.delete')}
            </button>
          )}
        </div>
      )}

      <hr className="my-3 border-neutral-200 dark:border-neutral-800" />
      <CommentSection pinId={pin.id} />
    </aside>

    <ConfirmDialog
      open={showDeleteConfirm}
      onOpenChange={setShowDeleteConfirm}
      title={t('pin.confirmDeleteTitle', '¿Eliminar este pin?')}
      description={t('pin.confirmDeleteDesc', 'Sus fotos y comentarios se borrarán también. Esta acción no se puede deshacer.')}
      confirmText={t('common.delete', 'Eliminar')}
      onConfirm={() => remove.mutate(pin)}
    />

    {selectedPhoto && (
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 animate-fade-in"
        onClick={() => setSelectedPhoto(null)}
      >
        <button 
          className="absolute right-4 top-4 rounded-full bg-neutral-800/50 p-2 text-white hover:bg-neutral-700/80 backdrop-blur-md"
          onClick={(e) => { e.stopPropagation(); setSelectedPhoto(null); }}
        >
          <X size={24} />
        </button>
        <img 
          src={selectedPhoto} 
          alt="Vista ampliada" 
          className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl" 
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    </>
  )
}
