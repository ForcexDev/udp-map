// Acortado de URLs para mostrarlas dentro de un contenedor.
//
// Vive aparte de LinkedText porque exportar una función junto a un componente
// desactiva el fast refresh del archivo entero.

/** Etiqueta corta y legible de una URL: el dominio y poco más. */
export function shortenUrl(raw: string, maxLength = 38): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return raw.length > maxLength ? `${raw.slice(0, maxLength - 1)}…` : raw
  }

  const host = url.hostname.replace(/^www\./, '')
  const rest = `${url.pathname}${url.search}${url.hash}`.replace(/\/$/, '')
  if (!rest || rest === '/') return host

  const full = `${host}${rest}`
  if (full.length <= maxLength) return full

  // Se conserva el dominio entero: es lo que dice a dónde lleva el enlace.
  const room = Math.max(0, maxLength - host.length - 1)
  return room < 4 ? `${host}/…` : `${host}${rest.slice(0, room)}…`
}
