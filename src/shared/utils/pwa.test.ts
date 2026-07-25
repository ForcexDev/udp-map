import { describe, expect, it } from 'vitest'
import { shouldShowUpdate } from './pwa'

describe('shouldShowUpdate — detección de versión nueva por buildId', () => {
  it('mismo buildId que el servidor: no hay nada que avisar', () => {
    expect(shouldShowUpdate({
      currentBuildId: 'abc123',
      serverBuildId: 'abc123',
      dismissedBuildId: null,
    })).toBe(false)
  })

  it('buildId distinto: hay despliegue nuevo', () => {
    expect(shouldShowUpdate({
      currentBuildId: 'abc123',
      serverBuildId: 'def456',
      dismissedBuildId: null,
    })).toBe(true)
  })

  it('descartado: no reaparece hasta que el servidor cambie de nuevo', () => {
    expect(shouldShowUpdate({
      currentBuildId: 'abc123',
      serverBuildId: 'def456',
      dismissedBuildId: 'def456',
    })).toBe(false)

    expect(shouldShowUpdate({
      currentBuildId: 'abc123',
      serverBuildId: 'ghi789',
      dismissedBuildId: 'def456',
    })).toBe(true)
  })
})
