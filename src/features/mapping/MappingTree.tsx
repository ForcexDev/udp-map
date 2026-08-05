import { Building2, ChevronDown, ChevronRight, Layers, Minus, Plus, Trees } from 'lucide-react'
import type { Building, BuildingFloor } from '@/shared/types/database'
import { floorName } from './areaStyles'
import { floorKey, useMappingEditor, type FloorViewMode } from './editorStore'

// ─────────────────────────────────────────────────────────────────────────────
// El árbol es el mapa mental completo: facultad → edificios → plantas.
//
// Las plantas se agregan y se quitan de a una, que es lo que exige la realidad:
// un edificio tiene tres pisos y ningún subterráneo, el de al lado tiene
// subterráneo, y ninguno de los dos se parece al siguiente.
// ─────────────────────────────────────────────────────────────────────────────

interface MappingTreeProps {
  buildings: Building[]
  floors: BuildingFloor[]
  areaCounts: Map<string, number>
  outdoorCount: number
  onAddBuilding: () => void
  onAddFloor: (buildingId: string, level: number) => void
  onRemoveFloor: (buildingId: string, level: number) => void
}

const ROW = 'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors'
const ROW_IDLE = 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
const ROW_ACTIVE = 'bg-[#D41F2D]/10 text-[#D41F2D] font-bold'

export function MappingTree({
  buildings,
  floors,
  areaCounts,
  outdoorCount,
  onAddBuilding,
  onAddFloor,
  onRemoveFloor,
}: MappingTreeProps) {
  const selectedBuildingId = useMappingEditor((s) => s.selectedBuildingId)
  const selectedFloor = useMappingEditor((s) => s.selectedFloor)
  const selectBuilding = useMappingEditor((s) => s.selectBuilding)
  const selectFloor = useMappingEditor((s) => s.selectFloor)
  const selectOutdoor = useMappingEditor((s) => s.selectOutdoor)
  const viewMode = useMappingEditor((s) => s.viewMode)
  const setViewMode = useMappingEditor((s) => s.setViewMode)
  const activeLevel = useMappingEditor((s) => s.activeLevel)
  const setActiveLevel = useMappingEditor((s) => s.setActiveLevel)

  // Todas las plantas que existen en la facultad, sin repetir. Es lo que
  // permite mirar "el piso 1" como una capa completa en vez de edificio a
  // edificio.
  const allLevels = [...new Set(floors.map((f) => f.level))].sort((a, b) => b - a)

  if (viewMode === 'level') {
    return (
      <div className="flex h-full flex-col gap-1 overflow-y-auto p-3">
        <ViewSwitch mode={viewMode} onChange={setViewMode} />

        <p className="mb-1 mt-2 px-1 text-[9px] font-black uppercase tracking-wider text-neutral-400">
          Planta de toda la facultad
        </p>

        <button
          onClick={() => setActiveLevel(null)}
          className={`${ROW} ${activeLevel === null ? ROW_ACTIVE : ROW_IDLE}`}
        >
          <Trees size={14} />
          <span className="flex-1 truncate">Solo exterior</span>
          <Count value={outdoorCount} />
        </button>

        {allLevels.map((level) => {
          // Cuántos edificios tienen esta planta: dice de un vistazo si el
          // nivel 3 es de un solo edificio o de todos.
          const buildingsHere = new Set(
            floors.filter((f) => f.level === level).map((f) => f.building_id),
          ).size
          const areasHere = floors
            .filter((f) => f.level === level)
            .reduce((acc, f) => acc + (areaCounts.get(floorKey(f.building_id, level)) ?? 0), 0)

          return (
            <button
              key={level}
              onClick={() => setActiveLevel(level)}
              className={`${ROW} ${activeLevel === level ? ROW_ACTIVE : ROW_IDLE}`}
            >
              <Layers size={13} />
              <span className="flex-1 truncate">{floorName(level, null)}</span>
              <span className="text-[9px] text-neutral-400">{buildingsHere} ed.</span>
              <Count value={areasHere} />
            </button>
          )
        })}

        {allLevels.length === 0 && (
          <p className="px-1 py-3 text-[11px] leading-snug text-neutral-400">
            Todavía no hay plantas. Créalas desde la vista por edificio.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <ViewSwitch mode={viewMode} onChange={setViewMode} />
      <button
        onClick={selectOutdoor}
        className={`${ROW} ${selectedBuildingId === null ? ROW_ACTIVE : ROW_IDLE}`}
      >
        <Trees size={14} />
        <span className="flex-1 truncate">Exterior</span>
        <Count value={outdoorCount} />
      </button>

      {buildings.map((building) => {
        const expanded = selectedBuildingId === building.id
        const buildingFloors = floors
          .filter((f) => f.building_id === building.id)
          .sort((a, b) => b.level - a.level)

        const levels = buildingFloors.map((f) => f.level)
        const nextUp = levels.length === 0 ? 1 : Math.max(...levels) + 1
        // Bajar desde el 1 lleva al -1: la planta 0 no existe.
        const lowest = levels.length === 0 ? 1 : Math.min(...levels)
        const nextDown = lowest === 1 ? -1 : lowest - 1

        return (
          <div key={building.id} className="flex flex-col">
            <button
              onClick={() => selectBuilding(building.id)}
              className={`${ROW} ${expanded && selectedFloor === null ? ROW_ACTIVE : ROW_IDLE}`}
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Building2 size={14} />
              <span className="flex-1 truncate">{building.short_name || building.name}</span>
            </button>

            {expanded && (
              <div className="ml-3 flex flex-col gap-0.5 border-l border-neutral-200 pl-2 dark:border-neutral-800">
                {buildingFloors.map((floor) => (
                  <div key={floor.level} className="group flex items-center gap-1">
                    <button
                      onClick={() => selectFloor(building.id, floor.level)}
                      className={`${ROW} flex-1 ${
                        selectedFloor === floor.level ? ROW_ACTIVE : ROW_IDLE
                      }`}
                    >
                      <Layers size={12} />
                      <span className="flex-1 truncate">{floorName(floor.level, floor.label)}</span>
                      <Count value={areaCounts.get(floorKey(building.id, floor.level)) ?? 0} />
                    </button>
                    <button
                      onClick={() => onRemoveFloor(building.id, floor.level)}
                      title={`Quitar ${floorName(floor.level, floor.label)}`}
                      className="rounded p-1 text-neutral-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-[#D41F2D] group-hover:opacity-100 dark:hover:bg-red-950/40"
                    >
                      <Minus size={12} />
                    </button>
                  </div>
                ))}

                <div className="mt-1 flex gap-1">
                  <TinyButton onClick={() => onAddFloor(building.id, nextUp)}>
                    <Plus size={10} /> Piso {nextUp}
                  </TinyButton>
                  <TinyButton onClick={() => onAddFloor(building.id, nextDown)}>
                    <Plus size={10} /> Subt. {Math.abs(nextDown)}
                  </TinyButton>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <button
        onClick={onAddBuilding}
        className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-2 py-2 text-[11px] font-bold text-neutral-500 transition-colors hover:border-[#D41F2D] hover:text-[#D41F2D] dark:border-neutral-700"
      >
        <Plus size={12} /> Nuevo edificio
      </button>
    </div>
  )
}

/**
 * Dos formas de recorrer lo mismo. "Por edificio" es para trazar el interior de
 * uno; "Por planta" enseña el piso N de todos a la vez más el exterior, que es
 * lo que después ve el estudiante y donde se nota si algo no calza entre
 * edificios vecinos.
 */
function ViewSwitch({
  mode,
  onChange,
}: {
  mode: FloorViewMode
  onChange: (mode: FloorViewMode) => void
}) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
      {(
        [
          ['building', 'Por edificio'],
          ['level', 'Por planta'],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`flex-1 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider transition-colors ${
            mode === value
              ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Count({ value }: { value: number }) {
  if (value === 0) return null
  return (
    <span className="rounded-full bg-neutral-100 px-1.5 text-[9px] font-bold text-neutral-500 dark:bg-neutral-800">
      {value}
    </span>
  )
}

function TinyButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1 rounded-md bg-neutral-100 px-1.5 py-1 text-[10px] font-bold text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
    >
      {children}
    </button>
  )
}
