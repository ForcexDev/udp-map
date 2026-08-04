import { describe, it, expect } from 'vitest'
import { dbErrorMessage, isUserFacingDbError } from './dbError'

describe('dbErrorMessage', () => {
  it('lee el mensaje de un error de Supabase, que no es instancia de Error', () => {
    const supabaseError = { message: 'Este pin ya está verificado.', code: 'P0001' }
    expect(dbErrorMessage(supabaseError)).toBe('Este pin ya está verificado.')
  })

  it('lee el mensaje de un Error normal', () => {
    expect(dbErrorMessage(new Error('DAILY_PIN_LIMIT_REACHED'))).toBe('DAILY_PIN_LIMIT_REACHED')
  })

  it('devuelve cadena vacía en vez de "[object Object]" cuando no hay mensaje', () => {
    expect(dbErrorMessage({})).toBe('')
    expect(dbErrorMessage(null)).toBe('')
    expect(dbErrorMessage(undefined)).toBe('')
    expect(dbErrorMessage({ message: '   ' })).toBe('')
  })
})

describe('isUserFacingDbError', () => {
  it('acepta P0001, que es el que produce raise exception en plpgsql', () => {
    expect(isUserFacingDbError({ code: 'P0001', message: 'No puedes cambiar la categoría de un pin verificado.' }))
      .toBe(true)
  })

  it('rechaza los fallos técnicos que no deben salir de los logs', () => {
    expect(isUserFacingDbError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false)
    expect(isUserFacingDbError({ code: '42501', message: 'permission denied for table profiles' })).toBe(false)
    expect(isUserFacingDbError({ code: '23503', message: 'violates foreign key constraint' })).toBe(false)
  })

  it('rechaza lo que no traiga código, como un Error de red o del modo demo', () => {
    expect(isUserFacingDbError(new Error('Failed to fetch'))).toBe(false)
    expect(isUserFacingDbError({ message: 'sin código' })).toBe(false)
    expect(isUserFacingDbError(null)).toBe(false)
  })
})
