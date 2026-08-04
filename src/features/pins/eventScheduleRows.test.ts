import { describe, expect, it } from 'vitest'
import { draftsFromRows, validateRows, daysBetween, type ScheduleRow } from './eventScheduleRows'

const row = (patch: Partial<ScheduleRow> = {}): ScheduleRow => ({
  key: Math.random().toString(36),
  day: '2026-08-12',
  start: '10:00',
  end: '',
  title: 'Apertura',
  subtitle: '',
  ...patch,
})

const eventStart = new Date(2026, 7, 12, 10, 0).toISOString()
const eventEnd = new Date(2026, 7, 12, 14, 0).toISOString()

describe('draftsFromRows', () => {
  it('descarta filas sin título u hora y ordena por inicio', () => {
    const drafts = draftsFromRows([
      row({ start: '12:00', title: 'Panel' }),
      row({ title: '   ' }),
      row({ start: '', title: 'Sin hora' }),
      row({ start: '10:00', title: 'Apertura' }),
    ])

    expect(drafts.map((d) => d.title)).toEqual(['Apertura', 'Panel'])
    expect(drafts.map((d) => d.sort_order)).toEqual([0, 1])
  })

  it('el subtítulo vacío se guarda como null, no como cadena vacía', () => {
    const [draft] = draftsFromRows([row({ subtitle: '  ' })])
    expect(draft.subtitle).toBeNull()
    expect(draft.ends_at).toBeNull()
  })
})

describe('validateRows', () => {
  it('un programa vacío es válido: es opcional', () => {
    expect(validateRows([], eventStart, eventEnd)).toBeNull()
    expect(validateRows([row({ title: '', start: '', subtitle: '' })], eventStart, eventEnd)).toBeNull()
  })

  it('exige título y hora en una fila empezada', () => {
    expect(validateRows([row({ title: '' })], eventStart, eventEnd)).toContain('título')
    expect(validateRows([row({ start: '' })], eventStart, eventEnd)).toContain('hora de inicio')
  })

  it('rechaza un término anterior al inicio', () => {
    expect(validateRows([row({ start: '12:00', end: '11:00' })], eventStart, eventEnd)).toContain(
      'término va antes',
    )
  })

  it('rechaza un bloque fuera del horario del evento', () => {
    expect(validateRows([row({ start: '23:00' })], eventStart, eventEnd)).toContain('fuera del horario')
  })

  it('acepta un bloque dentro del rango', () => {
    expect(validateRows([row({ start: '11:30', end: '12:30' })], eventStart, eventEnd)).toBeNull()
  })
})

describe('daysBetween', () => {
  it('un evento de un día devuelve un solo día', () => {
    expect(daysBetween('2026-08-12T10:00', '2026-08-12T14:00')).toEqual(['2026-08-12'])
  })

  it('un evento de varios días los devuelve todos', () => {
    expect(daysBetween('2026-08-10T18:00', '2026-08-13T02:00')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
    ])
  })

  it('sin fecha de inicio no hay días', () => {
    expect(daysBetween('', '2026-08-13T02:00')).toEqual([])
  })
})
