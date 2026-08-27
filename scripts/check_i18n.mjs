// ─────────────────────────────────────────────────────────────────────────────
// Comprobador de traducciones.
//
// Tres preguntas que a ojo no se responden con 600 claves:
//
//   1. ¿Hay claves en español que faltan en inglés, o al revés? Una clave que
//      falta no se ve: i18next cae al `defaultValue` del componente, que está
//      en español, y la aplicación queda medio traducida sin avisar.
//   2. ¿Hay traducciones que se quedaron en español dentro del bloque inglés?
//      Copiar el bloque y traducir a medias es el fallo más común.
//   3. ¿Coinciden las variables `{{…}}` entre los dos idiomas? Si una falta,
//      la frase sale con un hueco.
//
// Se ejecuta con `node scripts/check_i18n.mjs`. Sale con código 1 si encuentra
// algo, para poder colgarlo de CI el día que haya CI.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fuente = readFileSync(path.join(raiz, 'src/shared/lib/i18n.ts'), 'utf8')

/** Extrae un bloque `const <nombre> = { … }` equilibrando llaves. */
function extraerBloque(nombre) {
  const inicio = fuente.indexOf(`const ${nombre} = {`)
  if (inicio === -1) throw new Error(`No se encontró el bloque ${nombre}`)
  let profundidad = 0
  for (let i = fuente.indexOf('{', inicio); i < fuente.length; i += 1) {
    if (fuente[i] === '{') profundidad += 1
    else if (fuente[i] === '}') {
      profundidad -= 1
      if (profundidad === 0) return fuente.slice(inicio, i + 1)
    }
  }
  throw new Error(`Bloque ${nombre} sin cerrar`)
}

/** Las claves con su valor, aplanadas a `a.b.c`. */
function claves(bloque) {
  const encontradas = new Map()
  const pila = []
  // Un analizador de línea basta: el archivo es un literal de objeto escrito a
  // mano, no JavaScript arbitrario.
  for (const linea of bloque.split('\n')) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith('//')) continue

    const abre = limpia.match(/^([A-Za-z0-9_]+)\s*:\s*\{$/)
    if (abre) { pila.push(abre[1]); continue }
    if (limpia.startsWith('}')) { pila.pop(); continue }

    const par = limpia.match(/^([A-Za-z0-9_]+)\s*:\s*(['"`])([\s\S]*)$/)
    if (par) {
      const ruta = [...pila, par[1]].join('.')
      encontradas.set(ruta, par[3].replace(/['"`],?$/, ''))
    }
  }
  return encontradas
}

const es = claves(extraerBloque('es'))
const en = claves(extraerBloque('en'))

const faltanEnIngles = [...es.keys()].filter((k) => !en.has(k))
const faltanEnEspanol = [...en.keys()].filter((k) => !es.has(k))

/** Palabras que en inglés no deberían aparecer nunca. */
const DELATORAS = /\b(el|la|los|las|de|del|para|con|una|que|tu|tus|sus|está|más|sin|por|desde|hasta|cuando|todos|todas|aquí|avisos|facultad|sala|pines|inicia|sesión|no se|ningún|ninguna)\b/i

const sinTraducir = [...en.entries()].filter(([clave, valor]) => {
  const original = es.get(clave)
  if (!original || !valor) return false
  // Idénticos no siempre es un fallo: "Admin", "OK", "Push" o un emoji se
  // escriben igual en los dos idiomas.
  if (valor === original && valor.length > 12 && DELATORAS.test(valor)) return true
  return valor !== original && DELATORAS.test(valor)
})

const variables = (texto) => (texto.match(/\{\{[a-zA-Z0-9_]+\}\}/g) ?? []).sort().join(',')
const variablesDistintas = [...es.entries()]
  .filter(([clave, valor]) => en.has(clave) && variables(valor) !== variables(en.get(clave)))
  .map(([clave, valor]) => `${clave}\n      es: ${variables(valor) || '(ninguna)'}\n      en: ${variables(en.get(clave)) || '(ninguna)'}`)

let problemas = 0
const seccion = (titulo, lista, formatea = (x) => x) => {
  if (lista.length === 0) return
  problemas += lista.length
  console.log(`\n${titulo} (${lista.length})`)
  for (const item of lista) console.log('  · ' + formatea(item))
}

console.log(`Claves: ${es.size} en español, ${en.size} en inglés.`)
seccion('FALTAN EN INGLÉS', faltanEnIngles)
seccion('FALTAN EN ESPAÑOL', faltanEnEspanol)
seccion('PARECEN SIN TRADUCIR', sinTraducir, ([clave, valor]) => `${clave} → "${valor}"`)
seccion('VARIABLES QUE NO COINCIDEN', variablesDistintas)

if (problemas === 0) console.log('\nTodo cuadra.')
process.exit(problemas === 0 ? 0 : 1)
