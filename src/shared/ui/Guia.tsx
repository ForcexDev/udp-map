import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Eye, Pointer, X } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Capa de foco de un tutorial: oscurece la pantalla, deja un hueco sobre el
// control que toca usar y bloquea todo lo demás.
//
// Va en un portal a `body` y no dentro de la pantalla: cualquier ancestro con
// `transform`, `filter` o `backdrop-filter` (las hojas y el `glass-hud` los
// usan) crea su propio contexto de apilamiento, y dentro de él ningún z-index
// pasa por encima de un modal hermano. Su z-index queda sobre el de los
// diálogos (4610) y bajo el Toast (99999), que no recibe toques.
//
// No sabe nada del mapa. Recibe una lista de objetivos y destaca el primero
// que exista y se vea; el resto son respaldo. Así, si el botón que se busca
// está deshabilitado o todavía no montó, se destaca lo que lo resuelve.
// ─────────────────────────────────────────────────────────────────────────────

export interface ObjetivoGuia {
  /** Selector CSS; por convención `[data-guia="…"]`. */
  selector: string
  /** Qué tocar ahora, corto: «Toca + para publicar». */
  instruccion: string
  /** Solo se mira: sin manito y sin poder tocarlo. */
  mirar?: boolean
  /**
   * `false` si no hay que hacer scroll para traerlo a la vista. Un marcador de
   * MapLibre fuera del viewport no se arregla con scrollIntoView: desplazaría
   * el contenedor del mapa, que tiene overflow hidden. Fuera de la vista se
   * salta al siguiente objetivo.
   */
  scroll?: boolean
}

export interface AtajoGuia {
  etiqueta: string
  selector: string
  texto: string
}

interface GuiaProps {
  /** Etapa actual, 0-based. */
  indice: number
  total: number
  titulo: string
  texto: string
  objetivos: ObjetivoGuia[]
  onSalir: () => void
  /** Contenido extra al pie de la tarjeta, p. ej. volver a la pantalla real. */
  final?: ReactNode
  /** Partes de la pantalla que se pueden conocer sin salir del flujo. */
  atajos?: AtajoGuia[]
  /**
   * Atributo de los overlays reales que no pueden quedar tapados (avisos de
   * actualización, banners). Mientras exista uno en el DOM la capa se oculta.
   */
  atributoReal?: string
}

/** Aire alrededor del objetivo, para que el borde no le pise el contenido. */
const AIRE = 8
const MARGEN = 12
const DURACION_VIAJE_MS = 300

interface Caja {
  top: number
  left: number
  width: number
  height: number
}

interface Medida {
  oculta: boolean
  /** Índice del objetivo encontrado, o -1. */
  indice: number
  caja: Caja | null
}

const MEDIDA_VACIA: Medida = { oculta: false, indice: -1, caja: null }

/** ¿Algún ancestro se desplaza de verdad (auto/scroll y con contenido de sobra)? */
function tieneScroll(el: Element): boolean {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
      return true
    }
  }
  return false
}

function suscribirMovimiento(oyente: () => void) {
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  mq?.addEventListener?.('change', oyente)
  return () => mq?.removeEventListener?.('change', oyente)
}

function useMovimientoReducido(): boolean {
  return useSyncExternalStore(
    suscribirMovimiento,
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    () => false,
  )
}

export function Guia({
  indice,
  total,
  titulo,
  texto,
  objetivos,
  onSalir,
  final,
  atajos,
  atributoReal = 'data-guia-real',
}: GuiaProps) {
  const { t } = useTranslation()
  const reducido = useMovimientoReducido()
  const [atajo, setAtajo] = useState<AtajoGuia | null>(null)
  const efectivos: ObjetivoGuia[] = atajo
    ? [{ selector: atajo.selector, instruccion: atajo.texto, mirar: true }]
    : objetivos

  const [medida, setMedida] = useState<Medida>(MEDIDA_VACIA)
  const tarjetaRef = useRef<HTMLDivElement>(null)
  const [altoTarjeta, setAltoTarjeta] = useState(0)

  // El loop lee los objetivos de un ref: reiniciarlo en cada render (cada
  // toque cambia la lista) perdería el frame y la memoria del último scroll.
  const objetivosRef = useRef(efectivos)
  const reducidoRef = useRef(reducido)
  useLayoutEffect(() => {
    objetivosRef.current = efectivos
    reducidoRef.current = reducido
  })

  // ── Medición: un frame tras otro ──
  //
  // requestAnimationFrame y no eventos: el objetivo se mueve sin avisar
  // (hojas que suben, el mapa que vuela, marcadores que MapLibre recoloca). Se
  // escribe estado solo si cambian los números redondeados, así que un frame
  // quieto no re-renderiza nada.
  useEffect(() => {
    let frame = 0
    let ultima = ''
    let ultimoScroll: string | null = null

    const medir = () => {
      const oculta = document.querySelector(`[${atributoReal}]`) !== null
      const lista = objetivosRef.current
      let encontrado = -1
      let rect: DOMRect | null = null

      for (let i = 0; i < lista.length; i += 1) {
        const el = document.querySelector(lista[i].selector)
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) continue
        const fuera =
          r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth
        if (fuera) {
          if (lista[i].scroll === false) continue
          // Solo si de verdad hay algo que se desplace. Un botón fuera de la
          // vista casi siempre es una hoja que todavía está subiendo; con
          // scrollIntoView el navegador desplazaba igual el contenedor
          // `overflow: hidden` del mapa y lo dejaba corrido 500 px. Sin
          // ancestro desplazable, el hueco espera a que la hoja llegue.
          //
          // Una sola vez por objetivo: si la persona hace scroll de vuelta,
          // no se le pelea el gesto.
          if (ultimoScroll !== lista[i].selector && tieneScroll(el)) {
            ultimoScroll = lista[i].selector
            el.scrollIntoView({
              block: 'center',
              behavior: reducidoRef.current ? 'auto' : 'smooth',
            })
          }
        }
        encontrado = i
        rect = r
        break
      }

      const caja: Caja | null = rect
        ? {
            top: Math.round(rect.top - AIRE),
            left: Math.round(rect.left - AIRE),
            width: Math.round(rect.width + AIRE * 2),
            height: Math.round(rect.height + AIRE * 2),
          }
        : null
      const firma = caja
        ? `${oculta}|${encontrado}|${caja.top}|${caja.left}|${caja.width}|${caja.height}`
        : `${oculta}|-1`
      if (firma !== ultima) {
        ultima = firma
        setMedida({ oculta, indice: encontrado, caja })
      }
      frame = requestAnimationFrame(medir)
    }

    frame = requestAnimationFrame(medir)
    return () => cancelAnimationFrame(frame)
  }, [atributoReal])

  // ── Alto de la tarjeta, para decidir si va arriba o abajo ──
  useEffect(() => {
    const el = tarjetaRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setAltoTarjeta(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [medida.oculta])

  // ── Viaje entre objetivos ──
  //
  // La transición de top/left/width/height se activa solo al cambiar de
  // objetivo. Activa siempre, el hueco iría 300 ms por detrás de una hoja que
  // sube o de un scroll, que se ve como un fantasma persiguiendo al botón.
  const objetivoActual = medida.indice >= 0 ? efectivos[medida.indice] : undefined
  const claveObjetivo = objetivoActual?.selector ?? null
  const [claveAnterior, setClaveAnterior] = useState(claveObjetivo)
  const [viajando, setViajando] = useState(false)
  if (claveObjetivo !== claveAnterior) {
    // Estado derivado durante el render: React descarta este render y repite
    // con el valor nuevo, sin el pasada extra que haría un efecto.
    setClaveAnterior(claveObjetivo)
    setViajando(claveAnterior !== null && claveObjetivo !== null)
  }
  useEffect(() => {
    if (!viajando) return
    const timer = setTimeout(() => setViajando(false), DURACION_VIAJE_MS)
    return () => clearTimeout(timer)
  }, [viajando])

  // Al avanzar de etapa se abandona el atajo: lo que se estaba conociendo ya
  // no es lo que hay que hacer.
  const [indiceAnterior, setIndiceAnterior] = useState(indice)
  if (indice !== indiceAnterior) {
    setIndiceAnterior(indice)
    setAtajo(null)
  }

  const sacudir = () => {
    const el = tarjetaRef.current
    if (!el || reducido || typeof el.animate !== 'function') return
    el.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-8px)' },
        { transform: 'translateX(8px)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 360, easing: 'ease-in-out' },
    )
  }

  if (medida.oculta) return null

  const { caja } = medida
  const mirar = objetivoActual?.mirar ?? false
  const instruccion =
    objetivoActual?.instruccion ?? efectivos[0]?.instruccion ?? t('guide.lookAround', 'Mira')

  // Arriba por defecto; abajo si arriba taparía el objetivo. Si no cabe en
  // ninguno de los dos (un objetivo alto), al lado con más espacio.
  const alto = altoTarjeta || 180
  let posicion: 'arriba' | 'abajo' | 'centro' = 'centro'
  if (caja) {
    const necesita = alto + MARGEN * 2
    const espacioArriba = caja.top
    const espacioAbajo = window.innerHeight - (caja.top + caja.height)
    if (espacioArriba >= necesita) posicion = 'arriba'
    else if (espacioAbajo >= necesita) posicion = 'abajo'
    else posicion = espacioArriba >= espacioAbajo ? 'arriba' : 'abajo'
  }

  const transicion =
    viajando && !reducido
      ? `top ${DURACION_VIAJE_MS}ms ease, left ${DURACION_VIAJE_MS}ms ease, width ${DURACION_VIAJE_MS}ms ease, height ${DURACION_VIAJE_MS}ms ease`
      : 'none'

  const bloquear = (e: React.PointerEvent | React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'pointerdown') sacudir()
  }
  const bloqueador = (estilo: React.CSSProperties, nombre: string) => (
    <div
      key={nombre}
      data-guia-bloqueo={nombre}
      aria-hidden
      className="fixed"
      style={{ ...estilo, pointerEvents: 'auto', transition: transicion }}
      onPointerDown={bloquear}
      onClick={bloquear}
    />
  )

  const progreso = total > 1 ? (indice + 1) / total : 1
  const esUltima = indice === total - 1

  return createPortal(
    <div className="guia fixed inset-0 z-[5000]" style={{ pointerEvents: 'none' }}>
      {caja ? (
        <>
          {/* Hueco: la sombra gigante oscurece todo menos su interior. */}
          <div
            data-guia-hueco
            className="fixed rounded-[18px]"
            style={{
              top: caja.top,
              left: caja.left,
              width: caja.width,
              height: caja.height,
              boxShadow: '0 0 0 200vmax rgb(0 0 0 / 0.6)',
              pointerEvents: 'none',
              transition: transicion,
            }}
          >
            <div className="guia-latido absolute inset-0 rounded-[18px] border-[3px] border-[#C22B38] dark:border-[#D93846]" />
          </div>

          {/* Cuatro bloqueadores alrededor: solo el hueco recibe toques. */}
          {bloqueador({ top: 0, left: 0, right: 0, height: Math.max(0, caja.top) }, 'arriba')}
          {bloqueador({ top: caja.top + caja.height, left: 0, right: 0, bottom: 0 }, 'abajo')}
          {bloqueador(
            { top: caja.top, left: 0, width: Math.max(0, caja.left), height: caja.height },
            'izquierda',
          )}
          {bloqueador(
            { top: caja.top, left: caja.left + caja.width, right: 0, height: caja.height },
            'derecha',
          )}
          {/* Lo que solo se mira tampoco se toca. */}
          {mirar &&
            bloqueador(
              { top: caja.top, left: caja.left, width: caja.width, height: caja.height },
              'mirar',
            )}

          {!mirar && (
            <div
              aria-hidden
              className="fixed text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
              style={{
                top: caja.top + caja.height - 16,
                left: caja.left + caja.width - 16,
                transition: transicion,
              }}
            >
              <Pointer
                size={30}
                strokeWidth={2}
                className="animate-bounce fill-[#C22B38] motion-reduce:animate-none dark:fill-[#D93846]"
              />
            </div>
          )}
        </>
      ) : (
        <div
          data-guia-bloqueo="todo"
          aria-hidden
          className="fixed inset-0 bg-black/60"
          style={{ pointerEvents: 'auto' }}
          onPointerDown={bloquear}
          onClick={bloquear}
        />
      )}

      {/* ── Tarjeta ── */}
      <div
        ref={tarjetaRef}
        role="dialog"
        aria-label={titulo}
        data-guia-tarjeta
        data-posicion={posicion}
        className="fixed inset-x-3 mx-auto max-w-md rounded-[24px] border border-[#E5DEC9] bg-[#FAF8F5] p-4 shadow-2xl dark:border-white/10 dark:bg-[#151820]"
        style={{
          pointerEvents: 'auto',
          ...(posicion === 'arriba'
            ? { top: `calc(env(safe-area-inset-top, 0px) + ${MARGEN}px)` }
            : posicion === 'abajo'
              ? { bottom: `calc(env(safe-area-inset-bottom, 0px) + ${MARGEN}px)` }
              : { top: '50%', marginTop: -alto / 2 }),
        }}
      >
        <div className="flex items-center gap-3">
          <span className="shrink-0 rounded-full bg-[#C22B38]/10 px-2.5 py-1 text-[11px] font-bold text-[#C22B38] dark:bg-[#D93846]/20 dark:text-[#F08A93]">
            {t('guide.practiceStep', 'Práctica · {{n}} de {{total}}', { n: indice + 1, total })}
          </span>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={indice + 1}
          >
            <div
              className="h-full rounded-full bg-[#C22B38] transition-[width] duration-500 motion-reduce:transition-none dark:bg-[#D93846]"
              style={{ width: `${progreso * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={onSalir}
            data-guia-salir
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          >
            <X size={14} />
            {t('guide.exit', 'Salir')}
          </button>
        </div>

        <h2 className="mt-3 text-base font-bold leading-snug text-stone-900 dark:text-stone-100">
          {titulo}
        </h2>
        <p className="mt-1 text-xs leading-snug text-stone-600 dark:text-stone-300">{texto}</p>

        <p
          aria-live="polite"
          data-guia-instruccion
          className="mt-3 flex items-start gap-2 rounded-2xl bg-white px-3 py-2.5 text-sm font-semibold leading-snug text-stone-900 dark:bg-[#1E222D] dark:text-stone-100"
        >
          {/* La key reinicia la animación de entrada en cada instrucción nueva. */}
          <span key={instruccion} className="guia-entra flex items-start gap-2">
            {(() => {
              // Lo que solo se mira lleva un ojo: la manito diría «toca».
              const Icono = mirar ? Eye : Pointer
              return (
                <Icono
                  size={16}
                  className="mt-0.5 shrink-0 text-[#C22B38] dark:text-[#D93846]"
                  aria-hidden
                />
              )
            })()}
            {instruccion}
          </span>
        </p>

        {atajos && atajos.length > 0 && !esUltima && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
              {t('guide.discover', 'Conoce:')}
            </span>
            {atajos.map((a) => (
              <button
                key={a.selector}
                type="button"
                aria-pressed={atajo?.selector === a.selector}
                onClick={() => setAtajo(a)}
                className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  atajo?.selector === a.selector
                    ? 'bg-stone-900 text-[#FAF8F5] dark:bg-stone-100 dark:text-stone-950'
                    : 'bg-[#EFECE4] text-stone-600 dark:bg-white/[0.08] dark:text-stone-300'
                }`}
              >
                {a.etiqueta}
              </button>
            ))}
            {atajo && (
              <button
                type="button"
                onClick={() => setAtajo(null)}
                className="ml-auto cursor-pointer rounded-full bg-[#C22B38] px-3 py-1 text-[11px] font-bold text-white dark:bg-[#D93846]"
              >
                {t('guide.continue', 'Seguir')}
              </button>
            )}
          </div>
        )}

        {esUltima && final && <div className="mt-3">{final}</div>}
      </div>
    </div>,
    document.body,
  )
}
