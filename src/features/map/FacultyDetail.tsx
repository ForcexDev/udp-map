import { localizedName } from '@/shared/utils/localized'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Share2, Clock, Plus, MapPin, Layers, ArrowUpDown, AlertTriangle, Calendar } from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { FACULTIES, categoryById, EVENT_COLOR, PLACE_COLOR } from '@/shared/data/campusData'
import { expiryState } from '@/shared/utils/expiry'
import { eventPhase } from '@/shared/utils/eventState'
import { pinVisibleOnFloor } from '@/shared/utils/floorVisibility'
import { relativeTime, relativeTimeKey } from '@/shared/utils/datetime'
import { usePins } from '@/features/pins/usePins'
import { useMapping } from '@/features/mapping/useMapping'
import { floorName } from '@/features/mapping/areaStyles'
import { DraggableBottomSheet } from '@/shared/ui/DraggableBottomSheet'
import { useSheetState } from '@/shared/ui/sheetState'
import { PlaceGallery, PlaceGalleryEditButton } from '@/features/places/PlaceGallery'
import type { PlaceOwner } from '@/features/places/placePhotos'

// ─────────────────────────────────────────────────────────────────────────────
// La ÚNICA ficha de contenido del mapa: los posts de una facultad.
//
// Antes cada edificio y cada área tenían la suya, una tarjeta compacta que casi
// siempre decía "Nada publicado aquí todavía". Repartir así el contenido de una
// facultad entre cuatro fichas hace que ninguna tenga nada: los posts son de la
// facultad, y el edificio es una forma de mirarlos, no un contenedor aparte.
//
// Así que hay una ficha, y dentro una fila de lugares para acotar. Se entra por
// donde se tocó —un edificio abre la ficha con ese edificio ya elegido— y desde
// ahí se ve el resto sin cerrar nada.
//
// ── Por qué SECCIONES y no una lista ordenada ────────────────────────────────
//
// Los tres tipos no comparten la misma noción de tiempo, así que no existe un
// "ordenar por más reciente" que sirva para los tres a la vez:
//
//   reporte  efímero y urgente; se muere solo. Manda la recencia.
//   evento   futuro. Ordenarlo por fecha de CREACIÓN no dice nada: lo que
//            importa es cuándo empieza.
//   lugar    permanente. No tiene recencia; un baño no es más nuevo que otro.
//
// Mezclados en una sola lista por fecha, los lugares quedan enterrados al
// fondo para siempre y los eventos salen en desorden. Por eso van en tres
// bloques con su propio criterio, en orden de urgencia. El orden mismo explica
// la diferencia entre los tipos, y así no hace falta un filtro por tipo que le
// pida al usuario aprender algo antes de entender la pantalla.
//
// Las tarjetas: con foto manda la imagen, con texto blanco encima; sin foto,
// superficie neutra con el icono de la categoría en su color. La versión previa
// pintaba las de sin foto con un degradado rojo al 20 % y el título en blanco
// —ilegible sobre rosa pálido— y como casi ningún post lleva foto, ese era el
// caso normal y no la excepción.
// ─────────────────────────────────────────────────────────────────────────────

const UNIT_FALLBACK = { minute: 'min', hour: 'h', day: 'd' } as const

function pinColor(pin: Pin): string {
  if (pin.category_id) return categoryById(pin.category_id)?.color ?? '#64748b'
  if (pin.type === 'place') return PLACE_COLOR
  if (pin.type === 'event') return EVENT_COLOR
  return '#64748b'
}

interface PlaceOption {
  kind: 'building' | 'area'
  id: string
  name: string
}

/**
 * Cómo se ordenan los REPORTES. Eventos y lugares no lo usan: un evento va
 * siempre por fecha de inicio y un lugar siempre alfabético, y ofrecer un orden
 * que no les aplica sería un control que miente.
 */
type SortMode = 'recent' | 'confirmed'

const CHIP = 'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black transition-colors'
const CHIP_OFF = 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
const CHIP_ON = 'bg-[#D41F2D] text-white'

/**
 * La portada. Vive en su propio componente porque `useSheetState()` solo se
 * puede leer DENTRO de la hoja, y quien la monta es `FacultyDetail`.
 *
 * Al expandirse se pliega a cero: a pantalla completa una foto de 128 px se
 * come justo el sitio de lo que se vino a leer, y el nombre de la facultad ya
 * está en la cabecera de abajo, así que no se pierde nada.
 */
function FacultyHero({ owner, fallbackImage }: { owner: PlaceOwner; fallbackImage: string | null }) {
  const { isExpanded, isDesktop } = useSheetState()
  // En ESCRITORIO no se pliega nunca. La hoja abre ya expandida ahí, así que
  // plegar al expandir dejaba la portada en cero desde el primer momento: la
  // foto no llegaba a verse jamás. Y tampoco hace falta — en escritorio sobra
  // alto vertical, que es lo único que el plegado venía a ganar.
  //
  // En el TELÉFONO se conserva tal cual, que es donde la animación tiene
  // sentido y donde el alto sí es escaso.
  return (
    <PlaceGallery
      owner={owner}
      fallbackImage={fallbackImage}
      collapsed={isExpanded && !isDesktop}
    />
  )
}

export function FacultyDetail() {
  const { t, i18n } = useTranslation()
  const selectedFacultyId = useUIStore((s) => s.selectedFacultyId)
  const selectFaculty = useUIStore((s) => s.selectFaculty)
  const selectPin = useUIStore((s) => s.selectPin)
  const showToast = useUIStore((s) => s.showToast)
  const startPickingLocation = useUIStore((s) => s.startPickingLocation)
  const placeFocus = useUIStore((s) => s.placeFocus)
  // La planta es UN solo dato compartido con el selector vertical del mapa:
  // aquí no hay copia local. Tocar el chip de abajo mueve el selector de la
  // derecha y al revés, y al cerrar la ficha el mapa se queda donde lo dejaste.
  const activeFacultyId = useUIStore((s) => s.activeFacultyId)
  const activeFloor = useUIStore((s) => s.activeFloor)
  const setActiveFloor = useUIStore((s) => s.setActiveFloor)
  const { pins } = usePins()
  const { mapping } = useMapping()

  /** `null` = todos los lugares de la facultad. */
  const [place, setPlace] = useState<PlaceOption | null>(null)
  const [sort, setSort] = useState<SortMode>('recent')

  const faculty = FACULTIES.find((f) => f.id === selectedFacultyId)

  // Los lugares que se pueden elegir: los edificios de la facultad y sus áreas
  // exteriores. Las áreas de interior no entran — serían veinte chips para
  // acotar lo mismo que ya acota su edificio.
  const places = useMemo<PlaceOption[]>(() => {
    if (!selectedFacultyId) return []
    const buildings = mapping.buildings
      .filter((b) => b.faculty_id === selectedFacultyId)
      .map<PlaceOption>((b) => ({ kind: 'building', id: b.id, name: b.short_name || b.name }))
    const outdoor = mapping.areas
      .filter((a) => a.faculty_id === selectedFacultyId && a.building_id === null)
      .map<PlaceOption>((a) => ({ kind: 'area', id: a.id, name: a.name }))
    return [...buildings, ...outdoor]
  }, [mapping, selectedFacultyId])

  // Se entra por donde se tocó. Un área de interior no tiene chip propio, así
  // que enfoca su edificio, que es lo que la contiene.
  useEffect(() => {
    if (!placeFocus) {
      setPlace(null)
      return
    }
    if (placeFocus.kind === 'building') {
      setPlace(places.find((p) => p.kind === 'building' && p.id === placeFocus.id) ?? null)
      return
    }
    const area = mapping.areas.find((a) => a.id === placeFocus.id)
    const target = area?.building_id
      ? places.find((p) => p.kind === 'building' && p.id === area.building_id)
      : places.find((p) => p.kind === 'area' && p.id === placeFocus.id)
    setPlace(target ?? null)
  }, [placeFocus, places, mapping.areas])

  // Ya NO se excluyen los `place`. Estaban fuera del feed con un `type !==
  // 'place'`, así que los lugares que añade la administración —y los reportes
  // que ascienden a lugar al verificarse— desaparecían de la ficha en cuanto
  // dejaban de ser reportes. Que un post se vuelva permanente no es motivo
  // para dejar de enseñarlo; es motivo para enseñarlo en otro sitio.
  const facultyPins = useMemo(
    () =>
      pins.filter(
        (p) =>
          p.faculty_id === selectedFacultyId &&
          // La misma regla que usan los marcadores del mapa, para que la ficha
          // y el mapa nunca discrepen sobre qué hay en la planta que se mira.
          pinVisibleOnFloor(p, activeFacultyId, activeFloor),
      ),
    [pins, selectedFacultyId, activeFacultyId, activeFloor],
  )

  const countAt = (option: PlaceOption) =>
    facultyPins.filter((p) =>
      option.kind === 'building' ? p.building_id === option.id : p.area_id === option.id,
    ).length

  const visiblePins = place
    ? facultyPins.filter((p) =>
        place.kind === 'building' ? p.building_id === place.id : p.area_id === place.id,
      )
    : facultyPins

  const sections = useMemo(() => {
    const now = Date.now()

    const reports = visiblePins
      .filter((p) => p.type === 'report')
      .sort((a, b) =>
        sort === 'confirmed'
          ? b.votes_up - a.votes_up
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )

    // En curso primero, y el resto por cuándo empieza. Un evento sin fecha no
    // puede competir por posición, así que va al final.
    const events = visiblePins
      .filter((p) => p.type === 'event')
      .sort((a, b) => {
        const liveA = eventPhase(a.starts_at, a.ends_at, now) === 'live'
        const liveB = eventPhase(b.starts_at, b.ends_at, now) === 'live'
        if (liveA !== liveB) return liveA ? -1 : 1
        const startA = a.starts_at ? new Date(a.starts_at).getTime() : Infinity
        const startB = b.starts_at ? new Date(b.starts_at).getTime() : Infinity
        return startA - startB
      })

    const places_ = visiblePins
      .filter((p) => p.type === 'place')
      .sort((a, b) => a.title.localeCompare(b.title))

    return { reports, events, places: places_ }
  }, [visiblePins, sort])

  if (!selectedFacultyId || !faculty) return null

  // El chip manda: si estás mirando el Patio, la portada es la del Patio. Un
  // área sin fotos no hereda las de la facultad, igual que un edificio: enseñar
  // la fachada de la facultad sobre la ficha del Patio es una foto que miente
  // sobre lo que estás mirando.
  const galleryOwner: PlaceOwner = place
    ? { kind: place.kind, id: place.id }
    : { kind: 'faculty', id: faculty.id }

  const floorLabel =
    activeFloor !== null && activeFacultyId === selectedFacultyId
      ? floorName(
          activeFloor,
          mapping.floors.find((f) => f.level === activeFloor)?.label ?? null,
        )
      : null

  /** `Edificio · Piso 2`, para saber de un vistazo dónde cae cada post. */
  const whereOf = (pin: Pin): string => {
    const parts: string[] = []
    const building = pin.building_id
      ? mapping.buildings.find((b) => b.id === pin.building_id)
      : undefined
    if (building) parts.push(building.short_name || building.name)
    if (pin.floor !== null) {
      const level = mapping.floors.find(
        (f) => f.building_id === pin.building_id && f.level === pin.floor,
      )
      parts.push(floorName(pin.floor, level?.label ?? null))
    }
    return parts.join(' · ')
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/mapa?faculty=${faculty.id}`
    const text = `${localizedName(faculty, i18n.language)} — UDP Map`
    try {
      if (navigator.share) {
        await navigator.share({ title: localizedName(faculty, i18n.language), text, url })
      } else {
        await navigator.clipboard.writeText(url)
        showToast(t('common.copied', 'Enlace copiado al portapapeles'))
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        navigator.clipboard.writeText(url)
        showToast(t('common.copied', 'Enlace copiado al portapapeles'))
      }
    }
  }

  const renderCard = (pin: Pin) => {
    const photo = pin.pin_photos?.[0]
    const category = pin.category_id ? categoryById(pin.category_id) : undefined
    const color = pinColor(pin)
    const expiry = expiryState(pin.expires_at, pin.is_permanent)
    const when = pin.expires_at ? relativeTime(pin.expires_at) : null
    const where = whereOf(pin)

    return (
      <button
        key={pin.id}
        onClick={() => selectPin(pin.id)}
        title={pin.title}
        className="group relative flex aspect-square w-full flex-col overflow-hidden rounded-2xl border border-neutral-200/70 bg-neutral-50 text-left transition-all hover:border-neutral-300 dark:border-neutral-700/70 dark:bg-neutral-800/60 dark:hover:border-neutral-600"
      >
        {photo ? (
          <>
            <img
              src={photo.url}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <p className="absolute inset-x-0 bottom-0 line-clamp-3 p-2.5 text-[12px] font-bold leading-tight text-white drop-shadow-md">
              {pin.title}
            </p>
          </>
        ) : (
          <>
            {/* El icono de la categoría en su color es lo único que
                distingue un post de otro sin foto. Sobre un fondo
                neutro se ve; sobre el rosa de antes, no. */}
            <div className="flex flex-1 items-start p-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: color }}
              >
                {category?.svgPath ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d={category.svgPath} />
                  </svg>
                ) : (
                  <MapPin size={17} strokeWidth={2.4} />
                )}
              </span>
            </div>
            <div className="min-w-0 px-2.5 pb-2.5">
              <p className="line-clamp-2 text-[12px] font-bold leading-tight text-neutral-800 dark:text-neutral-100">
                {pin.title}
              </p>
              <div className="mt-1 flex min-w-0 flex-col gap-0.5">
                {where && (
                  <span className="flex min-w-0 items-center gap-1 text-[10px] font-bold text-neutral-400">
                    <Layers size={10} className="shrink-0" />
                    <span className="truncate">{where}</span>
                  </span>
                )}
                {when && expiry.status !== 'permanent' && (
                  <span
                    className={`flex items-center gap-1 text-[10px] font-bold ${
                      expiry.status === 'fading'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-neutral-400'
                    }`}
                  >
                    <Clock size={10} className="shrink-0" />
                    {t(relativeTimeKey(when), {
                      defaultValue: `{{n}} ${UNIT_FALLBACK[when.unit]}`,
                      n: when.value,
                    })}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </button>
    )
  }

  /**
   * Una sección con su acento. El color es lo que hace que los tres bloques se
   * distingan sin leer la etiqueta: hasta ahora todo era rojo UDP y un reporte,
   * un evento y un lugar se veían idénticos.
   */
  const renderSection = (
    key: string,
    icon: React.ReactNode,
    label: string,
    hint: string,
    accent: string,
    items: Pin[],
    trailing?: React.ReactNode,
  ) => {
    if (items.length === 0) return null
    return (
      <div key={key} className="pt-4 first:pt-0">
        <div className="mb-2.5 flex items-center gap-1.5">
          <span className="shrink-0" style={{ color: accent }}>
            {icon}
          </span>
          <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: accent }}>
            {label}
          </span>
          <span className="truncate text-[10px] font-bold text-neutral-400">{hint}</span>
          {trailing}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map(renderCard)}</div>
      </div>
    )
  }

  return (
    <DraggableBottomSheet
      isOpen={true}
      onClose={() => selectFaculty(null)}
      ariaLabel={localizedName(faculty, i18n.language)}
      className="!p-0"
      // Tercer punto, más bajo que el compacto: solo el título y el contador
      // asomando, para consultar el mapa sin cerrar la ficha ni perder el sitio.
      peekRatio={0.15}
    >
      {/* Sin `h-full` ni scroll propio: la hoja ya tiene el suyo, y anidar dos
          recortaba la última fila de tarjetas contra un alto que no era el que
          se estaba desplazando. */}
      <div className="flex w-full flex-col">
        {/* La galería sigue al chip: acotar por un edificio cambia la portada
            a la de ESE edificio. Un área exterior no tiene galería propia, así
            que se queda con la de la facultad. */}
        <FacultyHero
          owner={galleryOwner}
          fallbackImage={galleryOwner.kind === 'faculty' ? faculty.image : null}
        />

        {/* Cabecera y chips pegajosos: al desplazar una lista larga se sigue
            sabiendo de qué facultad son los posts y con qué está acotada. */}
        <div className="sticky top-0 z-10 glass-hud">
        {/* Los botones son un hermano en flex, no un bloque absoluto con un
            `pr-16` a ojo en el título. Con el nombre largo —"Facultad de
            Ciencias Sociales e Historia"— la segunda línea se metía por debajo
            de compartir, y al añadir el tercer botón habría empeorado. Así el
            hueco lo reserva el layout y da igual cuántos botones haya. */}
        <div className="flex shrink-0 items-start gap-3 p-5 pb-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-xl font-bold leading-tight drop-shadow-sm">{localizedName(faculty, i18n.language)}</h2>
            <p className="text-sm opacity-80">
              {visiblePins.length} {visiblePins.length === 1 ? 'post' : 'posts'}
              {place && <span className="opacity-70"> · {place.name}</span>}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PlaceGalleryEditButton owner={galleryOwner} />
            <button
              onClick={handleShare}
              aria-label={t('common.share', 'Compartir')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 backdrop-blur-sm transition-colors hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
            >
              <Share2 size={16} />
            </button>
            <button
              onClick={() => selectFaculty(null)}
              aria-label={t('common.close')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 backdrop-blur-sm transition-colors hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Los lugares de la facultad. Solo aparece si hay interior mapeado:
            sin edificios dibujados no hay nada que acotar. */}
        {(places.length > 0 || floorLabel) && (
          <div className="row-scroll flex shrink-0 gap-2 px-5 pb-1 mb-2">
            {places.length > 0 && (
              <>
                <button
                  onClick={() => setPlace(null)}
                  aria-pressed={place === null}
                  className={`${CHIP} ${place === null ? CHIP_ON : CHIP_OFF}`}
                >
                  {t('faculty.allPlaces', 'Todo')} · {facultyPins.length}
                </button>
                {places.map((option) => {
                  const isActive = place?.kind === option.kind && place.id === option.id
                  return (
                    <button
                      key={`${option.kind}:${option.id}`}
                      onClick={() => setPlace(isActive ? null : option)}
                      aria-pressed={isActive}
                      title={option.name}
                      className={`${CHIP} ${isActive ? CHIP_ON : CHIP_OFF}`}
                    >
                      {option.name} · {countAt(option)}
                    </button>
                  )
                })}
              </>
            )}

            {/* La planta activa, para saber POR QUÉ falta lo que falta. Se
                quita desde aquí, y al quitarla el selector vertical del mapa
                vuelve a "Todo" con ella: es el mismo dato. */}
            {floorLabel && (
              <button
                onClick={() => setActiveFloor(null)}
                title={t('faculty.clearFloor', 'Ver todas las plantas')}
                className={`${CHIP} flex items-center gap-1 bg-[#D41F2D]/10 text-[#D41F2D] dark:bg-[#D41F2D]/20`}
              >
                {floorLabel}
                <X size={12} strokeWidth={3} className="shrink-0" />
              </button>
            )}
          </div>
        )}
        </div>

        <div className="p-5 pt-0">
          {visiblePins.length === 0 ? (
            // Un estado vacío sin salida es un callejón: siempre acompañado de
            // la acción que corresponde (§10.1 del plan).
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('faculty.empty', 'No hay publicaciones activas aquí.')}
              </p>
              <button
                onClick={() => {
                  selectFaculty(null)
                  startPickingLocation()
                }}
                className="flex items-center gap-1.5 rounded-full bg-[#D41F2D] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white transition-transform active:scale-95"
              >
                <Plus size={14} strokeWidth={3} />
                {t('faculty.publishHere', 'Publicar algo aquí')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
              {renderSection(
                'reports',
                <AlertTriangle size={13} strokeWidth={3} />,
                t('faculty.sectionNow', 'Ahora'),
                sort === 'confirmed'
                  ? t('faculty.sortConfirmed', 'más confirmados')
                  : t('faculty.sortRecent', 'más recientes'),
                '#D41F2D',
                sections.reports,
                // El orden solo se ofrece cuando hay algo que ordenar: con un
                // reporte el control no hace nada y solo ocupa sitio.
                sections.reports.length > 1 ? (
                  <button
                    onClick={() => setSort(sort === 'recent' ? 'confirmed' : 'recent')}
                    className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-black text-neutral-500 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
                  >
                    <ArrowUpDown size={11} strokeWidth={3} />
                    {sort === 'confirmed'
                      ? t('faculty.sortConfirmedShort', 'Confirmados')
                      : t('faculty.sortRecentShort', 'Recientes')}
                  </button>
                ) : undefined,
              )}
              {renderSection(
                'events',
                <Calendar size={13} strokeWidth={3} />,
                t('faculty.sectionNext', 'Próximo'),
                t('faculty.sortByStart', 'por fecha de inicio'),
                EVENT_COLOR,
                sections.events,
              )}
              {renderSection(
                'places',
                <MapPin size={13} strokeWidth={3} />,
                t('faculty.sectionHere', 'En este lugar'),
                t('faculty.permanent', 'permanentes'),
                '#78716c',
                sections.places,
              )}
            </div>
          )}
        </div>
      </div>
    </DraggableBottomSheet>
  )
}
