import type { Role, PinType } from '@/shared/types/database'

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
  type: 'pin_created' | 'report_submitted'
  title: string
  timestamp: string
}

export interface AdminUserFilter {
  search?: string
  role?: Role | 'all'
}

export interface AdminPinFilter {
  type?: PinType | 'all'
  search?: string
}
