import { useTranslation } from 'react-i18next'
import { Images, MapPin, MessageSquare, ThumbsDown, ThumbsUp } from 'lucide-react'

export interface ReportCardProps {
  title: string
  description: string | null
  /** Categoría del pin, o el tipo si no tiene categoría. */
  categoryLabel: string
  /** Color de la categoría en el mapa; null para el gris neutro. */
  categoryColor: string | null
  timeAgo: string
  location: string | null
  photoUrl?: string | null
  photoCount?: number
  commentCount?: number
  votesUp: number
  votesDown: number
  userVote?: 1 | -1 | 0
  onVote?: (value: 1 | -1) => void
  onViewOnMap?: () => void
}

// Mismos estilos de voto que PinDetail y el Foro: el perfil no inventa su propio
// control.
const VOTE_SEGMENT =
  'px-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer'
const VOTE_INACTIVE = 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
const LIKE_ACTIVE = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
const DISLIKE_ACTIVE = 'bg-red-50 text-[#D41F2D] dark:bg-red-950/30 dark:text-red-400'

export function ReportCard({
  title,
  description,
  categoryLabel,
  categoryColor,
  timeAgo,
  location,
  photoUrl,
  photoCount = 0,
  commentCount = 0,
  votesUp,
  votesDown,
  userVote = 0,
  onVote,
  onViewOnMap,
}: ReportCardProps) {
  const { t } = useTranslation()

  return (
    <article className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-4 flex flex-col gap-3 shadow-sm">
      {/* Meta: categoría + antigüedad. El autor es siempre el dueño del perfil,
          así que repetirlo en cada tarjeta no aporta nada. */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: categoryColor ?? '#a3a3a3' }}
          />
          <span className="truncate">{categoryLabel}</span>
        </span>
        <span className="text-[10px] font-medium text-neutral-400 shrink-0">{timeAgo}</span>
      </div>

      {/* Cuerpo */}
      <div className="space-y-1">
        <h3 className="text-[15px] font-extrabold leading-snug tracking-tight text-neutral-900 dark:text-white m-0">
          {title}
        </h3>
        {description && (
          <p className="text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400 line-clamp-3 m-0">
            {description}
          </p>
        )}
      </div>

      {/* Foto */}
      {photoCount > 0 && photoUrl && (
        <div className="relative h-[150px] overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800">
          <img src={photoUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
          {photoCount > 1 && (
            <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              <Images size={11} />
              {photoCount}
            </span>
          )}
        </div>
      )}

      {/* Ubicación */}
      {location && (
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-400">
          <MapPin size={12} className="shrink-0" />
          <span className="truncate">{location}</span>
        </div>
      )}

      {/* Pie: votos + comentarios + acción */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <div
            role="group"
            aria-label={t('forum.voteGroup', 'Votar')}
            className="flex items-stretch overflow-hidden rounded-full border border-neutral-200 dark:border-neutral-700 h-8 bg-neutral-50 dark:bg-neutral-900/50 shrink-0"
          >
            <button
              type="button"
              onClick={() => onVote?.(1)}
              aria-pressed={userVote === 1}
              className={`${VOTE_SEGMENT} ${userVote === 1 ? LIKE_ACTIVE : VOTE_INACTIVE}`}
            >
              <ThumbsUp size={13} strokeWidth={2.5} />
              <span>{votesUp}</span>
            </button>
            <div className="w-px bg-neutral-200 dark:bg-neutral-700" />
            <button
              type="button"
              onClick={() => onVote?.(-1)}
              aria-pressed={userVote === -1}
              className={`${VOTE_SEGMENT} ${userVote === -1 ? DISLIKE_ACTIVE : VOTE_INACTIVE}`}
            >
              <ThumbsDown size={13} strokeWidth={2.5} />
              <span>{votesDown}</span>
            </button>
          </div>

          <div
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800/80 text-neutral-500 dark:text-neutral-400 text-xs font-bold shrink-0"
            title={t('comments.title', 'Comentarios')}
          >
            <MessageSquare size={13} className="text-neutral-400" />
            <span>{commentCount}</span>
          </div>
        </div>

        {onViewOnMap && (
          <button
            type="button"
            onClick={onViewOnMap}
            aria-label={t('profile.viewOnMap', 'Ver en mapa')}
            className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 text-xs font-bold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer shrink-0"
          >
            <MapPin size={13} />
            {t('profile.viewOnMap', 'Ver en mapa')}
          </button>
        )}
      </div>
    </article>
  )
}
