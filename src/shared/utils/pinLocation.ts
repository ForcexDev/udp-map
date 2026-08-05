import type { Pin } from '@/shared/types/database'

type PinLocation = Pick<Pin, 'id' | 'lat' | 'lng' | 'floor' | 'is_permanent' | 'expires_at'>

/**
 * Indica si unas coordenadas exactas ya pertenecen a un pin vigente EN ESA
 * PLANTA. Los pines expirados no reservan la ubicación.
 *
 * La planta forma parte de la identidad del sitio: una impresora en el piso 2 y
 * otra en el 3 de la misma esquina son dos cosas distintas, no un duplicado. Sin
 * comparar la planta, mapear el interior de un edificio de salas era imposible
 * — el segundo piso chocaba entero contra el primero.
 */
export function isPinLocationOccupied(
  pins: PinLocation[],
  lat: number,
  lng: number,
  floor: number | null,
  excludePinId?: string | null,
  now = Date.now(),
): boolean {
  return pins.some((pin) =>
    pin.id !== excludePinId &&
    pin.lat === lat &&
    pin.lng === lng &&
    pin.floor === floor &&
    (pin.is_permanent || !pin.expires_at || new Date(pin.expires_at).getTime() > now),
  )
}
