/**
 * El `user_agent` reducido a algo que se pueda leer en una lista.
 *
 * Se resume aquí y no en la base a propósito: cada navegador nuevo obligaría a
 * tocar el esquema, y esto es presentación. La base devuelve la cadena cruda.
 *
 * El orden de las comprobaciones IMPORTA y no es alfabético:
 *   · Edge se anuncia como Chrome Y como Edg, así que va antes.
 *   · Chrome en iOS se llama CriOS y NO es Chrome de escritorio.
 *   · Safari aparece en la cadena de casi todos los navegadores WebKit, así
 *     que es el último de los navegadores.
 */
export function deviceName(userAgent: string | null): string {
  if (!userAgent) return 'Dispositivo desconocido'
  const ua = userAgent

  const sistema =
    /iPhone|iPad|iPod/i.test(ua) ? 'iPhone'
    : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua) ? 'Mac'
    : /Linux/i.test(ua) ? 'Linux'
    : null

  const navegador =
    /Edg\//i.test(ua) ? 'Edge'
    : /OPR\/|Opera/i.test(ua) ? 'Opera'
    : /CriOS/i.test(ua) ? 'Chrome'
    : /Firefox|FxiOS/i.test(ua) ? 'Firefox'
    : /Chrome\//i.test(ua) ? 'Chrome'
    : /Safari/i.test(ua) ? 'Safari'
    : null

  if (sistema && navegador) return `${navegador} · ${sistema}`
  return navegador ?? sistema ?? 'Dispositivo desconocido'
}
