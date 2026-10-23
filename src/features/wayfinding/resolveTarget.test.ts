import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/lib/supabase', () => ({ supabase: null }))

import { fetchNavGraph } from '@/features/mapping/api'
import { mappingDemoDb } from '@/features/mapping/demoStore'
import { demoDb } from '@/features/pins/demoStore'
import { buildInstructions } from '@/shared/utils/indoor/instructions'
import { areasToLocal, graphFromRows } from '@/shared/utils/indoor/load'
import { chooseEntrance, originOptions, resolveTarget } from './resolveTarget'
import type { IndoorModel } from './useNavGraph'

async function demoModel(): Promise<IndoorModel> {
  const rows = await fetchNavGraph('ingenieria')
  const sourceAreas = mappingDemoDb.snapshot('ingenieria').areas
  const { graph, plane } = graphFromRows(rows.nodes, rows.edges, { areas: sourceAreas })
  return { facultyId: 'ingenieria', graph, plane, areas: areasToLocal(sourceAreas, plane), sourceAreas, rows }
}

const pin = (id: string) => demoDb.pins.find((p) => p.id === id)!

describe('navegación en modo demo', () => {
  it('rutea del paradero a la Sala 413 con las mismas instrucciones del prototipo', async () => {
    const model = await demoModel()
    const target = resolveTarget(pin('v432-s413'), model)!
    expect(model.graph.node(target).roomCode).toBe('V432.4.S413')

    const route = model.graph.route('demo-v432-out:paradero', target)!
    const steps = buildInstructions(route, model.graph)
    expect(steps[0].text).toBe(
      'Desde el paradero Vergara / esq. Gorbea, camina hacia el sur por la vereda de Vergara',
    )
    expect(steps[steps.length - 1].text).toBe('Sala 413 está a tu izquierda')
    expect(steps.find((s) => s.icon === 'stairs-up')?.text).toBe('Sube por la escalera principal hasta el piso 4')
  })

  it('resuelve por código aunque el pin esté en otro sitio y lo escriba distinto', async () => {
    const model = await demoModel()
    const moved = { ...pin('v432-s413'), lat: 0, lng: 0, room_code: ' v432.4.s413 ', area_id: null }
    expect(model.graph.node(resolveTarget(moved, model)!).roomCode).toBe('V432.4.S413')
  })

  it('ajusta un pin interior sin sala al nodo de paso más cercano de su planta', async () => {
    const model = await demoModel()
    const corridor = model.graph.node('demo-v432-2:c16')
    const [lng, lat] = model.plane.toLngLat({ x: corridor.p.x + 0.5, y: corridor.p.y })
    const printer = { ...pin('v432-s413'), room_code: null, area_id: null, floor: 2, lat, lng }
    expect(resolveTarget(printer, model)).toBe('demo-v432-2:c16')
    expect(resolveTarget({ ...printer, building_id: null }, model)).toBeNull()
  })

  it('elige la entrada por cercanía y tiempo interior', async () => {
    const model = await demoModel()
    const target = resolveTarget(pin('v432-s413'), model)!
    const nearPatio = model.graph.node('demo-v432-out:patio').p
    expect(chooseEntrance(model, target, nearPatio, false)?.entrance.landmark).toBe('la salida al patio')
    const nearVergara = model.graph.node('demo-v432-out:vergara432').p
    expect(chooseEntrance(model, target, nearVergara, false)?.entrance.landmark).toBe(
      'la puerta principal de Vergara 432',
    )
  })

  it('ofrece salir desde la calle, las entradas y el lobby', async () => {
    const model = await demoModel()
    const labels = originOptions(model).map((n) => n.landmark)
    expect(labels).toContain('el paradero Vergara / esq. Gorbea')
    expect(labels).toContain('la puerta principal de Vergara 432')
    expect(labels).toContain('el lobby')
    expect(labels).not.toContain('el pasillo, frente a la escalera')
  })

  it('borrar una planta se lleva sus nodos y las aristas que los tocaban', async () => {
    const before = await fetchNavGraph('ingenieria')
    mappingDemoDb.deleteFloor('V432', 5)
    const after = await fetchNavGraph('ingenieria')
    expect(after.nodes.some((n) => n.floor === 5)).toBe(false)
    const ids = new Set(after.nodes.map((n) => n.id))
    expect(after.edges.every((e) => ids.has(e.a) && ids.has(e.b))).toBe(true)
    expect(after.edges.length).toBeLessThan(before.edges.length)
  })
})
