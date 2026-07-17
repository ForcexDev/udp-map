import type { Role } from '@/shared/types/database'

/**
 * Matriz de permisos centralizada (plan §3). Regla de oro: un guest consume
 * pero no produce ni interactúa — toda escritura pasa por can() en la UI y
 * por RLS en la base de datos.
 */
export type Action =
  | 'pin.view'
  | 'pin.create.report'
  | 'pin.create.event'
  | 'pin.create.place'
  | 'pin.comment'
  | 'pin.vote'
  | 'pin.favorite'
  | 'pin.delete.own'
  | 'pin.makePermanent'
  | 'pin.extendTime'
  | 'pin.moderate'
  | 'pin.update.location'
  | 'event.rsvp'
  | 'event.markOfficial'
  | 'forum.post'
  | 'content.report'
  | 'users.manage'

const ROLE_RANK: Record<Role, number> = {
  guest: 0,
  student: 1,
  moderator: 2,
  admin: 3,
}

/** Rol mínimo requerido por acción. */
const MIN_ROLE: Record<Action, Role> = {
  'pin.view': 'guest',
  'pin.create.report': 'student',
  'pin.create.event': 'student',
  'pin.create.place': 'moderator',
  'pin.comment': 'student',
  'pin.vote': 'student',
  'pin.favorite': 'student',
  'pin.delete.own': 'student',
  'pin.makePermanent': 'moderator',
  'pin.extendTime': 'moderator',
  'pin.moderate': 'moderator',
  'pin.update.location': 'moderator',
  'event.rsvp': 'student',
  'event.markOfficial': 'moderator',
  'forum.post': 'student',
  'content.report': 'student',
  'users.manage': 'admin',
}

export function can(role: Role, action: Action): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[MIN_ROLE[action]]
}

export const UDP_EMAIL_DOMAIN = 'mail.udp.cl'

export function isUdpEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${UDP_EMAIL_DOMAIN}`)
}
