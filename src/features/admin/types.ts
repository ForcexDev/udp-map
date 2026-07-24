import type { Role, PinType } from '@/shared/types/database'

export type AdminTab = 'dashboard' | 'users' | 'content' | 'push' | 'activity'

export interface DashboardStats {
  totalUsers: number
  roleCounts: Record<Role, number>
  totalPins: number
  activePins: number
  pinsToday: number
  upcomingEvents: number
  pendingReports: number
  totalKarma: number
  pushSubscribers: number
}

export interface ActivityEntry {
  id: string
  type: 'pin_created' | 'report_submitted' | 'user_registered' | 'report_resolved'
  title: string
  actorName: string
  timestamp: string
  targetUrl?: string
  badgeColor?: string
}

export interface AdminUserFilter {
  search?: string
  role?: Role | 'all'
}

export interface AdminPinFilter {
  type?: PinType | 'all'
  status?: 'all' | 'active' | 'expired' | 'permanent'
  facultyId?: string | 'all'
  search?: string
}
