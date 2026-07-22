import type { Pin } from '@/shared/types/database'

type PinLocation = Pick<Pin, 'id' | 'lat' | 'lng' | 'is_permanent' | 'expires_at'>

/**
 * Indica si unas coordenadas exactas ya pertenecen a un pin vigente.
 * Los pines expirados no reservan la ubicación.
 */
export function isPinLocationOccupied(
  pins: PinLocation[],
  lat: number,
  lng: number,
  excludePinId?: string | null,
  now = Date.now(),
): boolean {
  return pins.some((pin) =>
    pin.id !== excludePinId &&
    pin.lat === lat &&
    pin.lng === lng &&
    (pin.is_permanent || !pin.expires_at || new Date(pin.expires_at).getTime() > now),
  )
}
