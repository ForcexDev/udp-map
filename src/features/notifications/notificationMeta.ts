import {
  Bell,
  CalendarDays,
  Megaphone,
  MessagesSquare,
  ShieldAlert,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import type { AppNotification, NotificationCategory } from '@/shared/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Cómo se ve cada tipo de aviso, y en qué montón cae.
//
// Vive fuera del componente porque son dos cosas puras y con reglas propias
// —agrupar por fecha y elegir icono— y porque el panel de administración pinta
// los mismos avisos con el mismo lenguaje. Estaban dentro de un JSX de 300
// líneas; sacarlas es lo que permite probarlas.
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryLook {
  icon: LucideIcon
  /** Color del icono y del halo. Uno por categoría: el color ES la categoría. */
  fg: string
  bg: string
}

const LOOKS: Record<NotificationCategory, CategoryLook> = {
  profile: {
    icon: Trophy,
    fg: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-950/50',
  },
  forum: {
    icon: MessagesSquare,
    fg: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-950/50',
  },
  events: {
    icon: CalendarDays,
    fg: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-100 dark:bg-indigo-950/50',
  },
  moderation: {
    icon: ShieldAlert,
    fg: 'text-[#D41F2D] dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950/50',
  },
  system: {
    icon: Megaphone,
    fg: 'text-[#D41F2D] dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950/50',
  },
}

const FALLBACK: CategoryLook = {
  icon: Bell,
  fg: 'text-neutral-500 dark:text-neutral-400',
  bg: 'bg-neutral-100 dark:bg-neutral-800',
}

/**
 * El aspecto de un aviso.
 *
 * El `?? FALLBACK` no sobra: `category` es texto en la base con un CHECK, y una
 * categoría nueva puede llegar desde el servidor antes de que este cliente se
 * actualice. Sin respaldo eso sería un `undefined.icon` en tiempo de render, o
 * sea la pestaña de avisos en blanco por un valor que la base considera válido.
 */
export function notificationLook(category: string): CategoryLook {
  return LOOKS[category as NotificationCategory] ?? FALLBACK
}

export type NotificationGroupId = 'today' | 'week' | 'earlier'

export interface NotificationGroup {
  id: NotificationGroupId
  items: AppNotification[]
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * Reparte los avisos en Hoy / Esta semana / Antes, conservando el orden.
 *
 * "Hoy" es el DÍA DEL CALENDARIO, no las últimas 24 horas: un aviso de ayer a
 * las 23:50 mirado a las 08:00 pertenece a ayer, aunque hayan pasado 8 horas.
 * Los grupos vacíos no salen — un encabezado sin nada debajo es ruido.
 */
export function groupNotifications(
  notifications: AppNotification[],
  now: number = Date.now(),
): NotificationGroup[] {
  const today = startOfDay(now)
  const weekAgo = today - 6 * 24 * 60 * 60_000

  const buckets: Record<NotificationGroupId, AppNotification[]> = {
    today: [],
    week: [],
    earlier: [],
  }

  for (const notification of notifications) {
    const created = new Date(notification.created_at).getTime()
    // Una fecha ilegible no puede tragarse el aviso: cae en "Hoy", que es donde
    // se mira. Perderlo por un `NaN` sería peor que ponerlo en el sitio raro.
    if (Number.isNaN(created) || created >= today) buckets.today.push(notification)
    else if (created >= weekAgo) buckets.week.push(notification)
    else buckets.earlier.push(notification)
  }

  return (['today', 'week', 'earlier'] as const)
    .filter((id) => buckets[id].length > 0)
    .map((id) => ({ id, items: buckets[id] }))
}
