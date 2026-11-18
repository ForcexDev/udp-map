import { describe, expect, it } from 'vitest'
import { ESTADO_INICIAL, GUIA, etapaActual, etapas, objetivos, sel } from './etapas'
import type { EstadoPractica } from './etapas'

// t de mentira: devuelve el respaldo con las variables puestas.
const t = (_clave: string, respaldo: string, op?: Record<string, unknown>) =>
  respaldo.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(op?.[k] ?? ''))
const nombres = {
  facultad: 'Ingeniería',
  pin: 'Café',
  categoria: 'Comida',
  confirmar: 'Confirmar ubicación',
  publicar: 'Publicar',
  filtros: 'Filtros',
}

/** El recorrido completo, acción por acción, como lo haría una persona. */
const PASOS: Partial<EstadoPractica>[] = [
  { buscadorAbierto: true },
  { buscadorAbierto: false, facultadEncontrada: true },
  { pinAbiertoId: 'p', pinVisto: true },
  { pinAbiertoId: null },
  { ubicando: true },
  { ubicando: false, formularioAbierto: true },
  { categoriaBorrador: 'comida' },
  { formularioAbierto: false, publicado: true },
  { filtrosAbiertos: true },
  { filtroCategoria: 'comida' },
  { filtrosAbiertos: false },
]

describe('etapas del tutorial del mapa', () => {
  it('empieza en la primera etapa destacando el buscador', () => {
    expect(etapaActual(ESTADO_INICIAL)).toBe(0)
    expect(objetivos(ESTADO_INICIAL, t, nombres)[0].selector).toBe(sel(GUIA.buscador))
  })

  it('cada acción cambia la instrucción y la etapa nunca retrocede', () => {
    let estado = ESTADO_INICIAL
    let instruccion = objetivos(estado, t, nombres)[0].instruccion
    let etapa = etapaActual(estado)
    for (const paso of PASOS) {
      estado = { ...estado, ...paso }
      const siguiente = objetivos(estado, t, nombres)[0].instruccion
      expect(siguiente).not.toBe(instruccion)
      expect(etapaActual(estado)).toBeGreaterThanOrEqual(etapa)
      instruccion = siguiente
      etapa = etapaActual(estado)
    }
    expect(etapa).toBe(etapas(t).length - 1)
  })

  it('cerrar la ficha antes de verla no avanza: la etapa sale del estado', () => {
    const estado = { ...ESTADO_INICIAL, facultadEncontrada: true }
    expect(etapaActual(estado)).toBe(1)
    expect(etapaActual({ ...estado, pinAbiertoId: 'p', pinVisto: true })).toBe(1)
    expect(etapaActual({ ...estado, pinVisto: true })).toBe(2)
  })

  it('cancelar el formulario con Escape vuelve a pedir el +', () => {
    const estado = {
      ...ESTADO_INICIAL,
      facultadEncontrada: true,
      pinVisto: true,
      formularioAbierto: false,
    }
    expect(objetivos(estado, t, nombres)[0].selector).toBe(sel(GUIA.publicar))
  })

  it('el marcador tiene respaldo y no pide scroll', () => {
    const estado = { ...ESTADO_INICIAL, facultadEncontrada: true }
    const lista = objetivos(estado, t, nombres)
    expect(lista[0]).toMatchObject({ selector: sel(GUIA.pinEjemplo), scroll: false })
    expect(lista[1]).toMatchObject({ selector: sel(GUIA.mapa), mirar: true })
  })

  it('la última etapa solo se mira', () => {
    const final = PASOS.reduce<EstadoPractica>((e, p) => ({ ...e, ...p }), ESTADO_INICIAL)
    expect(objetivos(final, t, nombres).every((o) => o.mirar)).toBe(true)
  })
})
