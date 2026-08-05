import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Share2, Clock, Plus, MapPin, Layers } from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { FACULTIES, categoryById, EVENT_COLOR, PLACE_COLOR } from '@/shared/data/campusData'
import { expiryState } from '@/shared/utils/expiry'
import { relativeTime } from '@/shared/utils/datetime'
import { usePins } from '@/features/pins/usePins'
import { useMapping } from '@/features/mapping/useMapping'
import { floorName } from '@/features/mapping/areaStyles'
import { DraggableBottomSheet } from '@/shared/ui/DraggableBottomSheet'

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
// Las tarjetas: con foto manda la imagen, con texto blanco encima; sin foto,
// superficie neutra con el icono de la categoría en su color. La versión previa
// pintaba las de sin foto con un degradado rojo al 20 % y el título en blanco
// —ilegible sobre rosa pálido— y como casi ningún post lleva foto, ese era el
// caso normal y no la excepción.
// ─────────────────────────────────────────────────────────────────────────────

const UNIT_FALLBACK = { minute: 'min', hour: 'h', day: 'd' } as const
const UNIT_KEY = { minute: 'Minutes', hour: 'Hours', day: 'Days' } as const

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

const CHIP = 'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black transition-colors'

export function FacultyDetail() {
  const { t } = useTranslation()
  const selectedFacultyId = useUIStore((s) => s.selectedFacultyId)
  const selectFaculty = useUIStore((s) => s.selectFaculty)
  const selectPin = useUIStore((s) => s.selectPin)
  const showToast = useUIStore((s) => s.showToast)
  const startPickingLocation = useUIStore((s) => s.startPickingLocation)
  const placeFocus = useUIStore((s) => s.placeFocus)
  const { pins } = usePins()
  const { mapping } = useMapping()

  /** `null` = todos los lugares de la facultad. */
  const [place, setPlace] = useState<PlaceOption | null>(null)

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

  const facultyPins = useMemo(
    () => pins.filter((p) => p.faculty_id === selectedFacultyId && p.type !== 'place'),
    [pins, selectedFacultyId],
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

  if (!selectedFacultyId || !faculty) return null

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
    const text = `${faculty.name} — UDP Map`
    try {
      if (navigator.share) {
        await navigator.share({ title: faculty.name, text, url })
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

  return (
    <DraggableBottomSheet
      isOpen={true}
      onClose={() => selectFaculty(null)}
      ariaLabel={faculty.name}
      className="!p-0"
    >
      {/* Sin `h-full` ni scroll propio: la hoja ya tiene el suyo, y anidar dos
          recortaba la última fila de tarjetas contra un alto que no era el que
          se estaba desplazando. */}
      <div className="flex w-full flex-col">
        {faculty.image && (
          <div className="relative h-32 w-full shrink-0">
            <img src={faculty.image} alt={faculty.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}

        <div className="relative flex shrink-0 items-start justify-between p-5 pb-3">
          <div className="flex flex-col gap-1 pr-16">
            <h2 className="text-xl font-bold leading-tight drop-shadow-sm">{faculty.name}</h2>
            <p className="text-sm opacity-80">
              {visiblePins.length} {visiblePins.length === 1 ? 'post' : 'posts'}
              {place && <span className="opacity-70"> · {place.name}</span>}
            </p>
          </div>
          <div className="absolute right-4 top-4 flex items-center gap-2">
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
        {places.length > 0 && (
          <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-5 pb-3">
            <button
              onClick={() => setPlace(null)}
              aria-pressed={place === null}
              className={`${CHIP} ${
                place === null
                  ? 'bg-[#D41F2D] text-white'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
              }`}
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
                  className={`${CHIP} ${
                    isActive
                      ? 'bg-[#D41F2D] text-white'
                      : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                  }`}
                >
                  {option.name} · {countAt(option)}
                </button>
              )
            })}
          </div>
        )}

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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visiblePins.map((pin) => {
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
                                {t(`time.in${UNIT_KEY[when.unit]}`, {
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
              })}
            </div>
          )}
        </div>
      </div>
    </DraggableBottomSheet>
  )
}
