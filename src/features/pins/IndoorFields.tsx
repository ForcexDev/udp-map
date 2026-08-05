import { useEffect, useRef } from 'react'
import { Building2, Layers } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { facultyIdAt } from '@/shared/data/facultyPerimeters'
import { floorFromRoomCode } from '@/shared/utils/roomCode'
import { floorName } from '@/features/mapping/areaStyles'
import { areaAt, buildingAt, floorsOf, useMapping } from '@/features/mapping/useMapping'

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

const LABEL = 'text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1'
const CHIP = 'rounded-xl px-4 py-2 text-xs font-black transition-all'
const CHIP_ON = 'bg-[#D41F2D] text-white shadow-sm'
const CHIP_OFF = 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'

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
  const { mapping } = useMapping()
  const activeFloor = useUIStore((s) => s.activeFloor)

  const facultyId = facultyIdAt(lat, lng)
  const building = buildingAt(mapping.buildings, lng, lat)
  const area = areaAt(mapping.areas, lng, lat, floor)

  // Si el punto cae dentro de un edificio, se muestran SOLO las plantas de ese
  // edificio. Fuera de todo edificio (patio, pasillo) no se ofrece selector:
  // el pin queda en Exterior (floor = null) porque quien está al aire libre
  // no necesita elegir entre subterráneos de edificios que no tiene debajo.
  const levels: { level: number; label: string | null }[] = building
    ? floorsOf(mapping.floors, building.id).map((f) => ({ level: f.level, label: f.label }))
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
    <div className="space-y-6">
      {levels.length > 0 && (
        <div className="space-y-3">
          <label className={LABEL}>Piso</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onFloorChange(null)}
              aria-pressed={floor === null}
              className={`${CHIP} ${floor === null ? CHIP_ON : CHIP_OFF}`}
            >
              Exterior
            </button>
            {levels.map((l) => (
              <button
                key={l.level}
                type="button"
                onClick={() => onFloorChange(l.level)}
                aria-pressed={floor === l.level}
                className={`${CHIP} ${floor === l.level ? CHIP_ON : CHIP_OFF}`}
              >
                {floorName(l.level, l.label)}
              </button>
            ))}
          </div>
          <p className="ml-1 text-[11px] leading-snug text-neutral-400">
            Exterior es para lo que está al aire libre: el patio, la entrada, la calle.
          </p>
        </div>
      )}

      {isRoom && (
        <div className="space-y-3">
          <label className={LABEL}>Código de sala</label>
          <input
            value={roomCode}
            onChange={(e) => handleRoomCode(e.target.value)}
            maxLength={40}
            placeholder="E441.1.S101 · SMV-03 · A-302"
            className="w-full rounded-2xl border border-neutral-100 bg-neutral-50/70 px-6 py-4 font-mono text-sm font-bold text-neutral-700 shadow-sm outline-none transition-colors focus:border-[#D41F2D] dark:border-neutral-700 dark:bg-neutral-800/70 dark:text-neutral-300"
          />
          <p className="ml-1 text-[11px] leading-snug text-neutral-400">
            Opcional. Si tu sala no tiene código, déjalo vacío.
          </p>
        </div>
      )}

      {/* Comprobación antes de publicar: dice dónde va a quedar el pin. */}
      {breadcrumb.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-neutral-100 bg-neutral-50/70 px-5 py-3.5 dark:border-neutral-700 dark:bg-neutral-800/70">
          <Building2 size={15} className="shrink-0 text-neutral-400" />
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-neutral-600 dark:text-neutral-400">
            {breadcrumb.join(' · ')}
            {floor !== null && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-neutral-400">
                <Layers size={11} />
                {floorName(floor, levels.find((l) => l.level === floor)?.label ?? null)}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
