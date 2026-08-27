/**
 * El nombre de una facultad o categoría en el idioma que se esté usando.
 *
 * Existe porque el patrón `i18n.language === 'en' ? x.name_en : x.name` estaba
 * copiado en una docena de sitios y en otra docena se había olvidado: al poner
 * la aplicación en inglés seguían saliendo "Sala", "Entrada" y "Facultad de
 * Ingeniería y Ciencias" en medio de una interfaz traducida.
 *
 * Los CAMPUS no pasan por aquí a propósito: "Campus República" es un nombre
 * propio y traducirlo sería inventarse un sitio que nadie llama así.
 */
export function localizedName(
  item: { name: string; name_en?: string | null } | null | undefined,
  language: string,
): string {
  if (!item) return ''
  // `startsWith` y no `=== 'en'`: i18next puede entregar 'en-US' o 'en-GB', y
  // comparar la cadena entera dejaba esos casos en español.
  if (language.startsWith('en') && item.name_en) return item.name_en
  return item.name
}
