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
  commentsCount: number
  onVote?: (value: 1 | -1) => void
  onViewOnMap?: () => void
  onCommentClick?: () => void
  showTimeline?: boolean
}
