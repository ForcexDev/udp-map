import type { Pin, PinComment, PinPhoto, PinScheduleDraft, PinScheduleItem } from '@/shared/types/database'
import { FACULTIES } from '@/shared/data/campusData'

// ─────────────────────────────────────────────────────────────────
// MODO DEMO: base de datos en memoria para desarrollar/mostrar la UI
// sin Supabase. La API pública espeja features/pins/api.ts.
// ─────────────────────────────────────────────────────────────────

const hours = (n: number) => new Date(Date.now() + n * 3600_000).toISOString()
const ago = (n: number) => new Date(Date.now() - n * 3600_000).toISOString()

function placeFromFaculty(f: (typeof FACULTIES)[number]): Pin {
  return {
    id: `place-${f.id}`,
    type: 'place',
    title: f.name,
    description: null,
    category_id: null,
    faculty_id: f.id,
    lat: f.lat,
    lng: f.lng,
    floor: null,
    building: null,
    creator_id: null,
    votes_up: 0,
    votes_down: 0,
    reports: 0,
    is_permanent: true,
    expires_at: null,
    starts_at: null,
    ends_at: null,
    is_official: true,
    created_at: ago(24 * 30),
    pin_photos: [],
  }
}

const demoReport = (
  id: string,
  title: string,
  category_id: string,
  lat: number,
  lng: number,
  expiresInHours: number,
  description?: string,
): Pin => ({
  id,
  type: 'report',
  title,
  description: description ?? null,
  category_id,
  faculty_id: null,
  lat,
  lng,
  floor: null,
  building: null,
  creator_id: 'demo-otro',
  votes_up: Math.floor(Math.random() * 8),
  votes_down: 0,
  reports: 0,
  is_permanent: false,
  expires_at: hours(expiresInHours),
  starts_at: null,
  ends_at: null,
  is_official: false,
  created_at: ago(1),
  pin_photos: [],
})

export const demoDb = {
  pins: [
    ...FACULTIES.map(placeFromFaculty),
    demoReport('r-monster', 'Camión de Monster regalando latas', 'food-truck', -33.4494, -70.6551, 5, 'Está en la entrada de Ejército, ¡corran!'),
    demoReport('r-empanadas', 'Empanadas a $1.000 afuera de Derecho', 'comida', -33.4461, -70.6621, 3),
    demoReport('r-mochila', 'Mochila azul encontrada en el patio', 'objeto-encontrado', -33.4479, -70.6606, 48, 'La dejé en portería de República.'),
    demoReport('r-estudio', 'Buscamos gente para estudiar Cálculo II', 'estudio', -33.4497, -70.6539, 1.5, 'Estamos en el 3er piso de la biblioteca.'),
  ] as Pin[],
  comments: new Map<string, PinComment[]>([
    [
      'r-monster',
      [
        {
          id: 'c1',
          pin_id: 'r-monster',
          author_id: 'demo-otro',
          author_name: 'Cata M.',
          body: 'Confirmo, quedan pocas 🥤',
          created_at: ago(0.5),
        },
      ],
    ],
    [
      'place-ingenieria',
      [
        {
          id: 'c2',
          pin_id: 'place-ingenieria',
          author_id: 'demo-otro',
          author_name: 'Seba R.',
          body: 'El 3er piso tiene enchufes al lado de las ventanas 🔌',
          created_at: ago(20),
        },
      ],
    ],
  ]),
  votes: new Map<string, Map<string, 1 | -1>>(), // pinId → (userId → value)
  favorites: new Set<string>(), // `${userId}:${pinId}`
}

/** Historial separado para que borrar un pin no permita eludir el límite diario. */
export const demoPinCreationEvents = demoDb.pins
  .filter((pin) => pin.creator_id !== null)
  .map((pin) => ({ creator_id: pin.creator_id as string, created_at: pin.created_at }))

export function demoAddPhotos(pinId: string, files: File[]): PinPhoto[] {
  const pin = demoDb.pins.find((p) => p.id === pinId)
  if (!pin) return []
  const photos: PinPhoto[] = files.map((f) => ({
    id: crypto.randomUUID(),
    pin_id: pinId,
    url: URL.createObjectURL(f),
    width: null,
    height: null,
    created_at: new Date().toISOString(),
  }))
  pin.pin_photos = [...(pin.pin_photos ?? []), ...photos]
  return photos
}

/** Programa por pin. Espeja pin_schedule_items: sin update, se reemplaza entero. */
export const demoSchedules = new Map<string, PinScheduleItem[]>()

export function demoReplaceSchedule(pinId: string, items: PinScheduleDraft[]): PinScheduleItem[] {
  if (items.length === 0) {
    demoSchedules.delete(pinId)
    return []
  }
  const rows: PinScheduleItem[] = items.map((item, i) => ({
    ...item,
    id: crypto.randomUUID(),
    pin_id: pinId,
    sort_order: item.sort_order ?? i,
    created_at: new Date().toISOString(),
  }))
  demoSchedules.set(pinId, rows)
  return rows
}

export function demoRemovePhotos(pinId: string, photoIds: string[]): void {
  const pin = demoDb.pins.find((p) => p.id === pinId)
  if (!pin || !pin.pin_photos) return
  pin.pin_photos = pin.pin_photos.filter((ph) => !photoIds.includes(ph.id))
}

export function demoVerifyPin(pinId: string, verifierName: string = 'Centro de Alumnos FIC'): void {
  const pin = demoDb.pins.find((p) => p.id === pinId)
  if (!pin || pin.is_permanent) return
  pin.is_permanent = true
  pin.type = 'place'
  pin.expires_at = null
  pin.verifier_entity_name = verifierName
}

export function demoUnverifyPin(pinId: string, hours: number = 24): void {
  const pin = demoDb.pins.find((p) => p.id === pinId)
  if (!pin || !pin.is_permanent || !pin.verifier_entity_name) return
  pin.is_permanent = false
  pin.type = 'report'
  pin.verifier_entity_name = null
  pin.expires_at = new Date(Date.now() + hours * 3600 * 1000).toISOString()
}

export function demoExtendPinTTL(pinId: string, hours: number = 24): void {
  const pin = demoDb.pins.find((p) => p.id === pinId)
  if (!pin) return
  const currentExp = pin.expires_at ? new Date(pin.expires_at).getTime() : Date.now()
  const baseTime = Math.max(currentExp, Date.now())
  pin.expires_at = new Date(baseTime + hours * 3600 * 1000).toISOString()
}
