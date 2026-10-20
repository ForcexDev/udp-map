import { localizedName } from '@/shared/utils/localized'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Share2, Clock, Plus, MapPin, Layers, ArrowUpDown } from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { CAMPUSES, FACULTIES, categoryById, EVENT_COLOR, PLACE_COLOR } from '@/shared/data/campusData'
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
// superficie cálida neutra con el icono de la categoría en su color y punto
// indicador semántico limpio.
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

  const campus = CAMPUSES.find((c) => c.id === faculty.campus_id)?.name
  const subtitleParts = [campus, place?.name, floorLabel].filter(Boolean)
  const contextualSubtitle =
    subtitleParts.length > 0 ? subtitleParts.join(' · ') : 'Campus UDP'

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
        type="button"
        onClick={() => selectPin(pin.id)}
        title={pin.title}
        className={
          photo
            ? 'group relative flex aspect-square w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#E6E0D5] bg-white text-left transition-all hover:border-stone-400 dark:border-white/[0.07] dark:bg-[#1E222D] dark:hover:border-white/20'
            : 'group relative flex aspect-square w-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-[#E6E0D5] bg-white p-3.5 text-left transition-all hover:bg-[#F4F0E8] dark:border-white/[0.07] dark:bg-[#1E222D] dark:hover:bg-[#252A37]'
        }
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
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="line-clamp-2 text-xs font-bold leading-tight text-white drop-shadow-md">
                {pin.title}
              </p>
              {where && (
                <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold tabular-nums text-white/80">
                  <Layers size={10} className="shrink-0" />
                  <span className="truncate">{where}</span>
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex w-full items-start justify-between">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
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

              {pin.room_code && (
                <span className="shrink-0 rounded-lg border border-[#F2D0CE] bg-[#FBECEB] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300">
                  {pin.room_code}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <p className="line-clamp-2 text-xs font-bold leading-tight text-stone-900 dark:text-stone-100">
                {pin.title}
              </p>
              <div className="mt-1 flex min-w-0 flex-col gap-0.5">
                {where && (
                  <span className="flex min-w-0 items-center gap-1 text-[10px] font-medium tabular-nums text-stone-500 dark:text-stone-400">
                    <Layers size={10} className="shrink-0" />
                    <span className="truncate">{where}</span>
                  </span>
                )}
                {when && expiry.status !== 'permanent' && (
                  <span
                    className={`flex items-center gap-1 text-[10px] font-medium tabular-nums ${
                      expiry.status === 'fading'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-stone-500 dark:text-stone-400'
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
   * Una sección con su acento semántico.
   */
  const renderSection = (
    key: string,
    label: string,
    hint: string,
    accent: string,
    items: Pin[],
    trailing?: React.ReactNode,
  ) => {
    if (items.length === 0) return null
    return (
      <div key={key} className="pt-4 first:pt-0">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
            {label}
          </span>
          <span className="truncate text-xs font-medium text-stone-500 dark:text-stone-400">· {hint}</span>
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

        {/* Cabecera pegajosa con arquitectura de 2 filas desahogadas */}
        <div className="sticky top-0 z-10 glass-hud border-b border-[#E5DEC9] dark:border-white/10">
          {/* Fila 1: Subtítulo contextual + Nombre de facultad a la izquierda, botones holgados a la derecha */}
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-3.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-semibold text-stone-500 dark:text-stone-400">
                {contextualSubtitle}
              </span>
              <h2 className="truncate text-base font-bold text-stone-900 sm:text-lg dark:text-stone-100">
                {localizedName(faculty, i18n.language)}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <PlaceGalleryEditButton owner={galleryOwner} />
              <button
                type="button"
                onClick={() => {
                  selectFaculty(null)
                  startPickingLocation()
                }}
                aria-label={t('pin.create', 'Publicar')}
                title={t('pin.create', 'Publicar')}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-[#EFECE4] text-stone-700 transition-colors hover:bg-stone-200 dark:bg-white/[0.08] dark:text-stone-200 dark:hover:bg-white/15"
              >
                <Plus size={18} />
              </button>
              <button
                type="button"
                onClick={handleShare}
                aria-label={t('common.share', 'Compartir')}
                title={t('common.share', 'Compartir')}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-[#EFECE4] text-stone-700 transition-colors hover:bg-stone-200 dark:bg-white/[0.08] dark:text-stone-200 dark:hover:bg-white/15"
              >
                <Share2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => selectFaculty(null)}
                aria-label={t('common.close', 'Cerrar')}
                title={t('common.close', 'Cerrar')}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-[#EFECE4] text-stone-700 transition-colors hover:bg-stone-200 dark:bg-white/[0.08] dark:text-stone-200 dark:hover:bg-white/15"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Fila 2: Fila horizontal dedicada a chips de lugar y plantas con padding holgado */}
          {(places.length > 0 || floorLabel) && (
            <div className="no-scrollbar flex shrink-0 items-center gap-2 overflow-x-auto px-5 pb-3">
              {places.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setPlace(null)}
                    aria-pressed={place === null}
                    className={`shrink-0 cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                      place === null
                        ? 'bg-stone-900 text-[#FAF8F5] shadow-xs dark:bg-stone-100 dark:text-stone-950'
                        : 'bg-[#EFECE4] text-stone-600 hover:text-stone-900 dark:bg-white/[0.08] dark:text-stone-400 dark:hover:text-stone-100'
                    }`}
                  >
                    {t('faculty.allPlaces', 'Todos')} · {facultyPins.length}
                  </button>
                  {places.map((option) => {
                    const isActive = place?.kind === option.kind && place.id === option.id
                    return (
                      <button
                        key={`${option.kind}:${option.id}`}
                        type="button"
                        onClick={() => setPlace(isActive ? null : option)}
                        aria-pressed={isActive}
                        title={option.name}
                        className={`shrink-0 cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                          isActive
                            ? 'bg-stone-900 text-[#FAF8F5] shadow-xs dark:bg-stone-100 dark:text-stone-950'
                            : 'bg-[#EFECE4] text-stone-600 hover:text-stone-900 dark:bg-white/[0.08] dark:text-stone-400 dark:hover:text-stone-100'
                        }`}
                      >
                        {option.name} · {countAt(option)}
                      </button>
                    )
                  })}
                </>
              )}

              {/* Chip de piso activo */}
              {floorLabel && (
                <button
                  type="button"
                  onClick={() => setActiveFloor(null)}
                  title={t('faculty.clearFloor', 'Ver todas las plantas')}
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[#F2D0CE] bg-[#FBECEB] px-3.5 py-1.5 text-xs font-bold tabular-nums text-[#B02330] transition-colors dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300"
                >
                  <span>{floorLabel}</span>
                  <X size={12} strokeWidth={2.5} className="shrink-0" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="p-5">
          {visiblePins.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {t('faculty.empty', 'No hay publicaciones activas aquí.')}
              </p>
              <button
                type="button"
                onClick={() => {
                  selectFaculty(null)
                  startPickingLocation()
                }}
                className="flex cursor-pointer items-center gap-2 rounded-2xl bg-[#C22B38] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-95 dark:bg-[#D93846]"
              >
                <Plus size={15} strokeWidth={2.5} />
                {t('faculty.publishHere', 'Publicar algo aquí')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[#E5DEC9]/60 dark:divide-white/[0.07]">
              {renderSection(
                'reports',
                t('faculty.sectionNow', 'Ahora'),
                sort === 'confirmed'
                  ? t('faculty.sortConfirmed', 'más confirmados')
                  : t('faculty.sortRecent', 'más recientes'),
                '#F59E0B',
                sections.reports,
                sections.reports.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setSort(sort === 'recent' ? 'confirmed' : 'recent')}
                    className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[#EFECE4] px-2.5 py-1 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-200 dark:bg-white/[0.08] dark:text-stone-300 dark:hover:bg-white/15"
                  >
                    <ArrowUpDown size={12} strokeWidth={2.2} />
                    {sort === 'confirmed'
                      ? t('faculty.sortConfirmedShort', 'Confirmados')
                      : t('faculty.sortRecentShort', 'Recientes')}
                  </button>
                ) : undefined,
              )}
              {renderSection(
                'events',
                t('faculty.sectionNext', 'Próximo'),
                t('faculty.sortByStart', 'por fecha de inicio'),
                '#10B981',
                sections.events,
              )}
              {renderSection(
                'places',
                t('faculty.sectionHere', 'En este lugar'),
                t('faculty.permanent', 'permanentes'),
                '#0EA5E9',
                sections.places,
              )}
            </div>
          )}
        </div>
      </div>
    </DraggableBottomSheet>
  )
}
