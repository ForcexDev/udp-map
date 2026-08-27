import { describe, expect, it, beforeEach, vi } from 'vitest'

// Sin Supabase, `updatePinLocation` toma la rama demo, que replica lo que hace
// la base: es donde se puede comprobar la regla sin una base delante.
vi.mock('@/shared/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  PHOTOS_BUCKET: 'pin-photos',
}))

const { updatePinLocation } = await import('./api')
const { demoDb } = await import('./demoStore')
const { useAuthStore } = await import('@/features/auth/authStore')

// ─────────────────────────────────────────────────────────────────────────────
// Mover un pin de sitio es permiso de moderador.
//
// La regla existía desde siempre en `can(role, 'pin.update.location')` y en el
// botón que PinDetail esconde, pero hasta el 2026-08-26 no existía en el
// servidor: `pins_owner_update` deja al autor escribir su fila y
// protect_pin_sensitive_fields protege `building_id` y `area_id` —los derivados
// del punto— pero no `lat` ni `lng`. Ahora la impone `trg_authorize_pin_move`,
// y esto fija que el modo demo diga lo mismo.
// ─────────────────────────────────────────────────────────────────────────────

const PIN_ID = 'test-mover'
const ORIGEN = { lat: -33.4527, lng: -70.6611 }
const DESTINO = { lat: -33.4444, lng: -70.6666 }

function seedPin() {
  demoDb.pins = demoDb.pins.filter((p) => !p.id.startsWith('test-'))
  demoDb.pins.push({
    id: PIN_ID,
    type: 'report',
    title: 'Impresora del segundo',
    description: null,
    category_id: 'impresora',
    faculty_id: 'ingenieria',
    lat: ORIGEN.lat,
    lng: ORIGEN.lng,
    floor: null,
    building_id: null,
    area_id: null,
    room_code: null,
    building: null,
    creator_id: 'demo-student',
    votes_up: 0,
    votes_down: 0,
    reports: 0,
    is_permanent: false,
    expires_at: null,
    starts_at: null,
    ends_at: null,
    is_official: false,
    official_entity_name: null,
    created_at: new Date().toISOString(),
    pin_photos: [],
  } as never)
}

const pin = () => demoDb.pins.find((p) => p.id === PIN_ID)!

describe('updatePinLocation — quién puede mover un pin', () => {
  beforeEach(() => {
    seedPin()
  })

  it('un estudiante no puede mover su propio pin', async () => {
    useAuthStore.setState({ role: 'student' })

    await expect(updatePinLocation(PIN_ID, DESTINO.lat, DESTINO.lng)).rejects.toThrow(
      /permiso de moderador/,
    )
    expect(pin().lat).toBe(ORIGEN.lat)
    expect(pin().lng).toBe(ORIGEN.lng)
  })

  it('un invitado tampoco', async () => {
    useAuthStore.setState({ role: 'guest' })

    await expect(updatePinLocation(PIN_ID, DESTINO.lat, DESTINO.lng)).rejects.toThrow(
      /permiso de moderador/,
    )
    expect(pin().lat).toBe(ORIGEN.lat)
  })

  it('un moderador sí', async () => {
    useAuthStore.setState({ role: 'moderator' })

    await updatePinLocation(PIN_ID, DESTINO.lat, DESTINO.lng)

    expect(pin().lat).toBe(DESTINO.lat)
    expect(pin().lng).toBe(DESTINO.lng)
  })

  it('el destino ocupado se sigue rechazando, ya con permiso', async () => {
    useAuthStore.setState({ role: 'moderator' })
    demoDb.pins.push({ ...pin(), id: 'test-vecino', lat: DESTINO.lat, lng: DESTINO.lng } as never)

    await expect(updatePinLocation(PIN_ID, DESTINO.lat, DESTINO.lng)).rejects.toThrow(
      'PIN_LOCATION_OCCUPIED',
    )
    expect(pin().lat).toBe(ORIGEN.lat)
  })
})
