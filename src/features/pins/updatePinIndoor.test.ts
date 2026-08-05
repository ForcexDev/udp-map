import { describe, expect, it, beforeEach, vi } from 'vitest'

// Sin Supabase, `updatePin` toma la rama demo, que replica lo que hace la base:
// es donde se puede comprobar la regla sin una base de datos delante.
vi.mock('@/shared/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  PHOTOS_BUCKET: 'pin-photos',
}))

const { updatePin } = await import('./api')
const { demoDb } = await import('./demoStore')

// ─────────────────────────────────────────────────────────────────────────────
// La planta y el código de sala los edita el AUTOR.
//
// La base nunca los protegió —protect_pin_sensitive_fields solo revierte
// building_id y area_id, que se deducen del punto— pero el formulario de
// edición no los ofrecía, así que corregir en qué piso está una sala era
// imposible desde la interfaz. Estas pruebas fijan las tres reglas que salieron
// de arreglarlo.
// ─────────────────────────────────────────────────────────────────────────────

const PIN_ID = 'test-sala-211'

function seedRoomPin(overrides: Record<string, unknown> = {}) {
  demoDb.pins = demoDb.pins.filter((p) => !p.id.startsWith('test-'))
  demoDb.pins.push({
    id: PIN_ID,
    type: 'report',
    title: 'Sala 211',
    description: null,
    category_id: 'sala',
    faculty_id: 'ingenieria',
    lat: -33.4527,
    lng: -70.6611,
    floor: 2,
    building_id: 'ingenieria-v432',
    area_id: 'area-piso-2',
    room_code: 'V432.2.211',
    building: null,
    creator_id: 'demo-student',
    votes_up: 0,
    votes_down: 0,
    reports: 0,
    is_permanent: true,
    expires_at: null,
    starts_at: null,
    ends_at: null,
    is_official: false,
    official_entity_name: null,
    created_at: new Date().toISOString(),
    pin_photos: [],
    ...overrides,
  } as never)
}

const pin = () => demoDb.pins.find((p) => p.id === PIN_ID)!

describe('updatePin — planta y código de sala', () => {
  beforeEach(() => {
    seedRoomPin()
  })

  it('guarda la planta y el código nuevos', async () => {
    await updatePin(PIN_ID, { floor: 3, roomCode: 'V432.3.311' })

    expect(pin().floor).toBe(3)
    expect(pin().room_code).toBe('V432.3.311')
  })

  it('suelta el área al cambiar de planta: la vieja era de otro piso', async () => {
    await updatePin(PIN_ID, { floor: 3 })

    expect(pin().area_id).toBeNull()
    // El edificio no cambia: el pin sigue en el mismo punto.
    expect(pin().building_id).toBe('ingenieria-v432')
  })

  it('conserva el área si la planta no cambia', async () => {
    await updatePin(PIN_ID, { floor: 2, roomCode: 'V432.2.211' })

    expect(pin().area_id).toBe('area-piso-2')
  })

  it('rechaza mudarse a una planta ya ocupada en el mismo punto', async () => {
    demoDb.pins.push({ ...pin(), id: 'test-vecino', floor: 3, room_code: 'V432.3.311' } as never)

    await expect(updatePin(PIN_ID, { floor: 3 })).rejects.toThrow('PIN_LOCATION_OCCUPIED')
    // Nada a medias: el pin se queda como estaba.
    expect(pin().floor).toBe(2)
    expect(pin().area_id).toBe('area-piso-2')
  })

  it('no toca la planta cuando la edición no la menciona', async () => {
    await updatePin(PIN_ID, { title: 'Sala 211 — proyector nuevo' })

    expect(pin().floor).toBe(2)
    expect(pin().area_id).toBe('area-piso-2')
    expect(pin().room_code).toBe('V432.2.211')
  })
})
