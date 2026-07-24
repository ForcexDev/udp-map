import { MapPin, ThumbsUp, ThumbsDown } from 'lucide-react'
import { UserAvatar } from '@/shared/ui/UserAvatar'

export interface ReportCardProps {
  title: string
  description: string | null
  authorName: string
  authorAvatarUrl: string | null
  timeAgo: string
  location: string | null
  photoUrl?: string | null
  photoCount?: number
  votesScore: number
  userVote?: 1 | -1 | 0
  onVote?: (value: 1 | -1) => void
  onViewOnMap?: () => void
  showTimeline?: boolean
}

export function ReportCard({
  title,
  description,
  authorName,
  authorAvatarUrl,
  timeAgo,
  location,
  photoUrl,
  photoCount = 0,
  votesScore,
  userVote = 0,
  onVote,
  onViewOnMap,
  showTimeline = false,
}: ReportCardProps) {
  return (
    <article className="relative py-[18px] border-b border-neutral-200 dark:border-profile-line last:border-b-0">
      {showTimeline && <span className="report-timeline-dot" />}
      
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <UserAvatar name={authorName} src={authorAvatarUrl} className="w-[26px] h-[26px]" />
        <span className="text-[13px] font-semibold text-neutral-900 dark:text-profile-text">{authorName}</span>
        <span className="text-[11px] text-neutral-500 dark:text-profile-faint">·</span>
        <span className="text-[12px] font-mono text-neutral-500 dark:text-profile-faint">{timeAgo}</span>
      </div>

      {/* Body */}
      <h3 className="font-display text-[15px] font-semibold text-neutral-900 dark:text-profile-text mb-1">{title}</h3>
      {description && (
        <p className="text-[13.5px] leading-relaxed text-neutral-600 dark:text-profile-muted m-0">
          {description}
        </p>
      )}

      {/* Photo */}
      {photoCount > 0 && photoUrl && (
        <div className="mt-3 h-[140px] bg-neutral-100 dark:bg-[#161719] relative overflow-hidden rounded-md">
          <img src={photoUrl} alt={title} className="w-full h-full object-cover" />
          <span className="absolute bottom-[9px] left-2 font-mono text-[10.5px] text-white/90 bg-black/50 px-2 py-0.5 rounded-md">
            📷 {photoCount} foto{photoCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Location */}
      {location && (
        <div className="flex items-center gap-1.5 mt-2.5 text-[12px] text-neutral-500 dark:text-profile-faint">
          <MapPin size={12} className="opacity-60 shrink-0" />
          {location}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-[22px] mt-[13px] items-center">
        <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-[#161719] rounded-[10px] px-1.5 py-1 border border-neutral-200 dark:border-profile-line">
          <button
            onClick={() => onVote?.(1)}
            className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors cursor-pointer border-none bg-transparent ${
              userVote === 1 ? 'text-[#D41F2D] dark:text-profile-accent bg-red-100 dark:bg-profile-accent/20' : 'text-neutral-500 dark:text-profile-faint hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            <ThumbsUp size={13.5} className={userVote === 1 ? 'fill-current' : ''} />
          </button>
          
          <span className={`text-[12.5px] font-mono font-bold min-w-[20px] text-center ${userVote === 1 ? 'text-[#D41F2D] dark:text-profile-accent' : userVote === -1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-500 dark:text-profile-faint'}`}>
            {votesScore > 0 ? `+${votesScore}` : votesScore}
          </span>

          <button
            onClick={() => onVote?.(-1)}
            className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors cursor-pointer border-none bg-transparent ${
              userVote === -1 ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/20' : 'text-neutral-500 dark:text-profile-faint hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
          >
            <ThumbsDown size={13.5} className={userVote === -1 ? 'fill-current' : ''} />
          </button>
        </div>

        {onViewOnMap && (
          <button
            onClick={onViewOnMap}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-neutral-500 dark:text-profile-faint hover:text-neutral-900 dark:hover:text-profile-text transition-colors cursor-pointer"
          >
            <MapPin size={15} />
            Ver en mapa
          </button>
        )}
      </div>
    </article>
  )
}
