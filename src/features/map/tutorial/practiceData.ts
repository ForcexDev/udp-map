import type { Pin } from '@/shared/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Datos de mentira para la práctica del tutorial.
//
// No pasan por `pins/demoStore`: ese almacén es el modo sin backend de la app
// y lo que se escriba ahí aparece después en el mapa demo. Estos pines viven
// en el estado local de la práctica y mueren con ella.
// ─────────────────────────────────────────────────────────────────────────────

/** Facultad que se busca en la primera etapa. */
export const FACULTAD_PRACTICA = 'ingenieria'

/** Categoría que se publica y luego se filtra: una que todos entienden. */
export const CATEGORIA_PRACTICA = 'comida'

/** Categorías que ofrece el formulario de práctica. */
export const CATEGORIAS_FORMULARIO = ['comida', 'sala-libre', 'objeto-perdido'] as const

export const PIN_EJEMPLO_ID = 'practica-cafe'
export const PIN_NUEVO_ID = 'practica-nuevo'

const HORA = 60 * 60 * 1000

function pin(
  id: string,
  campos: Pick<Pin, 'title' | 'description' | 'category_id' | 'lat' | 'lng'> & Partial<Pin>,
): Pin {
  const ahora = Date.now()
  return {
    id,
    type: 'report',
    faculty_id: FACULTAD_PRACTICA,
    floor: null,
    building_id: null,
    area_id: null,
    room_code: null,
    building: null,
    creator_id: null,
    creator_name: 'Comunidad UDP',
    votes_up: 4,
    votes_down: 0,
    reports: 0,
    is_permanent: false,
    expires_at: new Date(ahora + 3 * HORA).toISOString(),
    starts_at: null,
    ends_at: null,
    is_official: false,
    created_at: new Date(ahora - 20 * 60 * 1000).toISOString(),
    ...campos,
  }
}

export function pinesPractica(): Pin[] {
  return [
    pin(PIN_EJEMPLO_ID, {
      title: 'Café y sándwiches',
      description: 'Carrito frente a la entrada de Ejército 441. Aceptan tarjeta.',
      category_id: 'comida',
      lat: -33.45248,
      lng: -70.66088,
    }),
    pin('practica-sala', {
      title: 'Sala libre hasta las 16:00',
      description: 'Sala del tercer piso vacía, con enchufes.',
      category_id: 'sala-libre',
      lat: -33.45302,
      lng: -70.66132,
      votes_up: 2,
    }),
    pin('practica-perdido', {
      title: 'Botella azul perdida',
      description: 'Se quedó en la sala de estudio del primer piso.',
      category_id: 'objeto-perdido',
      lat: -33.45229,
      lng: -70.66148,
      votes_up: 1,
    }),
  ]
}

/** El pin que publica la persona en la práctica, donde apuntó la marca. */
export function pinNuevo(lat: number, lng: number, categoria: string, titulo: string): Pin {
  return pin(PIN_NUEVO_ID, {
    title: titulo,
    description: null,
    category_id: categoria,
    lat,
    lng,
    votes_up: 0,
    creator_name: null,
    created_at: new Date().toISOString(),
  })
}
