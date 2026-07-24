import type { Role } from '@/shared/types/database'

export function memberSince(dateStr: string | null | undefined, lang: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const s = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CL', {
    month: 'short',
    year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function handleFromEmail(email: string | null | undefined, fallbackName?: string | null): string {
  if (email) return '@' + email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_')
  if (fallbackName) return '@' + fallbackName.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  return '@usuario'
}

export const ROLE_COLORS: Record<Role, string> = {
  guest: 'text-neutral-500',
  student: 'text-blue-600 dark:text-blue-400',
  moderator: 'text-amber-600 dark:text-amber-500',
  admin: 'text-[#D41F2D] dark:text-profile-accent',
}
