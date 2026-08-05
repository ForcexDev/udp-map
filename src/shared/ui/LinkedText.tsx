import { Fragment } from 'react'
import { ExternalLink } from 'lucide-react'
import { shortenUrl } from './shortenUrl'

// ─────────────────────────────────────────────────────────────────────────────
// Texto de usuario con los enlaces convertidos en enlaces.
//
// Dos problemas que resuelve, y los dos venían del mismo sitio: una URL no
// tiene espacios, así que el navegador no encuentra dónde partirla y la deja
// salirse del contenedor. Un enlace de Google Drive mide 300 caracteres y se
// comía la tarjeta entera.
//
//   1. Se muestra ACORTADO (dominio + un tramo de ruta), no completo. El href
//      lleva la URL entera, así que al pulsarlo va donde tiene que ir.
//   2. `overflow-wrap: anywhere` en el resto del texto, por si alguien pega una
//      palabra larguísima que no sea un enlace.
//
// Solo se enlazan http y https. Sin esto, un `javascript:` escrito por
// cualquiera se convertiría en un enlace ejecutable dentro de la aplicación.
// ─────────────────────────────────────────────────────────────────────────────

const URL_PATTERN = /(https?:\/\/[^\s<>"')]+)/gi

interface LinkedTextProps {
  text: string
  className?: string
}

export function LinkedText({ text, className = '' }: LinkedTextProps) {
  const parts = text.split(URL_PATTERN)

  return (
    <p className={`whitespace-pre-wrap [overflow-wrap:anywhere] ${className}`}>
      {parts.map((part, index) => {
        if (!part) return null
        // split() con un grupo de captura intercala los tramos capturados, así
        // que un fragmento que empiece por http es siempre una URL detectada.
        if (!/^https?:\/\//i.test(part)) return <Fragment key={index}>{part}</Fragment>

        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title={part}
            className="inline-flex max-w-full items-baseline gap-1 break-all font-medium text-[#D41F2D] underline decoration-[#D41F2D]/30 underline-offset-2 transition-colors hover:decoration-[#D41F2D]"
          >
            <span className="truncate">{shortenUrl(part)}</span>
            <ExternalLink size={11} className="shrink-0 self-center opacity-60" aria-hidden />
          </a>
        )
      })}
    </p>
  )
}
