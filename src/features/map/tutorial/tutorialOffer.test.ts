import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  ESPERA_RECORDAR_MS,
  debeOfrecer,
  leerDecision,
  marcarVisto,
  noMostrarMas,
  recordarMasTarde,
  useOfertaTutorial,
} from './tutorialOffer'

describe('oferta del tutorial', () => {
  beforeEach(() => localStorage.clear())

  it('se ofrece sin decisión previa y deja de ofrecerse al verlo', () => {
    expect(debeOfrecer(leerDecision('u1'))).toBe(true)
    marcarVisto('u1')
    expect(debeOfrecer(leerDecision('u1'))).toBe(false)
  })

  it('«No mostrar más» es por usuario', () => {
    noMostrarMas('u1')
    expect(debeOfrecer(leerDecision('u1'))).toBe(false)
    expect(debeOfrecer(leerDecision('u2'))).toBe(true)
    expect(debeOfrecer(leerDecision(null))).toBe(true)
  })

  it('«Recordar más tarde» vuelve a ofrecerlo al vencer la espera', () => {
    const ahora = 1_000_000
    recordarMasTarde('u1', ahora)
    const decision = leerDecision('u1')
    expect(debeOfrecer(decision, ahora + 1)).toBe(false)
    expect(debeOfrecer(decision, ahora + ESPERA_RECORDAR_MS)).toBe(true)
  })

  it('un valor corrupto cuenta como sin decidir', () => {
    localStorage.setItem('udpmap.tutorialMapa.u1', '{no es json')
    expect(leerDecision('u1')).toBeNull()
  })

  it('el hook se actualiza al decidir y espera a que auth cargue', () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useOfertaTutorial('u1', 'student', loading),
      { initialProps: { loading: true } },
    )
    expect(result.current).toBe(false)
    rerender({ loading: false })
    expect(result.current).toBe(true)
    act(() => recordarMasTarde('u1'))
    expect(result.current).toBe(false)
  })
})
