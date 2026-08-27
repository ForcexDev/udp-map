import { useEffect } from 'react'
import {
  resolvePushState,
  subscribeToPush,
  syncPushSubscription,
  unsubscribeFromPush,
  usePushStore,
  pushApiSupported,
  type PushState,
} from './pushStore'

export type { PushState }

// ─────────────────────────────────────────────────────────────────────────────
// El hook ya no GUARDA nada: solo lee el store y dispara la comprobación.
//
// Tenía un `useState` propio, y como todos sus consumidores se montan y
// desmontan (el Sidebar se cierra, Radix desmonta la pestaña inactiva), cada
// reaparición volvía a empezar en "no suscrito" hasta que la red respondía. Eso
// era el parpadeo entre «Activar» y «Desactivar» que se veía al volver a la
// pestaña de avisos. El porqué completo está en `pushStore.ts`.
//
// Se puede llamar desde tantos sitios como haga falta: la resolución está
// deduplicada y la suscripción al store es la de zustand.
// ─────────────────────────────────────────────────────────────────────────────

export function usePushSubscription() {
  const state = usePushStore((s) => s.state)
  const error = usePushStore((s) => s.error)

  useEffect(() => {
    void resolvePushState()
  }, [])

  return {
    state,
    error,
    subscribe: subscribeToPush,
    unsubscribe: unsubscribeFromPush,
  }
}

/**
 * Resincroniza el endpoint de este navegador cada vez que la app vuelve a
 * primer plano. Se monta UNA vez, en `App`.
 *
 * Vive separado del hook de arriba a propósito: `App` está siempre montado y
 * los paneles no. Cuando esto colgaba del Sidebar —que hace `if (!isOpen)
 * return null`— la resincronización solo corría con el panel abierto, y en iOS,
 * donde el endpoint rota solo, eso significaba que el servidor seguía enviando
 * a una suscripción muerta hasta que alguien abría el panel por casualidad.
 */
export function usePushForegroundSync() {
  useEffect(() => {
    if (!pushApiSupported()) return

    void resolvePushState()

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void syncPushSubscription()
    }

    onVisible()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
}
