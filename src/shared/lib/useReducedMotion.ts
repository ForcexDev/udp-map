import { useSyncExternalStore } from 'react'

// Preferencia del sistema de reducir el movimiento, reactiva: si la persona la
// activa con la app abierta, la animación de la ruta lo respeta sin recargar.

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(QUERY)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia?.(QUERY).matches ?? false

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
