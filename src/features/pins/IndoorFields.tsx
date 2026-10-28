import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { facultyIdAt } from '@/shared/data/facultyStore'
import { floorFromRoomCode } from '@/shared/utils/roomCode'
import { floorName } from '@/features/mapping/areaStyles'
import {
  areaAt,
  buildingAt,
  facultyLevels,
  floorsOf,
  useMapping,
} from '@/features/mapping/useMapping'

// ─────────────────────────────────────────────────────────────────────────────
// Planta, código de sala y confirmación de dónde va a quedar el pin.
//
// El edificio y el área se deducen del punto y solo se muestran, para que se
// pueda comprobar antes de publicar. La PLANTA no se puede deducir —desde
// arriba el piso 1 y el 3 son el mismo sitio—, así que se elige.
//
// Las plantas que se ofrecen dependen de dónde cae el punto:
// • Dentro de un edificio → solo las de ESE edificio (floorsOf). Así un
//   edificio de una planta no muestra subterráneos que no tiene.
// • Fuera de todo edificio (patio, pasillo) → las de la FACULTAD, la unión
//   de las de todos sus edificios. Sin eso no habría selector.
// ─────────────────────────────────────────────────────────────────────────────

interface IndoorFieldsProps {
  lat: number
  lng: number
  floor: number | null
  roomCode: string
  isRoom: boolean
  /**
   * Preseleccionar la planta que se estaba mirando en el mapa. Solo al CREAR:
   * al editar manda lo que el pin ya tiene guardado, incluido el null.
   */
  autoSelectFloor?: boolean
  onFloorChange: (floor: number | null) => void
  onRoomCodeChange: (code: string) => void
}

const LABEL = 'text-xs font-semibold text-stone-500 dark:text-stone-400 ml-0.5'
const CHIP_BASE =
  'shrink-0 snap-center cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-bold tabular-nums transition-all'
const CHIP_OFF =
  'border border-[#E6E0D5] bg-white text-stone-600 hover:text-stone-900 dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-400 dark:hover:text-stone-100'
const CHIP_EXTERIOR_ON =
  'bg-stone-900 text-[#FAF8F5] shadow-xs dark:bg-stone-100 dark:text-stone-950'
const CHIP_FLOOR_ON =
  'border border-[#F2D0CE] bg-[#FBECEB] text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300'

export function IndoorFields({
  lat,
  lng,
  floor,
  roomCode,
  isRoom,
  autoSelectFloor = false,
  onFloorChange,
  onRoomCodeChange,
}: IndoorFieldsProps) {
  const { t } = useTranslation()
  const { mapping } = useMapping()
  const activeFloor = useUIStore((s) => s.activeFloor)

  const facultyId = facultyIdAt(lat, lng)
  const building = buildingAt(mapping.buildings, lng, lat)
  const area = areaAt(mapping.areas, lng, lat, floor)

  // Dentro de un edificio se ofrecen SOLO sus plantas, para que uno de una
  // planta no muestre subterráneos que no tiene. Fuera de toda huella se cae a
  // las de la FACULTAD: publicar desde el panel de una facultad deja el punto
  // en su centroide, que casi siempre es patio, y hasta ahora eso dejaba el
  // formulario sin ningún selector de planta. El chip Exterior sigue siendo la
  // opción por defecto ahí, así que para el patio de verdad nada cambia.
  const levels: { level: number; label: string | null }[] = building
    ? floorsOf(mapping.floors, building.id).map((f) => ({ level: f.level, label: f.label }))
    : facultyId
      ? facultyLevels(mapping, facultyId).map((l) => ({ level: l.level, label: l.label }))
      : []

  // Se entra con la planta que se estaba mirando en el mapa: si alguien navegó
  // hasta el piso 3 y pulsa "+", lo que quiere publicar está en el 3. Si el
  // punto cae fuera de toda huella, se entra por Exterior.
  //
  // Un `ref` y no `floor === null` como guardia, porque aquí null no significa
  // "sin elegir" sino "Exterior", que es una elección como cualquier otra.
  const seededFor = useRef<string | null>(null)
  useEffect(() => {
    if (!autoSelectFloor || !facultyId) return
    if (seededFor.current === facultyId) return
    seededFor.current = facultyId

    if (activeFloor !== null && levels.some((l) => l.level === activeFloor)) {
      onFloorChange(activeFloor)
      return
    }
    if (building && levels.some((l) => l.level === building.default_floor)) {
      onFloorChange(building.default_floor)
      return
    }
    onFloorChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectFloor, facultyId, building?.id])

  const trackRef = useRef<HTMLDivElement | null>(null)
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const overflows = el.scrollWidth > el.clientWidth + 2
    setIsOverflowing(overflows)
    setCanScrollLeft(overflows && el.scrollLeft > 2)
    setCanScrollRight(overflows && el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    updateScrollState()
    const ro = new ResizeObserver(() => updateScrollState())
    ro.observe(el)
    el.addEventListener('scroll', updateScrollState, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', updateScrollState)
    }
  }, [updateScrollState, levels.length])

  useEffect(() => {
    const key = floor === null ? 'exterior' : String(floor)
    const btn = chipRefs.current.get(key)
    const track = trackRef.current
    if (!btn || !track) return
    const targetLeft = btn.offsetLeft - track.clientWidth / 2 + btn.clientWidth / 2
    track.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
  }, [floor])

  // El código de sala puede traer la planta dentro (`E441.3.S301`). Es una
  // sugerencia: rellena el selector y se puede cambiar. Los códigos que no
  // siguen ningún esquema conocido no dicen nada y no pasa nada.
  const handleRoomCode = (value: string) => {
    onRoomCodeChange(value)
    const deduced = floorFromRoomCode(value)
    if (deduced !== null && levels.some((l) => l.level === deduced)) {
      onFloorChange(deduced)
    }
  }

  const breadcrumb = [building?.short_name || building?.name, area?.name].filter(Boolean)

  // Sin interior mapeado no hay nada que preguntar, salvo el código de sala.
  if (levels.length === 0 && !isRoom) return null

  return (
    <div className="space-y-5">
      {levels.length > 0 && (
        <div className="space-y-2.5">
          <label className={LABEL}>Piso</label>
          <div className="flex items-center gap-1">
            {isOverflowing && (
              <button
                type="button"
                onClick={() => trackRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}
                disabled={!canScrollLeft}
                aria-label={t('indoor.floorDown', 'Bajar un piso')}
                className="flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#E6E0D5] bg-white text-stone-500 transition-opacity hover:text-stone-900 disabled:pointer-events-none disabled:opacity-25 dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-400 dark:hover:text-stone-100"
              >
                <ChevronLeft size={15} strokeWidth={2.5} />
              </button>
            )}

            <div
              ref={trackRef}
              className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory py-0.5"
            >
              <button
                ref={(node) => {
                  if (node) chipRefs.current.set('exterior', node)
                  else chipRefs.current.delete('exterior')
                }}
                type="button"
                onClick={() => onFloorChange(null)}
                aria-pressed={floor === null}
                className={`${CHIP_BASE} ${floor === null ? CHIP_EXTERIOR_ON : CHIP_OFF}`}
              >
                Exterior
              </button>
              {levels.map((l) => {
                const isActive = floor === l.level
                const key = String(l.level)
                return (
                  <button
                    key={l.level}
                    ref={(node) => {
                      if (node) chipRefs.current.set(key, node)
                      else chipRefs.current.delete(key)
                    }}
                    type="button"
                    onClick={() => onFloorChange(l.level)}
                    aria-pressed={isActive}
                    className={`${CHIP_BASE} ${isActive ? CHIP_FLOOR_ON : CHIP_OFF}`}
                  >
                    {floorName(l.level, l.label)}
                  </button>
                )
              })}
            </div>

            {isOverflowing && (
              <button
                type="button"
                onClick={() => trackRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
                disabled={!canScrollRight}
                aria-label={t('indoor.floorUp', 'Subir un piso')}
                className="flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#E6E0D5] bg-white text-stone-500 transition-opacity hover:text-stone-900 disabled:pointer-events-none disabled:opacity-25 dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-400 dark:hover:text-stone-100"
              >
                <ChevronRight size={15} strokeWidth={2.5} />
              </button>
            )}
          </div>
          <p className="ml-0.5 text-xs text-stone-400 dark:text-stone-500">
            Exterior es para lo que está al aire libre: el patio, la entrada, la calle.
          </p>
        </div>
      )}

      {isRoom && (
        <div className="space-y-2">
          <label className={LABEL}>{t('pin.roomCode', 'Código de sala')}</label>
          <input
            value={roomCode}
            onChange={(e) => handleRoomCode(e.target.value)}
            maxLength={40}
            placeholder="E441.1.S101 · SMV-03 · A-302"
            className="w-full rounded-2xl border border-[#E6E0D5] bg-white px-4 py-3 font-mono text-sm font-bold tabular-nums text-stone-800 shadow-xs outline-none transition-colors focus:border-[#C22B38] dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-200 dark:focus:border-[#D93846]"
          />
          <p className="ml-0.5 text-xs text-stone-400 dark:text-stone-500">
            Opcional. Si tu sala no tiene código, déjalo vacío.
          </p>
        </div>
      )}

      {/* Comprobación antes de publicar: dice dónde va a quedar el pin. */}
      {breadcrumb.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#E6E0D5] bg-white px-4 py-3 shadow-xs dark:border-white/[0.07] dark:bg-[#1E222D]">
          <Building2 size={16} className="shrink-0 text-stone-400 dark:text-stone-500" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-stone-700 dark:text-stone-300">
            {breadcrumb.join(' · ')}
            {floor !== null && (
              <span className="ml-1.5 inline-flex items-center gap-1 font-bold tabular-nums text-[#B02330] dark:text-rose-300">
                <Layers size={12} />
                {floorName(floor, levels.find((l) => l.level === floor)?.label ?? null)}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
