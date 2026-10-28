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
  'px-3 flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer'
const VOTE_INACTIVE =
  'text-stone-500 hover:bg-[#EFECE4] dark:text-stone-400 dark:hover:bg-white/[0.08]'
const LIKE_ACTIVE = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
const DISLIKE_ACTIVE =
  'border border-[#F2D0CE] bg-[#FBECEB] text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300'

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
    <article className="flex flex-col gap-3 rounded-2xl border border-[#E6E0D5] bg-white p-4 shadow-xs dark:border-white/[0.07] dark:bg-[#1E222D]">
      {/* Meta: categoría + antigüedad. El autor es siempre el dueño del perfil,
          así que repetirlo en cada tarjeta no aporta nada. */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 rounded-xl bg-[#EFECE4] px-2.5 py-1 text-xs font-semibold text-stone-700 dark:bg-white/[0.08] dark:text-stone-300">
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: categoryColor ?? '#a3a3a3' }}
          />
          <span className="truncate">{categoryLabel}</span>
        </span>
        <span className="shrink-0 text-xs font-medium text-stone-400 dark:text-stone-500">
          {timeAgo}
        </span>
      </div>

      {/* Cuerpo */}
      <div className="space-y-1">
        <h3 className="m-0 text-[15px] font-bold leading-snug tracking-tight text-stone-900 dark:text-stone-100">
          {title}
        </h3>
        {description && (
          <p className="m-0 line-clamp-3 text-[13px] leading-relaxed text-stone-600 dark:text-stone-400">
            {description}
          </p>
        )}
      </div>

      {/* Foto */}
      {photoCount > 0 && photoUrl && (
        <div className="relative h-[150px] overflow-hidden rounded-2xl bg-[#EFECE4] dark:bg-white/[0.08]">
          <img src={photoUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
          {photoCount > 1 && (
            <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-xl bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <Images size={11} />
              <span className="tabular-nums">{photoCount}</span>
            </span>
          )}
        </div>
      )}

      {/* Ubicación */}
      {location && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-stone-400 dark:text-stone-500">
          <MapPin size={12} className="shrink-0" />
          <span className="truncate">{location}</span>
        </div>
      )}

      {/* Pie: votos + comentarios + acción */}
      <div className="flex items-center justify-between gap-2 border-t border-[#E5DEC9] pt-2.5 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2">
          <div
            role="group"
            aria-label={t('forum.voteGroup', 'Votar')}
            className="flex h-8 shrink-0 items-stretch overflow-hidden rounded-xl border border-[#E6E0D5] bg-[#FAF8F5] dark:border-white/[0.07] dark:bg-[#151820]"
          >
            <button
              type="button"
              onClick={() => onVote?.(1)}
              aria-pressed={userVote === 1}
              className={`${VOTE_SEGMENT} ${userVote === 1 ? LIKE_ACTIVE : VOTE_INACTIVE}`}
            >
              <ThumbsUp size={13} strokeWidth={2.2} />
              <span className="tabular-nums">{votesUp}</span>
            </button>
            <div className="w-px bg-[#E6E0D5] dark:bg-white/[0.07]" />
            <button
              type="button"
              onClick={() => onVote?.(-1)}
              aria-pressed={userVote === -1}
              className={`${VOTE_SEGMENT} ${userVote === -1 ? DISLIKE_ACTIVE : VOTE_INACTIVE}`}
            >
              <ThumbsDown size={13} strokeWidth={2.2} />
              <span className="tabular-nums">{votesDown}</span>
            </button>
          </div>

          <div
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-[#EFECE4] px-2.5 text-xs font-semibold text-stone-700 dark:bg-white/[0.08] dark:text-stone-300"
            title={t('comments.title', 'Comentarios')}
          >
            <MessageSquare size={13} className="text-stone-400 dark:text-stone-500" />
            <span className="tabular-nums">{commentCount}</span>
          </div>
        </div>

        {onViewOnMap && (
          <button
            type="button"
            onClick={onViewOnMap}
            aria-label={t('profile.viewOnMap', 'Ver en mapa')}
            className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[#EFECE4] px-3 text-xs font-semibold text-stone-700 transition-colors hover:bg-[#e4dfd4] dark:bg-white/[0.08] dark:text-stone-300 dark:hover:bg-white/[0.12]"
          >
            <MapPin size={13} />
            {t('profile.viewOnMap', 'Ver en mapa')}
          </button>
        )}
      </div>
    </article>
  )
}
