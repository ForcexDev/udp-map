// Genera los archivos de reglas de cada herramienta de IA desde CLAUDE.md.
//
// Cada herramienta busca un nombre distinto: Claude Code lee CLAUDE.md,
// Antigravity y Codex leen AGENTS.md, Gemini CLI lee GEMINI.md, Cursor
// .cursorrules y Copilot .github/copilot-instructions.md.
//
// La primera versión de esto eran punteros de tres líneas —"las reglas están en
// CLAUDE.md"— para no duplicar. Fue un error: un puntero solo sirve si el
// agente va y abre el otro archivo, y los que leen el contexto a trozos no lo
// hacen. Se quedaban sin las reglas justo los que más las necesitaban.
//
// Así que ahora llevan el contenido ENTERO. Duplicado, sí, pero generado: no
// pueden desviarse porque nadie los escribe a mano.
//
//   npm run gen:agents
//
// Y se comprueba en CI con `npm run gen:agents -- --check`, que falla si alguno
// quedó desincronizado en vez de reescribirlo.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = 'CLAUDE.md'

/** Los derivados. `comment` va arriba, con la sintaxis que admita el formato. */
const TARGETS = [
  { file: 'AGENTS.md', markdown: true },
  { file: 'GEMINI.md', markdown: true },
  { file: '.cursorrules', markdown: false },
  { file: '.github/copilot-instructions.md', markdown: true },
]

const AVISO = [
  'ARCHIVO GENERADO. No lo edites a mano: los cambios se pierden.',
  `Se genera desde ${SOURCE} con \`npm run gen:agents\`.`,
]

const source = readFileSync(join(root, SOURCE), 'utf8')

function render(target) {
  const aviso = target.markdown
    ? `<!--\n  ${AVISO.join('\n  ')}\n-->\n\n`
    : `${AVISO.map((line) => `# ${line}`).join('\n')}\n\n`
  return aviso + source
}

const check = process.argv.includes('--check')
const desincronizados = []

for (const target of TARGETS) {
  const path = join(root, target.file)
  const expected = render(target)

  if (check) {
    let actual = null
    try {
      actual = readFileSync(path, 'utf8')
    } catch {
      /* no existe: cuenta como desincronizado */
    }
    if (actual !== expected) desincronizados.push(target.file)
    continue
  }

  // Solo se escribe si cambió. Reescribir con el mismo contenido mueve la
  // fecha del archivo y hace que git y los vigilantes de ficheros crean que
  // pasó algo; además esto se ejecuta desde un hook en cada edición.
  let actual = null
  try {
    actual = readFileSync(path, 'utf8')
  } catch {
    /* aún no existe */
  }
  if (actual === expected) continue

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, expected)
  console.log(`generado  ${target.file}`)
}

if (check) {
  if (desincronizados.length > 0) {
    console.error(
      `Estos archivos no coinciden con ${SOURCE}:\n` +
        desincronizados.map((f) => `  - ${f}`).join('\n') +
        `\n\nEjecuta \`npm run gen:agents\` y añade el resultado al commit.`,
    )
    process.exit(1)
  }
  console.log(`Todo sincronizado con ${SOURCE}.`)
}
