import { create } from 'zustand'
import { deletePushSubscription, registerPushSubscription } from './api'
import { isIOSDevice, isStandaloneDisplay } from '@/shared/utils/pwa'

// ─────────────────────────────────────────────────────────────────────────────
// El estado del push vive AQUÍ, fuera de React, y hay uno solo.
//
// Antes vivía en un `useState` dentro de `usePushSubscription`, y eso producía
// el parpadeo que se veía al volver a la pestaña de avisos: el Sidebar se
// desmonta entero al cerrarse (`if (!isOpen) return null`) y Radix desmonta la
// pestaña inactiva, así que el hook nacía de cero en `idle` —o sea pintando
// "Activar"— y solo pasaba a `subscribed` después de `serviceWorker.ready`,
// `getSubscription()` y UNA LLAMADA DE RED a Supabase. Ese viaje era el
// parpadeo. Encima `App` montaba una segunda instancia con su propio estado, de
// modo que había dos verdades distintas sobre el mismo dispositivo.
//
// Tres decisiones que lo cierran, y conviene no deshacerlas:
//
//  1. `unknown` es un estado de verdad, no un `idle` disfrazado. Mientras no
//     sepamos, la interfaz pinta un esqueleto; nunca "Activar", que es una
//     mentira que invita a pulsar algo que ya está hecho.
//  2. El último estado conocido se guarda en localStorage y siembra el store al
//     arrancar. Así ni siquiera la primera pintura tras recargar parpadea.
//  3. `subscribed` se decide con lo que dice el NAVEGADOR, y la sincronización
//     con el servidor va después y en segundo plano. Antes el estado esperaba a
//     que la RPC volviera: si Supabase tardaba, el usuario veía "Activar" con
//     las notificaciones ya activadas.
// ─────────────────────────────────────────────────────────────────────────────

export type PushState =
  /** Todavía no se ha comprobado el dispositivo. La interfaz pinta esqueleto. */
  | 'unknown'
  | 'unsupported'
  | 'ios-not-installed'
  | 'idle'
  | 'subscribed'
  | 'denied'
  | 'loading'
  | 'error'

const LAST_KNOWN_KEY = 'udpmap.push.subscribed'

function readLastKnown(): boolean {
  try {
    return localStorage.getItem(LAST_KNOWN_KEY) === 'true'
  } catch {
    return false
  }
}

function writeLastKnown(subscribed: boolean): void {
  try {
    localStorage.setItem(LAST_KNOWN_KEY, subscribed ? 'true' : 'false')
  } catch {
    // Modo privado de Safari y poco más. No es motivo para romper nada.
  }
}

export function pushApiSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

/**
 * iOS solo entrega push de forma fiable a la PWA instalada en la pantalla de
 * inicio. Desde una pestaña de Safari, `subscribe()` puede "funcionar" y las
 * notificaciones no llegar nunca con el navegador cerrado — que es justo el
 * caso que la gente reporta como "a mí no me llega".
 */
export function iosNeedsInstall(): boolean {
  return pushApiSupported() && isIOSDevice() && !isStandaloneDisplay()
}

/** El estado con el que arranca el store, sin tocar la red ni el service worker. */
function seedState(): PushState {
  if (!pushApiSupported()) return 'unsupported'
  if (iosNeedsInstall()) return 'ios-not-installed'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'idle'
  // Permiso concedido: lo más probable es que siga suscrito. Si resulta que no,
  // `resolvePushState()` lo corrige en cuanto el service worker responde.
  return readLastKnown() ? 'subscribed' : 'unknown'
}

export function pushErrorMessage(cause: unknown): string {
  const technicalMessage = cause instanceof Error ? cause.message : String(cause)
  const errorName = cause instanceof DOMException ? cause.name : ''

  if (Notification.permission === 'denied' || errorName === 'NotAllowedError') {
    return 'Las notificaciones están bloqueadas para este sitio. Permítelas desde el candado de la barra de direcciones y vuelve a intentar.'
  }

  if (
    errorName === 'AbortError'
    || /registration failed|push service error|push service|service unavailable/i.test(technicalMessage)
  ) {
    return 'El navegador no pudo conectarse a su servicio de notificaciones. Revisa los permisos del sistema y del sitio, y prueba sin VPN, bloqueadores ni modo privado.'
  }

  if (/applicationserverkey|vapid|invalid.*key/i.test(technicalMessage)) {
    return 'La configuración de Web Push de la aplicación no es válida. Contacta al administrador.'
  }

  if (/service worker/i.test(technicalMessage)) {
    return 'No se pudo preparar el servicio que recibe las notificaciones en segundo plano. Recarga la página y vuelve a intentar.'
  }

  return 'No pudimos activar las notificaciones en este dispositivo. Revisa los permisos del navegador y vuelve a intentar.'
}

interface PushStore {
  state: PushState
  error: string | null
  /** El endpoint del navegador, para el diagnóstico del panel. */
  endpoint: string | null
  setState: (state: PushState, error?: string | null) => void
  setEndpoint: (endpoint: string | null) => void
}

export const usePushStore = create<PushStore>((set) => ({
  state: typeof window === 'undefined' ? 'unknown' : seedState(),
  error: null,
  endpoint: null,
  setState: (state, error = null) => {
    if (state === 'subscribed' || state === 'idle') writeLastKnown(state === 'subscribed')
    set({ state, error })
  },
  setEndpoint: (endpoint) => set({ endpoint }),
}))

/** Lo que tarda el service worker en estar listo antes de darlo por perdido. */
const SERVICE_WORKER_TIMEOUT_MS = 10_000

/**
 * `navigator.serviceWorker.ready` con un límite de paciencia.
 *
 * La promesa nativa **no resuelve nunca** si no hay un service worker
 * registrado para este ámbito: no rechaza, se queda colgada para siempre. Pasa
 * en el servidor de desarrollo, donde vite-plugin-pwa no sirve el service
 * worker (solo lo inyecta en la compilación), y pasaría también si el registro
 * fallara en producción.
 *
 * Sin este límite, pulsar «Activar» pedía el permiso al navegador, lo
 * conseguía, y se quedaba en «Activando…» hasta que alguien recargara — sin un
 * solo error en la consola, porque técnicamente no había fallado nada.
 */
async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('El service worker no llegó a estar listo.')),
          SERVICE_WORKER_TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index)
  return output
}

/**
 * Le cuenta al servidor el endpoint que tiene HOY este navegador.
 *
 * Existe porque en iOS el endpoint rota en silencio: el service worker se
 * re-suscribe solo (`pushsubscriptionchange`) pero no puede avisar al servidor
 * —no tiene la sesión—, así que hasta que la página no corre esto, el servidor
 * sigue enviando a una suscripción muerta. Es la causa de "me llegaban y de
 * repente dejaron de llegar" sin que nadie tocara nada.
 *
 * No pide permisos ni crea suscripciones: si no hay una, no hace nada.
 */
export async function syncPushSubscription(): Promise<void> {
  if (!pushApiSupported()) return
  if (Notification.permission !== 'granted') return
  try {
    const registration = await readyRegistration()
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return
    usePushStore.getState().setEndpoint(subscription.endpoint)
    await registerPushSubscription(subscription)
  } catch (cause) {
    console.error('[web-push] No se pudo resincronizar la suscripción:', cause)
  }
}

// Una sola resolución por carga de página, compartida por todos los que la
// pidan. Sin esto, abrir el sidebar y el panel a la vez dispara dos.
let resolving: Promise<void> | null = null

/**
 * Comprueba el dispositivo y deja el store en su estado real. Idempotente.
 *
 * La memoización solo se conserva si la comprobación LLEGÓ A UNA CONCLUSIÓN. Si
 * falla —sin conexión, o el service worker todavía activándose— se descarta,
 * porque si no un único tropiezo al arrancar congelaba la tarjeta en «Activar»
 * durante toda la vida de la página: `resolving` quedaba resuelta y ni volver a
 * la pestaña ni remontar el panel volvían a mirar. Solo se arreglaba recargando.
 */
export function resolvePushState(): Promise<void> {
  if (resolving) return resolving

  let concluyente = true
  resolving = (async () => {
    const store = usePushStore.getState()
    if (!pushApiSupported()) return store.setState('unsupported')
    if (iosNeedsInstall()) return store.setState('ios-not-installed')
    if (Notification.permission === 'denied') return store.setState('denied')

    try {
      const registration = await readyRegistration()
      const subscription = await registration.pushManager.getSubscription()
      store.setEndpoint(subscription?.endpoint ?? null)
      // El navegador es la autoridad sobre si este dispositivo está suscrito.
      store.setState(subscription ? 'subscribed' : 'idle')
      // Y la puesta al día del servidor va detrás, sin bloquear la interfaz.
      if (subscription) void syncPushSubscription()
    } catch (cause) {
      console.error('[web-push] No se pudo consultar la suscripción del dispositivo:', cause)
      concluyente = false
      // Al COMPROBAR, no saber es lo mismo que no estar suscrito, y así se
      // pinta: «Activar». Alarmar con un error rojo a quien solo abrió la
      // pestaña sobra — si de verdad hay algo roto, saldrá al pulsar, que es
      // cuando la persona está esperando que pase algo.
      store.setState('idle')
    }
  })().finally(() => {
    if (!concluyente) resolving = null
  })

  return resolving
}

export async function subscribeToPush(): Promise<void> {
  const store = usePushStore.getState()
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

  if (!pushApiSupported()) return store.setState('unsupported')
  if (iosNeedsInstall()) return store.setState('ios-not-installed')
  if (!publicKey) {
    return store.setState('error', 'Falta configurar VITE_VAPID_PUBLIC_KEY en el servidor de la aplicación.')
  }

  store.setState('loading')
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return store.setState(
        permission === 'denied' ? 'denied' : 'idle',
        permission === 'denied' ? pushErrorMessage(new Error('denied')) : null,
      )
    }

    const registration = await readyRegistration()
    const current = await registration.pushManager.getSubscription()
    const subscription = current ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    // Aquí sí se espera al servidor: si el registro falla, el dispositivo está
    // suscrito en el navegador pero el servidor no lo sabe, y decir "activadas"
    // sería mentira — es exactamente el caso de "la activé y no me llega nada".
    await registerPushSubscription(subscription)
    store.setEndpoint(subscription.endpoint)
    store.setState('subscribed')
  } catch (cause) {
    console.error('[web-push] No se pudo registrar el dispositivo:', cause)
    store.setState(
      Notification.permission === 'denied' ? 'denied' : 'error',
      pushErrorMessage(cause),
    )
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const store = usePushStore.getState()
  if (!pushApiSupported()) return

  store.setState('loading')
  try {
    const registration = await readyRegistration()
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await deletePushSubscription(subscription.endpoint)
      await subscription.unsubscribe()
    }
    store.setEndpoint(null)
    store.setState('idle')
  } catch (cause) {
    console.error('[web-push] No se pudo desactivar el dispositivo:', cause)
    store.setState('error', pushErrorMessage(cause))
  }
}
