import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/shared/lib/i18n'
import type { PushServiceStat, SelfPushTestResult } from './api'

// ─────────────────────────────────────────────────────────────────────────────
// La pantalla de Ajustes: la tarjeta de entregas por servicio y el mensaje con
// el que acaba la prueba a uno mismo. La lógica de fondo (agrupar, elegir el
// mensaje) tiene sus pruebas en pushAdmin.test.ts; aquí se comprueba que la
// pantalla la usa y que cada estado de la tarjeta dice lo que tiene que decir.
//
// Se miran trozos del texto y no frases enteras: las traducciones viven en
// i18n.ts y se retocan sin tocar esta pantalla.
// ─────────────────────────────────────────────────────────────────────────────

const fetchStats = vi.fn<() => Promise<PushServiceStat[] | null>>()
const selfTest = vi.fn<() => Promise<SelfPushTestResult>>()

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  fetchPushDeliveryStats: () => fetchStats(),
  sendSelfPushTest: () => selfTest(),
}))

// La tarjeta del dispositivo y el estado del push son de otro feature y llaman a
// la red y al navegador; aquí solo importa que el botón de prueba esté activo.
vi.mock('@/features/notifications/PushCard', () => ({ PushCard: () => null }))
vi.mock('@/features/notifications/pushStore', () => ({
  usePushStore: (select: (s: { state: string; endpoint: string | null }) => unknown) =>
    select({ state: 'subscribed', endpoint: null }),
}))

const { SettingsPanel } = await import('./SettingsPanel')
const { useUIStore } = await import('@/shared/stores/uiStore')

const stat = (over: Partial<PushServiceStat>): PushServiceStat => ({
  host: 'web.push.apple.com',
  sent: 0,
  failed: 0,
  expired: 0,
  pending: 0,
  lastAt: null,
  lastError: null,
  ...over,
})

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SettingsPanel />
    </QueryClientProvider>,
  )
}

const toast = vi.fn()

beforeEach(() => {
  fetchStats.mockReset().mockResolvedValue([])
  selfTest.mockReset()
  toast.mockReset()
  useUIStore.setState({ showToast: toast })
})

describe('tarjeta de entregas por servicio', () => {
  it('una fila por servicio, con sus cuatro conteos y el último error', async () => {
    fetchStats.mockResolvedValue([
      stat({
        host: 'web.push.apple.com',
        sent: 412,
        failed: 3,
        pending: 2,
        lastError: 'HTTP 403: BadJwtToken',
      }),
      stat({ host: 'fcm.googleapis.com', sent: 880, expired: 12 }),
    ])
    renderPanel()

    expect(await screen.findByText('web.push.apple.com')).toBeInTheDocument()
    expect(screen.getByText('fcm.googleapis.com')).toBeInTheDocument()
    expect(screen.getByText('412')).toBeInTheDocument()
    expect(screen.getByText('880')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getAllByText(/Enviadas/i)).toHaveLength(2)
    expect(screen.getAllByText(/Fallidas/i)).toHaveLength(2)
    expect(screen.getAllByText(/Caducadas/i).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/Pendientes/i)).toHaveLength(2)
    // Solo el servicio que falló enseña un error.
    expect(screen.getByText(/BadJwtToken/)).toBeInTheDocument()
    expect(screen.getAllByText(/Último error/i)).toHaveLength(1)
  })

  it('si falta la migración lo dice con su número, en vez de enseñar una lista vacía', async () => {
    fetchStats.mockResolvedValue(null)
    renderPanel()
    expect(await screen.findByText(/20261021000100/)).toBeInTheDocument()
  })

  it('sin entregas en el periodo lo dice', async () => {
    fetchStats.mockResolvedValue([])
    renderPanel()
    expect(await screen.findByText(/ninguna entrega/i)).toBeInTheDocument()
  })

  it('si la consulta falla lo dice, sin confundirlo con "falta la migración"', async () => {
    fetchStats.mockRejectedValue(new Error('boom'))
    renderPanel()
    expect(await screen.findByText(/No se pudieron cargar las entregas/i)).toBeInTheDocument()
    expect(screen.queryByText(/20261021000100/)).not.toBeInTheDocument()
  })
})

describe('prueba a uno mismo', () => {
  const press = () => fireEvent.click(screen.getByRole('button', { name: /Enviar prueba/i }))

  it('con las entregas del aviso, el mensaje sale de ellas y la tarjeta se recarga', async () => {
    selfTest.mockResolvedValue({
      processed: 1,
      sent: 1,
      failed: 0,
      notificationCreated: true,
      notification: { id: 'n1', deliveries: { pending: 0, sent: 1, failed: 0, expired: 0 } },
    })
    renderPanel()
    await screen.findByText(/ninguna entrega/i)
    expect(fetchStats).toHaveBeenCalledTimes(1)

    press()

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1))
    expect(toast.mock.calls[0][0]).toMatch(/Enviada a 1 dispositivo/)
    await waitFor(() => expect(fetchStats).toHaveBeenCalledTimes(2))
  })

  it('sin dispositivos con push dice por qué no salió nada', async () => {
    selfTest.mockResolvedValue({
      processed: 0,
      sent: 0,
      failed: 0,
      notificationCreated: true,
      notification: { id: 'n1', deliveries: { pending: 0, sent: 0, failed: 0, expired: 0 } },
    })
    renderPanel()
    await screen.findByText(/ninguna entrega/i)

    press()

    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(toast.mock.calls[0][0]).toMatch(/dispositivos con push/)
  })

  it('si la base no creó el aviso, lo dice', async () => {
    selfTest.mockResolvedValue({ processed: 0, sent: 0, failed: 0, notificationCreated: false })
    renderPanel()
    await screen.findByText(/ninguna entrega/i)

    press()

    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(toast.mock.calls[0][0]).toMatch(/No se creó el aviso/)
  })

  it('con un send-push viejo (sin conteo de entregas) deja el mensaje de siempre', async () => {
    selfTest.mockResolvedValue({ processed: 1, sent: 1, failed: 0, notificationCreated: true })
    renderPanel()
    await screen.findByText(/ninguna entrega/i)

    press()

    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(toast.mock.calls[0][0]).toBe(
      'Prueba enviada. Debería aparecer en tu pantalla en unos segundos.',
    )
  })

  it('un error de la prueba llega al aviso con su texto', async () => {
    selfTest.mockRejectedValue(
      new Error('Falta aplicar la migración 20260827000000 en Supabase (SQL Editor).'),
    )
    renderPanel()
    await screen.findByText(/ninguna entrega/i)

    press()

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        'Falta aplicar la migración 20260827000000 en Supabase (SQL Editor).',
      ),
    )
  })
})
