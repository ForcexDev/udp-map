import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { changelogSection, formatAppVersion, headingVersion, isSemver } from './appVersion'

const ROOT = path.resolve(__dirname, '../../..')

describe('isSemver', () => {
  it.each(['1.0.0', '1.0.0-alpha.1', '1.0.0-beta.2', '1.0.0-rc.1', '0.8.0'])('acepta %s', (v) => {
    expect(isSemver(v)).toBe(true)
  })

  it.each(['0.8', '0.8+238', 'v1.0.0', '1.0.0-', '01.0.0'])('rechaza %s', (v) => {
    expect(isSemver(v)).toBe(false)
  })
})

describe('formatAppVersion', () => {
  it('añade el commit como metadato de build', () => {
    expect(formatAppVersion('1.0.0-alpha.1', 'a1b2c3d')).toBe('1.0.0-alpha.1+a1b2c3d')
  })

  it('sin commit deja la versión sola', () => {
    expect(formatAppVersion('1.0.0', null)).toBe('1.0.0')
  })
})

describe('changelogSection', () => {
  const changelog = [
    '## 1.0.0-alpha.2 — 2026-12-01',
    '',
    '- Nuevo',
    '',
    '## 1.0.0-alpha.1 — 2026-11-18',
    '',
    '- Uno',
    '- Dos',
    '',
    '## Anteriores',
    '',
    '- Viejo',
  ].join('\r\n')

  it('devuelve solo los puntos de la versión pedida', () => {
    expect(changelogSection(changelog, '1.0.0-alpha.1')).toEqual(['Uno', 'Dos'])
  })

  it('no confunde una versión con su prefijo', () => {
    expect(changelogSection(changelog, '1.0.0')).toBeNull()
  })

  it('ignora encabezados que no son versiones', () => {
    expect(headingVersion('## Anteriores a 0.8.0')).toBeNull()
  })
})

// Coherencia del repositorio: CI falla si se sube la versión sin sus novedades,
// antes de que el build de despliegue lo haga.
describe('versión publicada', () => {
  const version: string = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version
  const changelog = readFileSync(path.join(ROOT, 'docs/CHANGELOG.md'), 'utf8')

  it('package.json usa SemVer', () => {
    expect(isSemver(version)).toBe(true)
  })

  it('el CHANGELOG tiene novedades para la versión actual', () => {
    expect(changelogSection(changelog, version)?.length ?? 0).toBeGreaterThan(0)
  })

  it('la versión actual es la primera sección del CHANGELOG', () => {
    const first = changelog.split(/\r?\n/).map(headingVersion).find(Boolean)
    expect(first).toBe(version)
  })

  it('ninguna versión se repite en el CHANGELOG', () => {
    const versions = changelog
      .split(/\r?\n/)
      .map(headingVersion)
      .filter((v): v is string => v !== null)
    expect(new Set(versions).size).toBe(versions.length)
  })
})
