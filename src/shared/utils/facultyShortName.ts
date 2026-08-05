// ─────────────────────────────────────────────────────────────────────────────
// La sigla de una facultad.
//
// "Facultad de Ingeniería y Ciencias" no cabe en la columna del selector de
// pisos, y truncado —"FACULTAD D…"— ocupa lo mismo sin decir nada. La sigla sí:
// FIC es como la llama todo el mundo dentro de la universidad.
//
// Se arma con las iniciales saltándose las palabras vacías, en vez de escribirla
// a mano en cada facultad, porque un campo más en los datos es un campo más que
// se queda sin rellenar en la siguiente que se añada.
// ─────────────────────────────────────────────────────────────────────────────

/** Palabras que no aportan inicial. Sin tildes ni mayúsculas al comparar. */
const SKIP = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a'])

const MAX_LETTERS = 4

/**
 * `Facultad de Ingeniería y Ciencias` → `FIC`
 * `Biblioteca Nicanor Parra` → `BNP`
 * `Facultad de Arquitectura, Arte y Diseño` → `FAAD`
 *
 * Se corta en cuatro letras: más allá deja de leerse como sigla y vuelve a ser
 * un texto largo, que es el problema que resuelve.
 */
export function facultyShortName(name: string): string {
  const letters = name
    .split(/[\s,·/-]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .filter((word) => !SKIP.has(word.toLocaleLowerCase('es')))
    .map((word) => word[0].toLocaleUpperCase('es'))

  // Un nombre de una sola palabra ("Aulario") no tiene sigla que valga la pena:
  // su inicial sola no distingue nada, así que se devuelve tal cual y que lo
  // corte el CSS si hace falta.
  if (letters.length < 2) return name

  return letters.slice(0, MAX_LETTERS).join('')
}
