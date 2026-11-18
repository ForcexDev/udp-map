// Versión de la aplicación: SemVer en package.json más el commit del build.
//
// `package.json` es la única fuente del número. Antes se mostraba
// MAJOR.MINOR+COMMITS, pero Vercel clona con historial corto y el contador salía
// siempre +10: dos despliegues distintos parecían el mismo. El SHA no depende del
// historial, así que identifica el build aunque el número no cambie.
//
// Estas funciones son puras: las usa vite.config.ts en Node y las prueba Vitest.

/** SemVer 2.0 con prerelease opcional (1.0.0, 1.0.0-alpha.1, 1.0.0-rc.2). */
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

export function isSemver(version: string): boolean {
  return SEMVER.test(version)
}

/**
 * Etiqueta visible: `1.0.0-alpha.1+a1b2c3d`. Es la notación de metadatos de
 * build de SemVer, así que la cadena completa sigue siendo una versión válida.
 */
export function formatAppVersion(version: string, commit: string | null): string {
  return commit ? `${version}+${commit}` : version
}

/**
 * Puntos de la sección `## <versión>` del CHANGELOG. Solo esa sección llega al
 * aviso de actualización; antes se leían todos los guiones del archivo y el aviso
 * repetía novedades de versiones viejas.
 */
export function changelogSection(changelog: string, version: string): string[] | null {
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex((line) => headingVersion(line) === version)
  if (start === -1) return null

  const items: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break
    const match = /^\s*-\s+(.*\S)\s*$/.exec(line)
    if (match) items.push(match[1])
  }
  return items
}

/** Versión de un encabezado `## 1.0.0-alpha.1 — 2026-11-18`, o null. */
export function headingVersion(line: string): string | null {
  const match = /^##\s+(\S+)/.exec(line)
  return match && isSemver(match[1]) ? match[1] : null
}
