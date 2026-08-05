import { useUIStore } from '@/shared/stores/uiStore'
import { FACULTIES } from '@/shared/data/campusData'
import { facultyShortName } from '@/shared/utils/facultyShortName'
import { floorName, floorShortName } from '@/features/mapping/areaStyles'
import { facultyLevels, useMapping } from '@/features/mapping/useMapping'

// ─────────────────────────────────────────────────────────────────────────────
// Selector de plantas de la FACULTAD.
//
// Columna vertical a la derecha, centrada: es donde lo ponen Apple y Google
// Maps, y donde no choca con ubicación y brújula (arriba) ni con el selector de
// sede y el 2D/3D (abajo).
//
// Lista la unión de las plantas de todos los edificios mapeados de la facultad,
// porque la planta es de la facultad: elegir el 2 enseña el segundo piso de los
// cuatro edificios a la vez. Antes colgaba del edificio que quedara bajo el
// centro del mapa, y entonces cruzar de uno a otro cambiaba de piso solo y el
// resto de la facultad seguía enseñando todos sus pisos superpuestos.
//
// No se pide ni se abre: aparece al entrar en una facultad con interior
// mapeado, y se va al salir.
// ─────────────────────────────────────────────────────────────────────────────

export function FloorSelector() {
  const { mapping } = useMapping()
  const activeFacultyId = useUIStore((s) => s.activeFacultyId)
  const activeFloor = useUIStore((s) => s.activeFloor)
  const setActiveFloor = useUIStore((s) => s.setActiveFloor)

  if (!activeFacultyId) return null

  const faculty = FACULTIES.find((f) => f.id === activeFacultyId)
  const levels = facultyLevels(mapping, activeFacultyId)
  // Con una sola planta en toda la facultad no hay nada que elegir, y un
  // selector de un elemento solo ocupa sitio.
  if (levels.length < 2) return null

  return (
    <div className="pointer-events-auto absolute right-3 top-1/2 z-20 -translate-y-1/2 sm:right-5">
      {/* Columna estrecha y de ancho fijo: es un control de tránsito, no un
          panel. Con el nombre completo de la facultad medía el doble y se
          comía el mapa, que es justo lo que se está mirando. */}
      <div className="glass-hud flex w-11 flex-col items-stretch overflow-hidden rounded-2xl premium-shadow">
        <p
          title={faculty?.name}
          className="truncate border-b border-neutral-200/60 px-1 py-1.5 text-center text-[9px] font-black uppercase tracking-tight text-neutral-500 dark:border-neutral-700/60"
        >
          {faculty ? facultyShortName(faculty.name) : 'Pisos'}
        </p>

        {levels.map((level) => {
          const isActive = activeFloor === level.level
          return (
            <button
              key={level.level}
              onClick={() => setActiveFloor(level.level)}
              aria-pressed={isActive}
              title={floorName(level.level, level.label)}
              className={`px-1 py-1.5 text-[12px] font-black tabular-nums transition-colors ${
                isActive
                  ? 'bg-[#D41F2D] text-white'
                  : 'text-neutral-600 hover:bg-neutral-100/70 dark:text-neutral-300 dark:hover:bg-neutral-800/70'
              }`}
            >
              {level.label ? level.label.slice(0, 3) : floorShortName(level.level)}
            </button>
          )
        })}

        {/* "Todo" apaga el filtro sin salir de la facultad: cada edificio vuelve
            a su planta por defecto, que es la vista de conjunto. */}
        <button
          onClick={() => setActiveFloor(null)}
          aria-pressed={activeFloor === null}
          title="Ver todas las plantas"
          className={`border-t border-neutral-200/60 px-1 py-1.5 text-[8.5px] font-black uppercase tracking-tight transition-colors dark:border-neutral-700/60 ${
            activeFloor === null
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'text-neutral-500 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70'
          }`}
        >
          Todo
        </button>
      </div>
    </div>
  )
}
