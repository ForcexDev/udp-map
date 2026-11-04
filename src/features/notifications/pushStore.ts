import { create } from 'zustand'
import i18n from '@/shared/lib/i18n'
import { deletePushSubscription, getPushSessionUserId, registerPushSubscription } from './api'
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
//
// Y una cuarta, que sale de la tercera: lo que SABE EL SERVIDOR es un campo
// aparte (`serverSync`), nunca parte de `state`. Si volviera a mandar sobre
// «Activadas» reintroduciría el parpadeo; si no existiera, «Activadas» sería
// mentira cuando la RPC falla (el navegador está suscrito y el servidor no lo
// sabe, o sea que no llega nada). La tarjeta cruza los dos: activadas Y
// servidor sin enterarse → aviso y botón para reintentar.
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

/**
 * Lo que sabe el servidor de ESTE dispositivo, según el último intento de
 * registrarlo. Va aparte de `PushState` a propósito (ver arriba).
 *
 * - `unknown`: todavía no se ha intentado, o no hay nada que registrar.
 * - `ok`: el servidor confirmó el endpoint actual.
 * - `failed`: el intento falló (red, base, función).
 * - `no-session`: no hay sesión, así que el servidor no puede asociar el
 *   dispositivo a nadie. Se arregla iniciando sesión, no reintentando.
 */
export type PushServerSync = 'unknown' | 'ok' | 'failed' | 'no-session'

/** Qué se estaba haciendo (o qué falló): decide a qué vuelve «Reintentar». */
export type PushOperation = 'subscribe' | 'unsubscribe'

const LAST_KNOWN_KEY = 'udpmap.push.subscribed'

/**
 * El último endpoint que el SERVIDOR confirmó para este navegador. No es lo
 * mismo que el endpoint que tiene el navegador hoy: cuando difieren, es que
 * rotó, y esa diferencia es lo que le permite a la base mover las entregas
 * pendientes a la suscripción nueva (`p_old_endpoint`) en vez de dejarlas
 * colgando de una que ya no existe.
 */
const CONFIRMED_ENDPOINT_KEY = 'udpmap.push.endpoint'

/** Cuánto vale un registro ya hecho antes de repetirlo: una RPC por hora y página. */
const REGISTRATION_TTL_MS = 60 * 60 * 1000

// localStorage puede lanzar (modo privado de Safari, almacenamiento bloqueado).
// No es motivo para romper nada: solo se pierde la siembra del primer frame y la
// limpieza de la suscripción vieja si el endpoint rota.
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

const readLastKnown = () => safe(() => localStorage.getItem(LAST_KNOWN_KEY) === 'true', false)
const writeLastKnown = (subscribed: boolean) =>
  safe(() => localStorage.setItem(LAST_KNOWN_KEY, String(subscribed)), undefined)
const readConfirmedEndpoint = () => safe(() => localStorage.getItem(CONFIRMED_ENDPOINT_KEY), null)
const writeConfirmedEndpoint = (endpoint: string) =>
  safe(() => localStorage.setItem(CONFIRMED_ENDPOINT_KEY, endpoint), undefined)
const clearConfirmedEndpoint = () =>
  safe(() => localStorage.removeItem(CONFIRMED_ENDPOINT_KEY), undefined)

export function pushApiSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * iOS solo entrega push de forma fiable a la PWA instalada en la pantalla de
 * inicio. Desde una pestaña de Safari, `subscribe()` puede "funcionar" y las
 * notificaciones no llegar nunca con el navegador cerrado — que es justo el
 * caso que la gente reporta como "a mí no me llega".
 *
 * NO comprueba `pushApiSupported()`, y no es un descuido: en una pestaña de
 * Safari de iOS las API de push ni siquiera existen, así que exigirlas hacía
 * que esta pista —la única que le dice a la persona QUÉ hacer— no apareciera
 * jamás justo donde más falta hace. Quien la use tiene que preguntarla ANTES
 * que `pushApiSupported()`.
 */
export function iosNeedsInstall(): boolean {
  return isIOSDevice() && !isStandaloneDisplay()
}

/**
 * Hacia dónde queda el estado cuando este dispositivo no está suscrito. Se
 * calcula con el mismo orden que el arranque —la pista de iOS primero— y NUNCA
 * devuelve `subscribed`.
 */
function restingState(): PushState {
  if (iosNeedsInstall()) return 'ios-not-installed'
  if (!pushApiSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return 'idle'
}

/** El estado con el que arranca el store, sin tocar la red ni el service worker. */
function seedState(): PushState {
  const resting = restingState()
  if (resting !== 'idle') return resting
  if (Notification.permission === 'default') return 'idle'
  // Permiso concedido: lo más probable es que siga suscrito. Si resulta que no,
  // `resolvePushState()` lo corrige en cuanto el service worker responde.
  return readLastKnown() ? 'subscribed' : 'unknown'
}

// pushStore no es React: el idioma se lee de la instancia de i18next, no de un
// hook. Los respaldos van en español, como en el resto de la interfaz.
const tr = (key: string, fallback: string) => i18n.t(key, fallback)

export function pushErrorMessage(cause: unknown, operation: PushOperation = 'subscribe'): string {
  const technicalMessage = cause instanceof Error ? cause.message : String(cause)
  const errorName = cause instanceof DOMException ? cause.name : ''

  // Una función y no una cadena del módulo: el idioma puede cambiar en marcha.
  const serviceWorkerMessage = () =>
    tr(
      'notifications.push.errors.serviceWorker',
      'No se pudo preparar el servicio que recibe las notificaciones en segundo plano. Recarga la página y vuelve a intentar.',
    )
  const swFailed = /service worker/i.test(technicalMessage)

  // Al DESACTIVAR, «bloqueadas» o «no se pudo activar» no vienen a cuento: el
  // permiso no interviene, y el mensaje de activar diría justo lo contrario de
  // lo que se intentó.
  if (operation === 'unsubscribe') {
    if (swFailed) return serviceWorkerMessage()
    return tr(
      'notifications.push.errors.disable',
      'No pudimos desactivar las notificaciones en este dispositivo. Vuelve a intentar.',
    )
  }

  const denied = typeof Notification !== 'undefined' && Notification.permission === 'denied'
  if (denied || errorName === 'NotAllowedError') {
    return tr(
      'notifications.push.errors.blocked',
      'Las notificaciones están bloqueadas para este sitio. Permítelas desde el candado de la barra de direcciones y vuelve a intentar.',
    )
  }

  if (
    errorName === 'AbortError' ||
    /registration failed|push service error|push service|service unavailable/i.test(
      technicalMessage,
    )
  ) {
    return tr(
      'notifications.push.errors.unreachable',
      'El navegador no pudo conectarse a su servicio de notificaciones. Revisa los permisos del sistema y del sitio, y prueba sin VPN, bloqueadores ni modo privado.',
    )
  }

  if (/applicationserverkey|vapid|invalid.*key/i.test(technicalMessage)) {
    return tr(
      'notifications.push.errors.vapid',
      'La configuración de Web Push de la aplicación no es válida. Contacta al administrador.',
    )
  }

  if (swFailed) return serviceWorkerMessage()

  return tr(
    'notifications.push.errors.generic',
    'No pudimos activar las notificaciones en este dispositivo. Revisa los permisos del navegador y vuelve a intentar.',
  )
}

interface PushStore {
  state: PushState
  error: string | null
  /** El endpoint del navegador, para el diagnóstico del panel. */
  endpoint: string | null
  /** Lo que sabe el servidor de este dispositivo. Aparte de `state` a propósito. */
  serverSync: PushServerSync
  /**
   * La operación en curso o, si `state` es `error`, la que falló. Se limpia al
   * llegar a cualquier otro estado. Sin esto «Reintentar» no sabe a qué volver:
   * tras fallar al desactivar, activaba.
   */
  operation: PushOperation | null
  setState: (state: PushState, error?: string | null) => void
}

export const usePushStore = create<PushStore>((set) => ({
  state: typeof window === 'undefined' ? 'unknown' : seedState(),
  error: null,
  endpoint: null,
  serverSync: 'unknown',
  operation: null,
  setState: (state, error = null) => {
    if (state === 'subscribed' || state === 'idle') writeLastKnown(state === 'subscribed')
    set(
      state === 'loading' || state === 'error'
        ? { state, error }
        : { state, error, operation: null },
    )
  },
}))

const setEndpoint = (endpoint: string | null) => usePushStore.setState({ endpoint })
const setServerSync = (serverSync: PushServerSync) => usePushStore.setState({ serverSync })

/** Marca el inicio de una operación del usuario: de aquí sale «Activando…» o «Desactivando…». */
function beginOperation(operation: PushOperation): void {
  usePushStore.setState({ operation })
  usePushStore.getState().setState('loading')
}

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
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index)
  return output
}

// El último registro que el servidor confirmó EN ESTA PÁGINA. Solo en memoria, a
// propósito: si se guardara en disco, recargar no volvería a avisar nunca al
// servidor, y recargar es justo lo que hace la gente cuando algo no le llega.
let lastRegistration: { userId: string; endpoint: string; at: number } | null = null

function registeredRecently(userId: string, endpoint: string): boolean {
  return (
    lastRegistration !== null &&
    lastRegistration.userId === userId &&
    lastRegistration.endpoint === endpoint &&
    Date.now() - lastRegistration.at < REGISTRATION_TTL_MS
  )
}

/**
 * Registra en el servidor la suscripción que tiene HOY el navegador y deja
 * `serverSync` diciendo cómo fue. Lanza si el servidor falla.
 *
 * `force` salta el registro reciente: lo usan el clic de «Activar» y el botón de
 * reintentar, donde la persona espera ver que se vuelve a intentar de verdad.
 */
async function registerOnServer(subscription: PushSubscription, force: boolean): Promise<void> {
  try {
    const userId = await getPushSessionUserId()
    if (!userId) return setServerSync('no-session')

    if (!force && registeredRecently(userId, subscription.endpoint)) return setServerSync('ok')

    const confirmed = readConfirmedEndpoint()
    await registerPushSubscription(
      subscription,
      confirmed && confirmed !== subscription.endpoint ? confirmed : null,
    )
    writeConfirmedEndpoint(subscription.endpoint)
    lastRegistration = { userId, endpoint: subscription.endpoint, at: Date.now() }
    setServerSync('ok')
  } catch (cause) {
    setServerSync('failed')
    throw cause
  }
}

async function syncNow(force: boolean): Promise<void> {
  if (!pushApiSupported()) return
  if (Notification.permission !== 'granted') return

  let subscription: PushSubscription | null
  try {
    const registration = await readyRegistration()
    subscription = await registration.pushManager.getSubscription()
  } catch (cause) {
    // No saber qué tiene el navegador no es un fallo del SERVIDOR: `serverSync`
    // se queda como estaba en vez de acusar a la base de algo que no hizo.
    console.error('[web-push] No se pudo consultar la suscripción para resincronizarla:', cause)
    return
  }
  if (!subscription) return

  setEndpoint(subscription.endpoint)
  try {
    await registerOnServer(subscription, force)
  } catch (cause) {
    console.error('[web-push] No se pudo resincronizar la suscripción:', cause)
  }
}

// Las resincronizaciones van de una en una. Al arrancar coinciden la de
// `resolvePushState` y la de «llegó la sesión»; en paralelo las dos pasarían el
// control de «registrado hace poco» antes de que ninguna terminara y harían la
// misma RPC dos veces. En fila, la segunda ve lo que dejó la primera.
let syncQueue: Promise<void> = Promise.resolve()

/**
 * Le cuenta al servidor el endpoint que tiene HOY este navegador.
 *
 * Existe porque en iOS el endpoint rota en silencio: el service worker se
 * re-suscribe solo (`pushsubscriptionchange`) pero no puede avisar al servidor
 * —no tiene la sesión—, así que hasta que la página no corre esto, el servidor
 * sigue enviando a una suscripción muerta. Es la causa de "me llegaban y de
 * repente dejaron de llegar" sin que nadie tocara nada.
 *
 * No pide permisos ni crea suscripciones: si no hay una, no hace nada. No lanza:
 * el resultado queda en `serverSync`.
 */
export function syncPushSubscription({ force = false }: { force?: boolean } = {}): Promise<void> {
  const run = syncQueue.then(() => syncNow(force))
  syncQueue = run.catch(() => undefined)
  return run
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
 *
 * `force` descarta la memoización a propósito: cuando llega una sesión que no
 * estaba, lo resuelto antes se resolvió SIN ella, y hay que volver a mirar y a
 * contarle al servidor lo que ahora sí puede asociar a alguien.
 */
export function resolvePushState({ force = false }: { force?: boolean } = {}): Promise<void> {
  if (force) resolving = null
  if (resolving) return resolving

  let concluyente = true
  const current: Promise<void> = (async () => {
    const store = usePushStore.getState()
    // Primero la pista de iOS: en una pestaña de Safari no hay API de push, y
    // comprobar el soporte antes la escondía.
    if (iosNeedsInstall()) return store.setState('ios-not-installed')
    if (!pushApiSupported()) return store.setState('unsupported')
    if (Notification.permission === 'denied') return store.setState('denied')

    try {
      const registration = await readyRegistration()
      const subscription = await registration.pushManager.getSubscription()
      setEndpoint(subscription?.endpoint ?? null)
      // El navegador es la autoridad sobre si este dispositivo está suscrito.
      store.setState(subscription ? 'subscribed' : 'idle')
      // Y la puesta al día del servidor va detrás, sin bloquear la interfaz.
      if (subscription) void syncPushSubscription()
      else setServerSync('unknown')
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
    // Con `force` puede haber una resolución más nueva ocupando `resolving`: la
    // vieja no la tira.
    if (!concluyente && resolving === current) resolving = null
  })

  resolving = current
  return current
}

export async function subscribeToPush(): Promise<void> {
  const store = usePushStore.getState()
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

  // Todo lo de aquí hasta `requestPermission()` es síncrono, y tiene que
  // seguir siéndolo: en Safari el permiso y la suscripción solo se conceden
  // dentro de la activación del gesto del clic, y un `await` de más por delante
  // la puede agotar. Por eso tampoco se pregunta aquí por la sesión: eso va
  // después de suscribir.
  if (iosNeedsInstall()) return store.setState('ios-not-installed')
  if (!pushApiSupported()) return store.setState('unsupported')
  if (!publicKey) {
    // Con la operación puesta, «Reintentar» vuelve a activar y no a otra cosa.
    usePushStore.setState({ operation: 'subscribe' })
    return store.setState(
      'error',
      tr(
        'notifications.push.errors.missingKey',
        'Falta configurar VITE_VAPID_PUBLIC_KEY en el servidor de la aplicación.',
      ),
    )
  }

  beginOperation('subscribe')
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
    const subscription =
      current ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }))

    // Aquí sí se espera al servidor: si el registro falla, el dispositivo está
    // suscrito en el navegador pero el servidor no lo sabe, y decir "activadas"
    // sería mentira — es exactamente el caso de "la activé y no me llega nada".
    // (Sin sesión no es un fallo: queda suscrito, y `serverSync: 'no-session'`
    // hace que la tarjeta pida iniciar sesión.)
    await registerOnServer(subscription, true)
    setEndpoint(subscription.endpoint)
    store.setState('subscribed')
  } catch (cause) {
    console.error('[web-push] No se pudo registrar el dispositivo:', cause)
    store.setState(
      Notification.permission === 'denied' ? 'denied' : 'error',
      pushErrorMessage(cause),
    )
  }
}

/**
 * La ÚNICA baja de este dispositivo. La usan el botón «Desactivar» y el cierre
 * de sesión; antes eran dos funciones distintas (`api.ts` y esta) y cada una
 * dejaba el store en un estado diferente — de ahí que cerrar sesión no lo
 * reiniciara.
 *
 * El orden importa. Primero se desuscribe el NAVEGADOR y solo después se borra
 * la fila del servidor, como mejor esfuerzo: al revés, un borrado fallido
 * abortaba la desuscripción y el navegador seguía recibiendo los avisos de la
 * cuenta que acababa de salir. Si es el navegador quien falla, el borrado en el
 * servidor se intenta igual —es lo que corta la entrega a este aparato— y el
 * error se relanza al final.
 *
 * `server: false` es la baja SOLO local, para cuando la sesión ya terminó por su
 * cuenta: no hay quién autorice el borrado, y la fila caduca sola con el primer
 * 404/410.
 */
export async function disablePushOnThisDevice({
  server = true,
}: { server?: boolean } = {}): Promise<void> {
  // Los endpoints a dar de baja en el servidor: el del navegador y también el
  // último que el servidor confirmó, por si rotó y la fila vieja sigue allí.
  const endpoints = new Set<string>()
  const confirmed = readConfirmedEndpoint()
  if (confirmed) endpoints.add(confirmed)

  let browserError: unknown = null
  try {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      // `getRegistration()` y no `ready`: si no hay service worker, `ready` se
      // queda colgada, y cerrar sesión no puede esperar 10 s por una
      // suscripción que no existe.
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        // Se guarda antes de desuscribir: después ya no hay a quién preguntarle.
        endpoints.add(subscription.endpoint)
        await subscription.unsubscribe()
      }
    }
  } catch (cause) {
    browserError = cause
  }

  if (server) {
    for (const endpoint of endpoints) {
      try {
        await deletePushSubscription(endpoint)
      } catch (cause) {
        // Mejor esfuerzo: el navegador ya dejó de recibir, y el servidor
        // descarta la fila solo con el primer 404/410.
        console.error('[web-push] No se pudo borrar la suscripción del servidor:', cause)
      }
    }
  }

  // Antes del `throw`: si el navegador sigue suscrito pero la fila ya se borró,
  // la siguiente sincronización tiene que volver a registrarlo, y con el
  // registro reciente en memoria se lo saltaría durante una hora.
  lastRegistration = null
  if (browserError) {
    usePushStore.setState({ serverSync: 'unknown' })
    throw browserError
  }

  clearConfirmedEndpoint()
  usePushStore.setState({ endpoint: null, serverSync: 'unknown' })
  usePushStore.getState().setState(restingState())
}

export async function unsubscribeFromPush(): Promise<void> {
  const store = usePushStore.getState()
  if (!pushApiSupported()) return

  beginOperation('unsubscribe')
  try {
    await disablePushOnThisDevice()
  } catch (cause) {
    console.error('[web-push] No se pudo desactivar el dispositivo:', cause)
    store.setState('error', pushErrorMessage(cause, 'unsubscribe'))
  }
}
