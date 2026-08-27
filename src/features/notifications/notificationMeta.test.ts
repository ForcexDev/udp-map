import { describe, expect, it } from 'vitest'
import type { AppNotification } from '@/shared/types/database'
import { groupNotifications, notificationLook } from './notificationMeta'

function notification(id: string, createdAt: string): AppNotification {
  return {
    id,
    user_id: 'u1',
    actor_id: null,
    type: 'forum_reply',
    category: 'forum',
    audience: 'personal',
    title: id,
    body: '',
    url: '/',
    payload: {},
    dedupe_key: id,
    read_at: null,
    created_at: createdAt,
  }
}

// Mediodía, para que sumar y restar horas no cruce la medianoche sin querer.
const NOW = new Date('2026-08-27T12:00:00').getTime()

describe('groupNotifications', () => {
  it('“Hoy” es el día del calendario, no las últimas 24 horas', () => {
    // Ayer a las 23:50 son 12 h antes de ahora, pero pertenece a ayer: quien
    // mira la bandeja a mediodía no considera "de hoy" algo de anoche.
    const groups = groupNotifications(
      [
        notification('esta-mañana', '2026-08-27T08:00:00'),
        notification('anoche', '2026-08-26T23:50:00'),
      ],
      NOW,
    )

    expect(groups.map((g) => g.id)).toEqual(['today', 'week'])
    expect(groups[0].items.map((n) => n.id)).toEqual(['esta-mañana'])
    expect(groups[1].items.map((n) => n.id)).toEqual(['anoche'])
  })

  it('separa la semana de lo más viejo', () => {
    const groups = groupNotifications(
      [
        notification('hace-tres-días', '2026-08-24T10:00:00'),
        notification('hace-un-mes', '2026-07-27T10:00:00'),
      ],
      NOW,
    )

    expect(groups.map((g) => g.id)).toEqual(['week', 'earlier'])
  })

  it('no devuelve grupos vacíos', () => {
    const groups = groupNotifications([notification('solo-uno', '2026-08-27T09:00:00')], NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe('today')
  })

  it('conserva el orden que traía la lista dentro de cada grupo', () => {
    const groups = groupNotifications(
      [
        notification('nuevo', '2026-08-27T11:00:00'),
        notification('viejo', '2026-08-27T07:00:00'),
      ],
      NOW,
    )
    expect(groups[0].items.map((n) => n.id)).toEqual(['nuevo', 'viejo'])
  })

  it('una fecha ilegible cae en “Hoy” en vez de perderse', () => {
    const groups = groupNotifications([notification('rota', 'no es una fecha')], NOW)
    expect(groups[0].id).toBe('today')
    expect(groups[0].items).toHaveLength(1)
  })

  it('sin avisos no hay grupos', () => {
    expect(groupNotifications([], NOW)).toEqual([])
  })
})

describe('notificationLook', () => {
  it('da un aspecto propio a cada categoría', () => {
    expect(notificationLook('forum').icon).not.toBe(notificationLook('events').icon)
    expect(notificationLook('system').icon).not.toBe(notificationLook('profile').icon)
  })

  it('una categoría desconocida no revienta el render', () => {
    // El CHECK de la base puede crecer antes que este cliente. Sin respaldo,
    // eso sería un `undefined.icon` y la pestaña de avisos en blanco.
    const look = notificationLook('categoria_del_futuro')
    expect(look.icon).toBeTruthy()
    expect(look.fg).toBeTruthy()
    expect(look.bg).toBeTruthy()
  })
})
