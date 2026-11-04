import { useEffect, useRef } from 'react'
import {
  disablePushOnThisDevice,
  resolvePushState,
  subscribeToPush,
  syncPushSubscription,
  unsubscribeFromPush,
  usePushStore,
  pushApiSupported,
} from './pushStore'

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
  const serverSync = usePushStore((s) => s.serverSync)
  const operation = usePushStore((s) => s.operation)

  useEffect(() => {
    void resolvePushState()
  }, [])

  return {
    state,
    error,
    serverSync,
    operation,
    subscribe: subscribeToPush,
    unsubscribe: unsubscribeFromPush,
    // «Reintentar» repite lo que falló. Antes volvía siempre a activar, y quien
    // había fallado al DESACTIVAR acababa activando.
    retry: operation === 'unsubscribe' ? unsubscribeFromPush : subscribeToPush,
    // Reintentar solo el aviso al servidor, sin tocar la suscripción del navegador.
    retrySync: () => syncPushSubscription({ force: true }),
  }
}

/**
 * Mantiene al día lo que el servidor sabe de este dispositivo. Se monta UNA vez,
 * en `App`, que le pasa el id del usuario con sesión (o `null`).
 *
 * Vive separado del hook de arriba a propósito: `App` está siempre montado y
 * los paneles no. Cuando esto colgaba del Sidebar —que hace `if (!isOpen)
 * return null`— la resincronización solo corría con el panel abierto, y en iOS,
 * donde el endpoint rota solo, eso significaba que el servidor seguía enviando
 * a una suscripción muerta hasta que alguien abría el panel por casualidad.
 *
 * Hace tres cosas:
 *  - al montarse, resuelve el estado del dispositivo (y de paso lo registra);
 *  - al volver a primer plano, resincroniza. No lo hace también al montarse: ya
 *    lo hace la resolución, y eran dos RPC por arranque. `syncPushSubscription`
 *    además se salta el registro si el mismo usuario y endpoint ya se
 *    registraron hace menos de una hora;
 *  - cuando cambia el usuario, que es lo que cubre las sesiones que terminan
 *    SIN pasar por `signOut` (caducó el token, cerró otra pestaña).
 *
 * No pide permisos ni crea suscripciones; solo reporta la que ya exista.
 */
export function usePushForegroundSync(userId: string | null) {
  // Con el id de la primera pintura de inicial, el arranque nunca cuenta como un
  // cambio: sin esto, `undefined → id` se leería como «hay sesión nueva».
  const previousUserId = useRef(userId)

  useEffect(() => {
    void resolvePushState()
    if (!pushApiSupported()) return

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void syncPushSubscription()
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    const before = previousUserId.current
    previousUserId.current = userId
    if (before === userId) return

    if (!userId) {
      // De un id a nada: la sesión terminó sin que nadie pulsara «Cerrar
      // sesión». Si el navegador siguiera suscrito, recibiría los avisos de la
      // cuenta que se fue, y el siguiente que entre heredaría un estado que no
      // es suyo. La baja es SOLO local: ya no hay sesión con la que borrar en
      // el servidor, y la fila caduca sola con el primer 404/410.
      void disablePushOnThisDevice({ server: false }).catch((cause: unknown) => {
        console.error(
          '[web-push] No se pudo dar de baja el dispositivo al terminar la sesión:',
          cause,
        )
      })
      return
    }

    // De nada a un id (también el arranque, cuando la sesión guardada llega
    // después del primer render): lo resuelto hasta ahora se resolvió SIN ella.
    // Esto nunca da de baja nada: el arranque no puede cerrar la suscripción de
    // nadie.
    void resolvePushState({ force: true })
  }, [userId])
}
