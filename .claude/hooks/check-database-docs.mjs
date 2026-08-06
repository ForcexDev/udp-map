// Avisa cuando se toca el esquema sin actualizar docs/DATABASE.md.
//
// La regla del repositorio (CLAUDE.md) es que todo cambio en la base son TRES
// cosas en el mismo commit: la migración, baseline.sql y DATABASE.md. Las dos
// primeras cuesta olvidarlas porque sin ellas nada funciona; la tercera se
// olvida siempre, y así fue como el mapeo interior entero acabó sin documentar.
//
// Esto no bloquea nada: avisa. Un cambio de esquema legítimo puede necesitar
// dos pasadas, y un hook que corta a mitad de trabajo se acaba desactivando.
//
// Va en Node y no en un `jq` de una línea porque jq no está instalado en todas
// las máquinas del equipo, y Node sí — es un proyecto de npm.

import { execSync } from 'node:child_process'

const SCHEMA = /supabase[/\\](migrations[/\\]|schema[/\\]baseline\.sql)/
const DOC = 'docs/DATABASE.md'

let raw = ''
process.stdin.on('data', (chunk) => (raw += chunk))
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(raw)
    const file = event?.tool_input?.file_path ?? event?.tool_response?.filePath ?? ''
    if (!SCHEMA.test(file)) return

    // ¿Está DATABASE.md entre lo que cambió y todavía no se ha commiteado? Si
    // sí, la regla se está cumpliendo y no hay nada que decir.
    const pending = execSync(`git status --porcelain -- ${DOC}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    if (pending.trim()) return

    const aviso =
      `Tocaste el esquema (${file}) y ${DOC} sigue sin cambios. ` +
      `La regla del repositorio son tres cosas en el mismo commit: la migración, ` +
      `supabase/schema/baseline.sql y ${DOC}. Falta la tercera.`

    process.stdout.write(
      JSON.stringify({
        systemMessage: aviso,
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: aviso,
        },
      }),
    )
  } catch {
    // Un hook que rompe el turno por su propia culpa es peor que un hook que
    // no avisa. Si algo falla aquí, se calla.
  }
})
