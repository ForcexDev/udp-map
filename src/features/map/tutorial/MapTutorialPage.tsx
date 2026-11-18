import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  ChevronDown,
  Clock,
  MapPin,
  Menu,
  Search,
  SlidersHorizontal,
  ThumbsUp,
  X,
} from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import { CAMPUSES, CATEGORIES, categoryById } from '@/shared/data/campusData'
import { useFaculties } from '@/shared/data/facultyStore'
import { localizedName } from '@/shared/utils/localized'
import { useAuthStore } from '@/features/auth/authStore'
import { BottomNav } from '@/shared/ui/BottomNav'
import { DraggableBottomSheet } from '@/shared/ui/DraggableBottomSheet'
import { Guia, type AtajoGuia } from '@/shared/ui/Guia'
import { PracticeMap, type PracticeMapHandle } from './PracticeMap'
import {
  CATEGORIAS_FORMULARIO,
  CATEGORIA_PRACTICA,
  FACULTAD_PRACTICA,
  PIN_EJEMPLO_ID,
  PIN_NUEVO_ID,
  pinNuevo,
  pinesPractica,
} from './practiceData'
import { ESTADO_INICIAL, GUIA, etapaActual, etapas, objetivos, sel } from './etapas'
import type { EstadoPractica } from './etapas'
import { marcarVisto } from './tutorialOffer'

// ─────────────────────────────────────────────────────────────────────────────
// /mapa/tutorial — práctica guiada de la pantalla del mapa.
//
// Es un entorno de práctica: datos de mentira y estado local. No llama a
// Supabase ni escribe en ningún store compartido (uiStore, filterStore,
// pins/demoStore). Por eso el buscador, la ficha, el formulario y los filtros
// son versiones de práctica con las mismas clases que los reales: los reales
// leen y escriben esos stores, y publicar desde aquí publicaría de verdad.
//
// La ruta va fuera de `Layout` para no montar el Sidebar, los avisos ni el
// botón + real; la barra inferior es el mismo `BottomNav` en modo práctica.
// ─────────────────────────────────────────────────────────────────────────────

const TITULO_POR_DEFECTO = 'Empanadas en el patio'

export function MapTutorialPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const faculties = useFaculties()
  const mapaRef = useRef<PracticeMapHandle>(null)

  const [e, setE] = useState<EstadoPractica>(ESTADO_INICIAL)
  const actualizar = useCallback(
    (cambios: Partial<EstadoPractica>) => setE((prev) => ({ ...prev, ...cambios })),
    [],
  )
  const [busqueda, setBusqueda] = useState('')
  const [titulo, setTitulo] = useState(TITULO_POR_DEFECTO)
  const [pines, setPines] = useState<Pin[]>(pinesPractica)

  // Abrir el tutorial cuenta como visto, venga de la oferta o de Ajustes.
  useEffect(() => {
    marcarVisto(userId)
  }, [userId])

  // El mismo candado de scroll que `Layout`, que esta ruta no monta. Con
  // `overflow: hidden` el documento igual se desplaza por programa (foco de un
  // campo, scrollIntoView), y entonces lo fijo y lo medido dejan de coincidir.
  useEffect(() => {
    const fijar = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
    }
    window.addEventListener('scroll', fijar, { passive: true })
    return () => window.removeEventListener('scroll', fijar)
  }, [])

  const nombre = (id: string) => localizedName(categoryById(id), i18n.language) || id
  const facultad = faculties.find((f) => f.id === FACULTAD_PRACTICA)
  const nombreFacultad = facultad ? localizedName(facultad, i18n.language) : FACULTAD_PRACTICA
  const pinEjemplo = pines.find((p) => p.id === PIN_EJEMPLO_ID)
  const pinAbierto = pines.find((p) => p.id === e.pinAbiertoId) ?? null

  const pinesVisibles = useMemo(
    () => (e.filtroCategoria ? pines.filter((p) => p.category_id === e.filtroCategoria) : pines),
    [pines, e.filtroCategoria],
  )

  const resultados = useMemo(() => {
    const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const q = normalizar(busqueda.trim())
    if (!q) return faculties
    return faculties.filter((f) => normalizar(localizedName(f, i18n.language)).includes(q))
  }, [faculties, busqueda, i18n.language])

  const guiaDePin = useCallback(
    (pin: Pin) =>
      pin.id === PIN_EJEMPLO_ID
        ? GUIA.pinEjemplo
        : pin.id === PIN_NUEVO_ID
          ? GUIA.pinNuevo
          : undefined,
    [],
  )

  // ── Acciones de la práctica ──
  const elegirFacultad = (id: string) => {
    const f = faculties.find((x) => x.id === id)
    setBusqueda('')
    actualizar({ buscadorAbierto: false, facultadEncontrada: true })
    if (f) mapaRef.current?.flyTo(f.lat, f.lng, 17.6)
  }
  const abrirPin = (id: string) => actualizar({ pinAbiertoId: id, pinVisto: true })
  const cerrarPin = () => actualizar({ pinAbiertoId: null })
  const empezarPublicar = () =>
    actualizar({
      ubicando: true,
      pinAbiertoId: null,
      buscadorAbierto: false,
      filtrosAbiertos: false,
    })
  const confirmarUbicacion = () => actualizar({ ubicando: false, formularioAbierto: true })
  const cancelarFormulario = () => actualizar({ formularioAbierto: false, categoriaBorrador: null })
  const publicar = () => {
    const centro = mapaRef.current?.getCenter()
    if (!centro || !e.categoriaBorrador) return
    const nuevo = pinNuevo(
      centro.lat,
      centro.lng,
      e.categoriaBorrador,
      titulo.trim() || TITULO_POR_DEFECTO,
    )
    setPines((prev) => [...prev.filter((p) => p.id !== PIN_NUEVO_ID), nuevo])
    actualizar({ formularioAbierto: false, publicado: true })
  }
  const salir = () => navigate('/mapa')

  // Escape cierra lo de más arriba. La etapa se recalcula sola desde el
  // estado, así que cerrar una hoja nunca deja el flujo sin salida.
  useEffect(() => {
    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      setE((prev) => {
        if (prev.formularioAbierto) return { ...prev, formularioAbierto: false }
        if (prev.ubicando) return { ...prev, ubicando: false }
        if (prev.pinAbiertoId) return { ...prev, pinAbiertoId: null }
        if (prev.filtrosAbiertos) return { ...prev, filtrosAbiertos: false }
        if (prev.buscadorAbierto) return { ...prev, buscadorAbierto: false }
        return prev
      })
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  // ── Guía ──
  const lista = etapas(t)
  const indice = etapaActual(e)
  const etapa = lista[indice]
  const objetivosAhora = objetivos(e, t, {
    facultad: nombreFacultad,
    pin: pinEjemplo?.title ?? '',
    categoria: nombre(CATEGORIA_PRACTICA),
    confirmar: t('pin.confirmLocation', 'Confirmar ubicación'),
    publicar: t('pin.submit', 'Publicar'),
    filtros: t('filters.title', 'Filtros'),
  })
  const atajos: AtajoGuia[] = [
    {
      etiqueta: t('mapTutorial.shortcutMenu', 'Ajustes'),
      selector: sel(GUIA.menu),
      texto: t(
        'mapTutorial.shortcutMenuText',
        'Idioma, tema, notificaciones y ayuda. Desde aquí puedes repetir este tutorial.',
      ),
    },
    {
      etiqueta: t('mapTutorial.shortcutCampus', 'Sede'),
      selector: sel(GUIA.sede),
      texto: t('mapTutorial.shortcutCampusText', 'Cambia entre Centro, República y Huechuraba.'),
    },
    {
      etiqueta: t('mapTutorial.shortcutView', '2D / 3D'),
      selector: sel(GUIA.vista),
      texto: t(
        'mapTutorial.shortcutViewText',
        'En 3D puedes inclinar el mapa y ver los edificios.',
      ),
    },
  ]

  const hudVisible = !e.ubicando && !e.formularioAbierto
  const controlesInferiores = hudVisible && !pinAbierto

  return (
    <div className="app-shell w-full flex flex-col overflow-hidden">
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <div className="relative h-full w-full overflow-hidden">
          <PracticeMap
            ref={mapaRef}
            pins={pinesVisibles}
            selectedId={e.pinAbiertoId}
            onPinClick={abrirPin}
            guiaDePin={guiaDePin}
          />

          {/* ── HUD superior (mismas clases que MapPage) ── */}
          {hudVisible && (
            <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none px-3 pb-3 pt-safe-hud sm:px-5 sm:pb-5 flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2.5 w-full pointer-events-auto">
                <div className="flex-1 max-w-xs sm:max-w-md relative z-40">
                  <div
                    data-guia={GUIA.buscador}
                    className="glass-hud h-11 rounded-2xl premium-shadow flex items-center gap-3 px-4 w-full"
                  >
                    <Search
                      size={18}
                      className="text-stone-400 dark:text-stone-500 flex-shrink-0"
                      strokeWidth={2}
                    />
                    {/* Sin teclado en la práctica: en el teléfono el teclado
                        encoge el viewport y el navegador desplaza la página
                        para mostrar el campo, y el hueco y la tarjeta quedaban
                        midiendo una pantalla que ya no era la visible. Para
                        practicar basta con tocar el resultado. */}
                    <input
                      type="text"
                      readOnly
                      inputMode="none"
                      value={busqueda}
                      onChange={(ev) => {
                        setBusqueda(ev.target.value)
                        actualizar({ buscadorAbierto: true })
                      }}
                      onFocus={() => actualizar({ buscadorAbierto: true, pinAbiertoId: null })}
                      placeholder={t('map.searchFaculty', 'Buscar facultad...')}
                      className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 outline-none truncate"
                    />
                    {(busqueda || e.buscadorAbierto) && (
                      <button
                        type="button"
                        aria-label={t('common.close')}
                        onClick={() => {
                          setBusqueda('')
                          actualizar({ buscadorAbierto: false })
                        }}
                        className="text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {e.buscadorAbierto && (
                    <div className="absolute top-14 left-0 right-0 glass-hud rounded-2xl premium-shadow animate-scale-in overflow-hidden border border-[#E5DEC9] dark:border-white/10">
                      {resultados.length > 0 ? (
                        <div className="max-h-72 overflow-y-auto p-2">
                          {resultados.map((f) => {
                            const campus = CAMPUSES.find((c) => c.id === f.campus_id)
                            return (
                              <button
                                key={f.id}
                                type="button"
                                data-guia={
                                  f.id === FACULTAD_PRACTICA ? GUIA.resultadoFacultad : undefined
                                }
                                onClick={() => elegirFacultad(f.id)}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all hover:bg-[#FAF8F5]/80 dark:hover:bg-white/[0.05] active:scale-[0.98] cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-xl bg-[#C22B38]/10 flex items-center justify-center flex-shrink-0">
                                  <MapPin size={14} className="text-[#C22B38]" strokeWidth={2.5} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 leading-snug">
                                    {localizedName(f, i18n.language)}
                                  </span>
                                  <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                                    {campus?.name ?? ''}
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-6">
                          {t('map.noResults', 'Sin resultados')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0 z-40">
                  <span
                    aria-hidden
                    className="relative w-11 h-11 rounded-2xl glass-hud premium-shadow flex items-center justify-center flex-shrink-0"
                  >
                    <Bell
                      size={18}
                      className="text-stone-700 dark:text-stone-300"
                      strokeWidth={2.2}
                    />
                  </span>
                  <span
                    data-guia={GUIA.menu}
                    aria-hidden
                    className="w-11 h-11 rounded-2xl glass-hud premium-shadow flex items-center justify-center flex-shrink-0"
                  >
                    <Menu
                      size={18}
                      className="text-stone-700 dark:text-stone-300"
                      strokeWidth={2.5}
                    />
                  </span>
                </div>
              </div>

              {/* ── Filtros de práctica (mismo aspecto que FiltersPanel) ── */}
              <div className="pointer-events-auto self-start relative z-20">
                {!e.filtrosAbiertos ? (
                  <button
                    type="button"
                    data-guia={GUIA.filtros}
                    onClick={() =>
                      actualizar({
                        filtrosAbiertos: true,
                        pinAbiertoId: null,
                        buscadorAbierto: false,
                      })
                    }
                    className="glass-hud flex h-10 items-center gap-2 rounded-2xl px-4 text-xs font-semibold premium-shadow active:scale-95 transition-transform text-stone-700 dark:text-stone-300 cursor-pointer"
                  >
                    <SlidersHorizontal size={15} />
                    {t('filters.title', 'Filtros')}
                    {e.filtroCategoria && (
                      <span className="ml-0.5 h-2 w-2 rounded-full bg-[#C22B38] dark:bg-[#D93846]" />
                    )}
                  </button>
                ) : (
                  <div className="glass-hud w-72 rounded-[24px] p-4.5 premium-shadow animate-scale-in border border-[#E5DEC9] dark:border-white/10">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
                        {t('filters.title')}
                      </h2>
                      <button
                        type="button"
                        data-guia={GUIA.cerrarFiltros}
                        onClick={() => actualizar({ filtrosAbiertos: false })}
                        aria-label={t('common.close')}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EFECE4] text-stone-600 hover:text-stone-900 dark:bg-white/[0.08] dark:text-stone-300 dark:hover:text-stone-100 transition-colors cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <p className="mb-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
                      {t('filters.category')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => actualizar({ filtroCategoria: null })}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                          e.filtroCategoria === null
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                            : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                        }`}
                      >
                        {t('filters.allCategories')}
                      </button>
                      {CATEGORIAS_FORMULARIO.map((id) => {
                        const c = categoryById(id)
                        const activa = e.filtroCategoria === id
                        return (
                          <button
                            key={id}
                            type="button"
                            data-guia={id === CATEGORIA_PRACTICA ? GUIA.filtroCategoria : undefined}
                            aria-pressed={activa}
                            onClick={() => actualizar({ filtroCategoria: id })}
                            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
                              activa
                                ? 'text-white shadow-sm'
                                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                            }`}
                            style={activa ? { background: c?.color } : {}}
                          >
                            {c?.svgPath && (
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                                <path d={c.svgPath} />
                              </svg>
                            )}
                            {nombre(id)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Modo ubicar (misma retícula que MapPage) ── */}
          {e.ubicando && (
            <>
              <div className="absolute inset-0 z-[500] pointer-events-none flex items-center justify-center">
                <div className="relative flex flex-col items-center -mt-10">
                  <div className="reticle-float flex flex-col items-center">
                    <div
                      className="bg-[#C22B38] border-[2.5px] border-white flex items-center justify-center shadow-[0_8px_32px_rgba(194,43,56,0.4)]"
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50% 50% 50% 0',
                        transform: 'rotate(-45deg)',
                      }}
                    >
                      <div
                        className="w-3.5 h-3.5 bg-white rounded-full"
                        style={{ transform: 'rotate(45deg)' }}
                      />
                    </div>
                  </div>
                  <div className="relative w-8 h-2 -mt-0.5">
                    <div className="absolute inset-0 bg-[#C22B38] rounded-full opacity-20 blur-[3px]" />
                    <div className="absolute inset-[-4px] bg-[#C22B38] rounded-full reticle-pulse-ring" />
                  </div>
                </div>
              </div>

              <div className="absolute bottom-4 left-3 right-3 z-30 animate-fade-up sm:left-auto sm:right-4 sm:w-96">
                <div className="glass-hud p-5 rounded-[28px] premium-shadow border border-[#E5DEC9] dark:border-white/10 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#C22B38]/10 text-[#C22B38] rounded-xl flex items-center justify-center flex-shrink-0">
                      <MapPin size={20} strokeWidth={2.2} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                        {t('pin.pickLocation')}
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-medium mt-0.5">
                        {t('pin.pickLocationHint', 'Mueve el mapa para ajustar la ubicación')}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => actualizar({ ubicando: false })}
                      className="flex-1 h-11 bg-[#EFECE4] dark:bg-white/[0.08] text-stone-700 dark:text-stone-300 rounded-2xl font-semibold text-xs active:scale-95 transition-all cursor-pointer"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      data-guia={GUIA.confirmarUbicacion}
                      onClick={confirmarUbicacion}
                      className="flex-[2] h-11 bg-[#C22B38] text-white shadow-xs rounded-2xl font-semibold text-xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {t('pin.confirmLocation', 'Confirmar ubicación')}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Formulario de práctica ── */}
          {e.formularioAbierto && (
            <div className="absolute bottom-4 left-3 right-3 z-30 animate-fade-up sm:left-auto sm:right-4 sm:w-96">
              <div className="glass-hud p-5 rounded-[28px] premium-shadow border border-[#E5DEC9] dark:border-white/10 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                    {t('mapTutorial.formTitle', '¿Qué hay aquí?')}
                  </span>
                  <button
                    type="button"
                    onClick={cancelarFormulario}
                    aria-label={t('common.close')}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EFECE4] text-stone-600 dark:bg-white/[0.08] dark:text-stone-300 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                    {t('mapTutorial.formName', 'Título')}
                  </span>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(ev) => setTitulo(ev.target.value)}
                    className="w-full rounded-xl border border-[#E5DEC9] bg-white px-3.5 py-2.5 text-sm font-medium text-stone-900 outline-none focus:ring-2 focus:ring-[#C22B38]/40 dark:border-white/10 dark:bg-[#1E222D] dark:text-stone-100"
                  />
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                    {t('filters.category')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIAS_FORMULARIO.map((id) => {
                      const c = categoryById(id)
                      const activa = e.categoriaBorrador === id
                      return (
                        <button
                          key={id}
                          type="button"
                          data-guia={id === CATEGORIA_PRACTICA ? GUIA.categoria : undefined}
                          aria-pressed={activa}
                          onClick={() => actualizar({ categoriaBorrador: id })}
                          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            activa
                              ? 'text-white shadow-sm'
                              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}
                          style={activa ? { background: c?.color } : {}}
                        >
                          {c?.svgPath && (
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                              <path d={c.svgPath} />
                            </svg>
                          )}
                          {nombre(id)}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  data-guia={GUIA.enviarPublicacion}
                  onClick={publicar}
                  disabled={!e.categoriaBorrador}
                  className="h-11 bg-[#C22B38] text-white shadow-xs rounded-2xl font-semibold text-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {t('pin.submit', 'Publicar')}
                </button>
              </div>
            </div>
          )}

          {/* ── Sede y 2D/3D: se ven como en el mapa real, sin efecto ── */}
          {controlesInferiores && (
            <>
              <div className="absolute bottom-5 left-3 sm:left-4 z-30">
                <span
                  data-guia={GUIA.sede}
                  className="flex items-center gap-2 glass-hud px-4 py-2.5 rounded-2xl premium-shadow border border-[#E5DEC9] dark:border-white/10 text-xs font-semibold text-stone-800 dark:text-stone-200"
                >
                  Sede: Centro
                  <ChevronDown size={14} />
                </span>
              </div>
              <div className="absolute bottom-5 right-3 sm:right-4 z-30">
                <div
                  data-guia={GUIA.vista}
                  className="flex items-center gap-1 glass-hud p-1 rounded-2xl premium-shadow border border-[#E5DEC9] dark:border-white/10"
                >
                  <span className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-stone-900 text-[#FAF8F5] dark:bg-stone-100 dark:text-stone-950 shadow-xs">
                    2D
                  </span>
                  <span className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-stone-500 dark:text-stone-400">
                    3D
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ── Ficha de práctica, sobre la hoja real ── */}
          {pinAbierto && (
            <DraggableBottomSheet isOpen onClose={cerrarPin} ariaLabel={pinAbierto.title}>
              <div data-guia={GUIA.ficha} className="flex flex-col px-5 pb-6 pt-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="text-xl font-bold leading-snug tracking-tight text-stone-900 dark:text-stone-100">
                    {pinAbierto.title}
                  </h2>
                  <button
                    type="button"
                    data-guia={GUIA.cerrarFicha}
                    onClick={cerrarPin}
                    aria-label={t('common.close')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFECE4] text-stone-600 dark:bg-white/[0.08] dark:text-stone-300 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  {pinAbierto.category_id && (
                    <span
                      className="rounded-full px-2.5 py-1 text-white"
                      style={{ background: categoryById(pinAbierto.category_id)?.color }}
                    >
                      {nombre(pinAbierto.category_id)}
                    </span>
                  )}
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    <Clock size={12} />
                    {t('mapTutorial.expiresIn', 'Vence en 3 h')}
                  </span>
                </div>
                {pinAbierto.description && (
                  <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                    {pinAbierto.description}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                  <span>
                    {pinAbierto.creator_name ?? t('mapTutorial.you', 'Tú')} ·{' '}
                    {t('mapTutorial.minutesAgo', 'hace 20 min')}
                  </span>
                  <span className="flex items-center gap-1 font-semibold">
                    <ThumbsUp size={13} />
                    {pinAbierto.votes_up}
                  </span>
                </div>
              </div>
            </DraggableBottomSheet>
          )}
        </div>
      </main>

      <BottomNav practice onCreate={empezarPublicar} />

      <Guia
        indice={indice}
        total={lista.length}
        titulo={etapa.titulo}
        texto={etapa.texto}
        objetivos={objetivosAhora}
        atajos={atajos}
        onSalir={salir}
        final={
          <button
            type="button"
            data-guia-volver
            onClick={salir}
            className="h-11 w-full rounded-2xl bg-[#C22B38] text-sm font-semibold text-white shadow-xs active:scale-95 transition-transform cursor-pointer dark:bg-[#D93846]"
          >
            {t('mapTutorial.goToMap', 'Ir al mapa')}
          </button>
        }
      />
    </div>
  )
}

// Las categorías de práctica deben existir en el catálogo: si alguien renombra
// una, la etapa quedaría apuntando a un chip que no se pinta.
if (import.meta.env.DEV) {
  for (const id of CATEGORIAS_FORMULARIO) {
    if (!CATEGORIES.some((c) => c.id === id)) console.warn(`[tutorial] categoría ${id} no existe`)
  }
}
