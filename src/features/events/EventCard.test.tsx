import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/shared/lib/i18n'
import type { Pin } from '@/shared/types/database'
import { EventCard } from './EventCard'
import { RSVP_PUBLIC_THRESHOLD } from './api'

// ─────────────────────────────────────────────────────────────────────────────
// El umbral del conteo público.
//
// No es privacidad —`event_rsvp_counts` devuelve el número exacto a
// cualquiera—, es diseño: "2 personas van" dice "esto no le importa a nadie"
// más fuerte que no decir nada. Y quien organiza lo ve siempre, porque para
// preparar algo el 2 también sirve. Es justo la clase de regla que alguien
// simplifica sin querer, así que queda fijada aquí.
// ─────────────────────────────────────────────────────────────────────────────

const event: Pin = {
  id: 'ev1',
  type: 'event',
  title: 'Feria de las carreras',
  description: null,
  category_id: 'feria',
  faculty_id: 'ingenieria',
  lat: -33.4527,
  lng: -70.6611,
  floor: null,
  building_id: null,
  area_id: null,
  room_code: null,
  building: null,
  creator_id: 'organizadora',
  votes_up: 0,
  votes_down: 0,
  reports: 0,
  is_permanent: false,
  expires_at: null,
  starts_at: new Date(Date.now() + 86_400_000).toISOString(),
  ends_at: null,
  is_official: false,
  official_entity_name: null,
  created_at: new Date().toISOString(),
  pin_photos: [],
} as unknown as Pin

function renderCard(props: Partial<React.ComponentProps<typeof EventCard>> = {}) {
  return render(
    <EventCard
      event={event}
      userStatus={null}
      scheduleCount={0}
      now={Date.now()}
      isOrganizer={false}
      onSelect={vi.fn()}
      onRSVPChange={vi.fn()}
      onShowAttendees={vi.fn()}
      {...props}
    />,
  )
}

describe('EventCard — conteo de asistencia', () => {
  it('no enseña nada en público por debajo del umbral', () => {
    renderCard({ rsvpCount: { going: 2, interested: 1 } })

    expect(screen.queryByText(/apuntad/i)).toBeNull()
  })

  it('lo enseña en público al llegar al umbral, sumando las dos intenciones', () => {
    renderCard({ rsvpCount: { going: RSVP_PUBLIC_THRESHOLD - 1, interested: 1 } })

    expect(screen.getByText(`${RSVP_PUBLIC_THRESHOLD} personas apuntadas`)).toBeInTheDocument()
  })

  it('quien organiza ve el número aunque sea bajo, y separado', () => {
    renderCard({ isOrganizer: true, rsvpCount: { going: 2, interested: 1 } })

    expect(screen.getByRole('button', { name: /2 van · 1 interesado/i })).toBeInTheDocument()
  })

  it('sin nadie apuntado no hay línea, ni siquiera para quien organiza', () => {
    renderCard({ isOrganizer: true, rsvpCount: { going: 0, interested: 0 } })

    expect(screen.queryByText(/van|apuntad/i)).toBeNull()
  })
})
