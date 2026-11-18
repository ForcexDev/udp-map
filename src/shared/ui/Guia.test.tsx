import { afterEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import '@/shared/lib/i18n'
import { Guia } from './Guia'

// jsdom no maqueta: cada elemento mide 0×0 y la capa lo trataría como
// ausente. Se le da una caja al objetivo.
function conCaja(el: HTMLElement, caja: { top: number; left: number; w: number; h: number }) {
  el.getBoundingClientRect = () =>
    ({
      top: caja.top,
      left: caja.left,
      width: caja.w,
      height: caja.h,
      bottom: caja.top + caja.h,
      right: caja.left + caja.w,
      x: caja.left,
      y: caja.top,
      toJSON: () => ({}),
    }) as DOMRect
}

async function frames(n = 3) {
  for (let i = 0; i < n; i += 1) {
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))))
  }
}

function Escena({ instruccion = 'Toca el botón' }: { instruccion?: string }) {
  return (
    <>
      <button data-guia="objetivo">Objetivo</button>
      <Guia
        indice={0}
        total={3}
        titulo="Etapa"
        texto="Texto"
        objetivos={[
          { selector: '[data-guia="no-existe"]', instruccion: 'Nunca' },
          { selector: '[data-guia="objetivo"]', instruccion },
        ]}
        onSalir={() => {}}
      />
    </>
  )
}

describe('Guia', () => {
  afterEach(() => document.querySelectorAll('[data-guia-real]').forEach((n) => n.remove()))

  it('destaca el primer objetivo que existe y muestra su instrucción', async () => {
    const { rerender } = render(<Escena />)
    conCaja(screen.getByText('Objetivo'), { top: 300, left: 100, w: 80, h: 40 })
    rerender(<Escena />)
    await frames()

    const hueco = document.querySelector<HTMLElement>('[data-guia-hueco]')
    expect(hueco).not.toBeNull()
    // 8 px de aire alrededor.
    expect(hueco!.style.top).toBe('292px')
    expect(hueco!.style.width).toBe('96px')
    expect(document.querySelector('[data-guia-instruccion]')).toHaveTextContent('Toca el botón')
    expect(document.querySelector('[data-guia-instruccion]')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Práctica · 1 de 3')).toBeInTheDocument()
  })

  // Que lo de debajo no reciba el toque lo da el hit-testing (el bloqueador
  // está encima); aquí se comprueba que el bloqueador anula el gesto y que
  // cubre justo el borde del hueco.
  it('los bloqueadores rodean el hueco y anulan el toque', async () => {
    const { rerender } = render(<Escena />)
    conCaja(screen.getByText('Objetivo'), { top: 300, left: 100, w: 80, h: 40 })
    rerender(<Escena />)
    await frames()

    const arriba = document.querySelector<HTMLElement>('[data-guia-bloqueo="arriba"]')!
    const abajo = document.querySelector<HTMLElement>('[data-guia-bloqueo="abajo"]')!
    expect(arriba.style.height).toBe('292px')
    expect(abajo.style.top).toBe('348px')
    expect(fireEvent.click(arriba)).toBe(false)
    expect(fireEvent.pointerDown(abajo)).toBe(false)
    expect(document.querySelector('[data-guia-bloqueo="mirar"]')).toBeNull()
  })

  it('sin objetivo bloquea toda la pantalla', async () => {
    render(
      <Guia
        indice={0}
        total={1}
        titulo="T"
        texto="X"
        objetivos={[{ selector: '[data-guia="nada"]', instruccion: 'Espera' }]}
        onSalir={() => {}}
      />,
    )
    await frames()
    expect(document.querySelector('[data-guia-bloqueo="todo"]')).not.toBeNull()
    expect(document.querySelector('[data-guia-tarjeta]')).toHaveAttribute('data-posicion', 'centro')
  })

  it('se oculta mientras hay un overlay real', async () => {
    const real = document.createElement('div')
    real.setAttribute('data-guia-real', '')
    document.body.appendChild(real)
    render(<Escena />)
    await frames()
    expect(document.querySelector('[data-guia-tarjeta]')).toBeNull()

    real.remove()
    await frames()
    expect(document.querySelector('[data-guia-tarjeta]')).not.toBeNull()
  })
})
