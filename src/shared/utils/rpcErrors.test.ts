import { describe, it, expect } from 'vitest'
import { isMissingFunction } from './rpcErrors'

describe('isMissingFunction', () => {
  it('acepta 42883, el código de Postgres para una función inexistente', () => {
    expect(isMissingFunction({ code: '42883' })).toBe(true)
  })

  it('acepta PGRST202, que PostgREST devuelve sin llegar a Postgres', () => {
    expect(isMissingFunction({ code: 'PGRST202' })).toBe(true)
  })

  it('acepta el texto de PostgREST aunque el código no venga', () => {
    expect(isMissingFunction({ message: 'Could not find the function public.x' })).toBe(true)
  })

  it('acepta el texto de Postgres aunque el código no venga', () => {
    expect(isMissingFunction({ message: 'function public.x(text) does not exist' })).toBe(true)
  })

  it('rechaza una columna que falta: no es "falta la migración de la función"', () => {
    expect(isMissingFunction({ message: 'column x does not exist' })).toBe(false)
  })

  it('rechaza una tabla que falta por la misma razón', () => {
    expect(isMissingFunction({ message: 'relation x does not exist' })).toBe(false)
  })

  it('rechaza cualquier otro código y un error sin mensaje', () => {
    expect(isMissingFunction({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isMissingFunction({})).toBe(false)
  })
})
