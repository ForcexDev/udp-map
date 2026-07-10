import { describe, expect, it } from 'vitest'
import { MAX_PHOTO_BYTES, photoStoragePath, validatePhoto } from './photos'

describe('validatePhoto — tipo y peso (plan §7)', () => {
  it('acepta JPG/PNG/WebP bajo 5MB', () => {
    expect(validatePhoto({ type: 'image/jpeg', size: 1024 })).toBeNull()
    expect(validatePhoto({ type: 'image/png', size: MAX_PHOTO_BYTES })).toBeNull()
    expect(validatePhoto({ type: 'image/webp', size: 4_000_000 })).toBeNull()
  })
  it('rechaza formatos no soportados', () => {
    expect(validatePhoto({ type: 'image/gif', size: 1024 })).toBe('bad-type')
    expect(validatePhoto({ type: 'application/pdf', size: 1024 })).toBe('bad-type')
    expect(validatePhoto({ type: 'video/mp4', size: 1024 })).toBe('bad-type')
  })
  it('rechaza fotos sobre 5MB', () => {
    expect(validatePhoto({ type: 'image/jpeg', size: MAX_PHOTO_BYTES + 1 })).toBe('too-large')
  })
})

describe('photoStoragePath — sin colisiones (reemplaza Math.random de v1)', () => {
  it('usa ruta por usuario y UUID único', () => {
    const path = photoStoragePath('user-123')
    expect(path).toMatch(/^pins\/user-123\/[0-9a-f-]{36}\.jpg$/)
  })
  it('dos llamadas nunca colisionan', () => {
    const paths = new Set(Array.from({ length: 100 }, () => photoStoragePath('u')))
    expect(paths.size).toBe(100)
  })
})
