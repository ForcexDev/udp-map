// ─────────────────────────────────────────────────────────────────────────────
// Por qué esto espera de verdad, y no 1500 ms a ojo.
//
// El aviso y el arreglo eran dos mecanismos que no se hablaban. El aviso sale
// en cuanto `/update-info.json` —una petición de 200 bytes— dice que hay versión
// nueva. Activar la versión nueva, en cambio, exige que el navegador se haya
// descargado e instalado el service worker, y **el precache son 9 MB**: en un
// teléfono con datos eso tarda bastante más que el aviso en aparecer.
//
// Así que al pulsar "Actualizar" muchas veces no había NADA en `waiting` al que
// mandarle SKIP_WAITING: el postMessage caía al vacío, se recargaba a los
// 1500 ms, la página volvía servida por el worker viejo, y el aviso reaparecía.
// Cada recarga además reiniciaba la instalación desde cero, así que la cosa no
// convergía nunca — de ahí los "le doy a actualizar como 40 veces".
//
// Ahora: se fuerza la comprobación, se ESPERA a que haya un worker instalado, y
// solo entonces se le pide el relevo. Un clic, y el que tarda es el que tiene
// que tardar.
// ─────────────────────────────────────────────────────────────────────────────

/** 9 MB de precache con datos móviles no se descargan en dos segundos. */
const WAIT_FOR_WORKER_MS = 30_000
const CONTROLLER_CHANGE_MS = 10_000

/** Espera a que haya un service worker instalado y en espera del relevo. */
export function waitForWaitingWorker(
  registration: ServiceWorkerRegistration,
  timeoutMs: number,
): Promise<ServiceWorker | null> {
  if (registration.waiting) return Promise.resolve(registration.waiting)

  return new Promise((resolve) => {
    let settled = false
    const finish = (worker: ServiceWorker | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      registration.removeEventListener('updatefound', onUpdateFound)
      resolve(worker)
    }

    function onUpdateFound() {
      const installing = registration.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        // 'installed' con algo en `waiting` es el único momento en que hay a
        // quién pedirle el relevo. 'redundant' significa que se cayó.
        if (installing.state === 'installed' && registration.waiting) finish(registration.waiting)
        if (installing.state === 'redundant') finish(null)
      })
    }

    const timer = setTimeout(() => finish(registration.waiting ?? null), timeoutMs)
    registration.addEventListener('updatefound', onUpdateFound)
    // Puede que la instalación ya estuviera en marcha antes de suscribirnos.
    onUpdateFound()
  })
}

export async function applyUpdate() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      // El navegador solo busca service worker nuevo al cargar la página y cada
      // tantas horas. Si el aviso salió por `visibilitychange` con la pestaña
      // abierta, esa comprobación no ha ocurrido todavía.
      try {
        await registration.update()
      } catch (err) {
        console.error('[pwa] No se pudo comprobar si hay versión nueva:', err)
      }

      const waiting = await waitForWaitingWorker(registration, WAIT_FOR_WORKER_MS)
      if (waiting) {
        const controllerChanged = new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
        })
        waiting.postMessage({ type: 'SKIP_WAITING' })
        await Promise.race([
          controllerChanged,
          new Promise<void>((resolve) => setTimeout(resolve, CONTROLLER_CHANGE_MS)),
        ])
      }
    }
  } catch (err) {
    console.error('[pwa] No se pudo aplicar la actualización:', err)
  } finally {
    // Pase lo que pase se recarga: sin worker nuevo al menos se revalida el
    // HTML, y con él ya activo esta es la navegación que estrena la versión.
    location.reload()
  }
}
