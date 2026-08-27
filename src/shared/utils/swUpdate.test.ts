import { describe, expect, it, vi } from 'vitest'
import { waitForWaitingWorker } from './swUpdate'

// ─────────────────────────────────────────────────────────────────────────────
// El bucle de "le doy a actualizar como 40 veces".
//
// El aviso sale en cuanto `/update-info.json` dice que hay versión nueva —una
// petición de 200 bytes—, pero activarla exige que el navegador se haya bajado
// e instalado el service worker, y el precache son 9 MB. Al pulsar no había
// nada en `waiting`: el SKIP_WAITING caía al vacío, se recargaba igual, y el
// aviso volvía. Cada recarga reiniciaba la instalación, así que no convergía.
//
// Esto prueba que ahora se espera al worker de verdad, incluido el caso que
// importa: que todavía no exista cuando se pulsa.
// ─────────────────────────────────────────────────────────────────────────────

type Listener = () => void

/** Un doble del registro con el ciclo de vida que nos importa. */
function fakeRegistration() {
  const listeners: Record<string, Listener[]> = {}
  const workerListeners: Listener[] = []

  const installing = {
    state: 'installing' as ServiceWorker['state'],
    addEventListener: (_: string, fn: Listener) => { workerListeners.push(fn) },
  }

  const registration = {
    waiting: null as unknown,
    installing: null as unknown,
    addEventListener: (evento: string, fn: Listener) => {
      (listeners[evento] ??= []).push(fn)
    },
    removeEventListener: (evento: string, fn: Listener) => {
      listeners[evento] = (listeners[evento] ?? []).filter((l) => l !== fn)
    },
  }

  return {
    registration: registration as unknown as ServiceWorkerRegistration,
    /** Simula que el navegador empieza a instalar la versión nueva. */
    empiezaInstalacion() {
      registration.installing = installing
      for (const fn of listeners.updatefound ?? []) fn()
    },
    /** Simula que termina de instalarse y queda esperando el relevo. */
    terminaInstalacion(worker: unknown = { postMessage: vi.fn() }) {
      installing.state = 'installed'
      registration.waiting = worker
      for (const fn of workerListeners) fn()
      return worker
    },
    /** Simula que la instalación se cae. */
    fallaInstalacion() {
      installing.state = 'redundant'
      for (const fn of workerListeners) fn()
    },
    suscriptores: () => (listeners.updatefound ?? []).length,
  }
}

describe('waitForWaitingWorker', () => {
  it('devuelve al instante el worker que ya estaba esperando', async () => {
    const waiting = { postMessage: vi.fn() }
    const registration = { waiting } as unknown as ServiceWorkerRegistration
    expect(await waitForWaitingWorker(registration, 1000)).toBe(waiting)
  })

  it('espera a que termine de instalarse cuando al pulsar no hay nada', async () => {
    // ESTE es el caso del bucle: se pulsa "Actualizar" y el worker nuevo aún se
    // está descargando. Antes se mandaba SKIP_WAITING al vacío y se recargaba.
    const doble = fakeRegistration()
    const promesa = waitForWaitingWorker(doble.registration, 5000)

    doble.empiezaInstalacion()
    const worker = doble.terminaInstalacion()

    expect(await promesa).toBe(worker)
  })

  it('se rinde si la instalación se cae, en vez de esperar el plazo entero', async () => {
    const doble = fakeRegistration()
    const promesa = waitForWaitingWorker(doble.registration, 60_000)

    doble.empiezaInstalacion()
    doble.fallaInstalacion()

    expect(await promesa).toBeNull()
  })

  it('devuelve null al agotarse el plazo si nunca hubo worker', async () => {
    vi.useFakeTimers()
    try {
      const doble = fakeRegistration()
      const promesa = waitForWaitingWorker(doble.registration, 30_000)
      await vi.advanceTimersByTimeAsync(31_000)
      // Null y no colgado: `applyUpdate` recarga igual y no deja el botón preso.
      expect(await promesa).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('se da de baja del registro al terminar, sin dejar suscripciones sueltas', async () => {
    const doble = fakeRegistration()
    const promesa = waitForWaitingWorker(doble.registration, 5000)
    expect(doble.suscriptores()).toBe(1)

    doble.empiezaInstalacion()
    doble.terminaInstalacion()
    await promesa

    expect(doble.suscriptores()).toBe(0)
  })
})
