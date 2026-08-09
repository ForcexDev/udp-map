import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// El carrusel de fotos, con su visor a pantalla completa.
//
// Estaba escrito dentro de `PinDetail` y ahora lo comparten la ficha de pin y
// la de facultad. Aparte del reúso, la extracción arregla dos cosas que solo se
// notan al haber dos en pantalla:
//
//   • El contenedor de scroll se buscaba por `getElementById('pin-photos-
//     scroll')`. Con dos carruseles montados, las flechas del segundo movían
//     el primero. Ahora es un ref.
//   • El visor a pantalla completa vivía suelto en `PinDetail`; aquí viaja con
//     el carrusel, así que quien lo use lo tiene sin cablear nada.
//
// El visor va por PORTAL a `document.body`, y eso no es opcional. Los dos sitios
// que usan el carrusel lo montan dentro de `DraggableBottomSheet`, que es un
// `motion.aside` con `transform` para animarse. Un ancestro con `transform` se
// convierte en el bloque contenedor de los `position: fixed` que lleva dentro,
// así que un `fixed inset-0` se ancla a la HOJA y no a la ventana: el visor
// salía recortado dentro del panel en vez de a pantalla completa. En
// `PinDetail` no se notaba porque allí el visor era hermano de la hoja, no hijo.
// ─────────────────────────────────────────────────────────────────────────────

export interface CarouselPhoto {
  id: string
  url: string
}

interface PhotoCarouselProps {
  photos: CarouselPhoto[]
  /** Alto del carrusel. Por defecto el de la ficha de pin. */
  className?: string
  /** Esquina superior derecha, para acciones del dueño del contenido. */
  action?: React.ReactNode
}

export function PhotoCarousel({
  photos,
  className = 'h-[220px] sm:h-[260px]',
  action,
}: PhotoCarouselProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [zoomed, setZoomed] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  if (photos.length === 0) return null

  const scrollBy = (delta: number) =>
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.clientWidth === 0) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <>
      <div className={`group relative overflow-hidden rounded-xl ${className}`}>
        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                scrollBy(-250)
              }}
              className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100 sm:block"
              aria-label={t('pin.prevPhoto', 'Foto anterior')}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                scrollBy(250)
              }}
              className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100 sm:block"
              aria-label={t('pin.nextPhoto', 'Foto siguiente')}
            >
              <ChevronRight size={20} />
            </button>

            <div className="absolute right-3 top-3 z-10 rounded-full bg-black/50 px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur-md">
              {index + 1} / {photos.length}
            </div>

            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
              {photos.map((ph, i) => (
                <span
                  key={ph.id}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {action && <div className="absolute left-3 top-3 z-10">{action}</div>}

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto bg-neutral-100 dark:bg-neutral-900"
        >
          {photos.map((ph, i) => (
            <img
              key={ph.id}
              src={ph.url}
              alt=""
              // La primera se pide ya: es la que está a la vista al abrir la
              // ficha, y con `lazy` el navegador la deja para después y se veía
              // el hueco gris un instante. Las demás están fuera de pantalla
              // hasta que alguien desliza, así que ahí sí conviene aplazarlas.
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'auto'}
              decoding="async"
              onClick={() => setZoomed(ph.url)}
              className="h-full w-full flex-none shrink-0 cursor-pointer snap-center object-cover"
            />
          ))}
        </div>
      </div>

      {zoomed &&
        createPortal(
          <div
            className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setZoomed(null)}
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setZoomed(null)
              }}
              aria-label={t('common.close', 'Cerrar')}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md"
            >
              <X size={22} />
            </button>
            <img
              src={zoomed}
              alt=""
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full object-contain"
            />
          </div>,
          document.body,
        )}
    </>
  )
}
