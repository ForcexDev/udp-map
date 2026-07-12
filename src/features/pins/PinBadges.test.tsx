import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/shared/lib/i18n'
import type { Pin } from '@/shared/types/database'
import { PinBadges } from './PinBadges'

const base: Pin = {
  id: 'p1',
  type: 'report',
  title: 'Camión de Monster',
  description: null,
  category_id: 'food-truck',
  faculty_id: null,
  lat: -33.45,
  lng: -70.65,
  floor: null,
  building: null,
  creator_id: 'u1',
  votes_up: 0,
  votes_down: 0,
  reports: 0,
  is_permanent: false,
  expires_at: new Date(Date.now() + 5 * 3600_000).toISOString(),
  starts_at: null,
  ends_at: null,
  is_official: false,
  created_at: new Date().toISOString(),
}

describe('PinBadges', () => {
  it('muestra tipo, categoría y expiración para un report efímero', () => {
    render(<PinBadges pin={base} />)
    expect(screen.getByText('Reporte')).toBeInTheDocument()
    expect(screen.getByText(/Expira/)).toBeInTheDocument()
    expect(screen.queryByText('Permanente')).not.toBeInTheDocument()
  })

  it('muestra badge de permanente y sin expiración para un place', () => {
    render(
      <PinBadges
        pin={{ ...base, type: 'place', category_id: null, is_permanent: true, expires_at: null }}
      />,
    )
    expect(screen.getByText('Lugar')).toBeInTheDocument()
    expect(screen.getByText('Permanente')).toBeInTheDocument()
    expect(screen.queryByText(/Expira/)).not.toBeInTheDocument()
  })
})
