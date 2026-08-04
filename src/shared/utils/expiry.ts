/** Ventana de "desvanecimiento" visual antes de expirar (plan §7: reports efímeros). */
export const FADE_WINDOW_MS = 2 * 60 * 60 * 1000 // últimas 2 horas

/**
 * El desvanecimiento no arranca en opacidad 1.
 *
 * Con una rampa lineal desde 1, un pin recién entrado en la ventana se veía
 * idéntico a uno que aún tenía doce horas por delante: el aviso solo era
 * legible comparando dos marcadores, y en el mapa nunca los tienes al lado.
 * Entrar en la ventana ahora da un escalón visible y a partir de ahí baja.
 */
export const FADE_START_OPACITY = 0.72
export const MIN_FADE_OPACITY = 0.22

type ExpiryStatus = 'permanent' | 'active' | 'fading' | 'expired'

interface ExpiryState {
  status: ExpiryStatus
  /** Opacidad sugerida para el marcador (1 → MIN_FADE_OPACITY al acercarse al fin) */
  opacity: number
  remainingMs: number | null
}

export function expiryState(
  expiresAt: string | null,
  isPermanent: boolean,
  now: number = Date.now(),
): ExpiryState {
  if (isPermanent || expiresAt === null) {
    return { status: 'permanent', opacity: 1, remainingMs: null }
  }
  const remaining = new Date(expiresAt).getTime() - now
  if (remaining <= 0) return { status: 'expired', opacity: 0, remainingMs: 0 }
  if (remaining >= FADE_WINDOW_MS) return { status: 'active', opacity: 1, remainingMs: remaining }
  const t = remaining / FADE_WINDOW_MS // 1 → 0
  const opacity = MIN_FADE_OPACITY + (FADE_START_OPACITY - MIN_FADE_OPACITY) * t
  return { status: 'fading', opacity, remainingMs: remaining }
}

/** expires_at a partir del TTL de la categoría; null si no aplica. */
export function expiresAtFromTtl(ttlHours: number | null, from: number = Date.now()): string | null {
  if (ttlHours === null || ttlHours <= 0) return null
  return new Date(from + ttlHours * 60 * 60 * 1000).toISOString()
}
