import { describe, expect, it } from 'vitest'
import type { Polygon } from 'geojson'
import { localProjection, polygonFromRing } from '@/shared/utils/geometry'
import { hasErrors, issuesFor, validateArea, validateBuilding } from './validation'

const LAT = -33.4527
const LNG = -70.661
const proj = localProjection(LAT, LNG)

function rect(x0: number, y0: number, x1: number, y1: number): Polygon {
  return polygonFromRing([
    proj.toPosition({ x: x0, y: y0 }),
    proj.toPosition({ x: x1, y: y0 }),
    proj.toPosition({ x: x1, y: y1 }),
    proj.toPosition({ x: x0, y: y1 }),
  ])
}

const building = rect(0, 0, 40, 20)
const emptyContext = { container: building, containerLabel: 'el edificio', siblings: [] }

describe('validateArea', () => {
  it('acepta un área normal dentro de su edificio', () => {
    expect(validateArea('Sala 101', rect(2, 2, 12, 10), emptyContext)).toEqual([])
  })

  it('exige nombre', () => {
    const issues = validateArea('   ', rect(2, 2, 12, 10), emptyContext)
    expect(issuesFor(issues, 'name')).toHaveLength(1)
    expect(hasErrors(issues)).toBe(true)
  })

  it('rechaza un área que se sale del edificio', () => {
    const issues = validateArea('Sala fuera', rect(30, 10, 60, 40), emptyContext)
    expect(issuesFor(issues, 'shape').some((i) => i.message.includes('Se sale'))).toBe(true)
    expect(hasErrors(issues)).toBe(true)
  })

  it('rechaza una forma sin superficie útil', () => {
    const issues = validateArea('Migaja', rect(0, 0, 0.5, 0.5), emptyContext)
    expect(hasErrors(issues)).toBe(true)
  })

  it('rechaza un polígono sin cerrar', () => {
    const issues = validateArea('Sin forma', null, emptyContext)
    expect(hasErrors(issues)).toBe(true)
  })

  it('avisa del solape sin impedir guardar', () => {
    const issues = validateArea('Sala nueva', rect(2, 2, 12, 10), {
      ...emptyContext,
      siblings: [{ id: 'a1', name: 'Hall', polygon: rect(8, 2, 20, 10) }],
    })
    const solape = issues.find((i) => i.message.includes('solapa'))
    expect(solape?.level).toBe('warning')
    // Un aviso no bloquea: el quiosco dentro del casino es legítimo.
    expect(hasErrors(issues)).toBe(false)
    expect(solape?.message).toContain('Hall')
  })

  it('no avisa por un roce mínimo entre áreas contiguas', () => {
    // Dos salas que comparten pared se tocan por unos centímetros al trazarlas;
    // avisar de eso sería ruido en cada área que se dibuje.
    const issues = validateArea('Sala 102', rect(2, 2, 12, 10), {
      ...emptyContext,
      siblings: [{ id: 'a1', name: 'Sala 101', polygon: rect(11.98, 2, 22, 10) }],
    })
    expect(issues).toEqual([])
  })

  it('al editar, no se compara consigo misma', () => {
    const propia = rect(2, 2, 12, 10)
    const issues = validateArea('Sala 101', propia, {
      ...emptyContext,
      siblings: [{ id: 'yo', name: 'Sala 101', polygon: propia }],
      editingAreaId: 'yo',
    })
    expect(issues).toEqual([])
  })
})

describe('validateBuilding', () => {
  const perimeter = rect(-10, -10, 100, 100)

  it('acepta un edificio dentro del perímetro', () => {
    expect(validateBuilding('Edificio A', building, { perimeter })).toEqual([])
  })

  it('exige nombre', () => {
    expect(hasErrors(validateBuilding('  ', building, { perimeter }))).toBe(true)
  })

  it('salirse del perímetro es aviso, no error', () => {
    // Hay edificios que asoman del perímetro trazado; no es motivo para
    // impedir guardarlos.
    const issues = validateBuilding('Asomado', rect(90, 90, 130, 130), { perimeter })
    expect(issues.some((i) => i.level === 'warning')).toBe(true)
    expect(hasErrors(issues)).toBe(false)
  })
})
