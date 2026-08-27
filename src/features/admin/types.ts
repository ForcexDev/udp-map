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

export type ActivityAction =
  | 'pin_created'
  | 'pin_deleted'
  | 'pin_verified'
  | 'pin_unverified'
  | 'report_filed'
  | 'report_claimed'
  | 'report_resolved'
  | 'report_dismissed'
  | 'role_changed'
  | 'broadcast_sent'

export interface ActivityEntry {
  id: string
  action: ActivityAction
  /** Quién lo hizo. `null` si fue el sistema o la cuenta ya no existe. */
  actorName: string | null
  /** Una línea ya legible: el registro la guarda resuelta. */
  summary: string
  timestamp: string
}

export interface ActivityFeed {
  entries: ActivityEntry[]
  /**
   * `false` mientras la migración 20260828000000 no esté aplicada.
   *
   * En ese caso lo que se enseña es el apaño de antes —los últimos pines y
   * denuncias VIVOS, reconstruidos en el cliente—, que no incluye lo borrado ni
   * dice quién hizo nada. La pantalla lo advierte en vez de fingir que es un
   * registro.
   */
  fromLog: boolean
}

export interface AdminUserFilter {
  search?: string
  role?: Role | 'all'
}

export interface AdminPinFilter {
  type?: PinType | 'all'
  search?: string
}
