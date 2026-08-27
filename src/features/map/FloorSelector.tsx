import { localizedName } from '@/shared/utils/localized'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronUp, ChevronDown } from 'lucide-react'
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
//
// **Es una ventanilla, no una lista.** Enseñar las ocho plantas a la vez hacía
// una columna de 250px por el centro de la pantalla, justo encima de lo que se
// está mirando; en un teléfono se comía media vista. Ahora se ve UNA cara —la
// planta activa— entre dos flechas, y cambiarla la desliza en la dirección en
// la que vas, que es lo que hace que se lea como altura y no como un menú. La
// rueda del ratón también la mueve.
// ─────────────────────────────────────────────────────────────────────────────

export function FloorSelector() {
  const { t, i18n } = useTranslation()
  const { mapping } = useMapping()
  const activeFacultyId = useUIStore((s) => s.activeFacultyId)
  const activeFloor = useUIStore((s) => s.activeFloor)
  const setActiveFloor = useUIStore((s) => s.setActiveFloor)

  // Hacia dónde fue el último cambio, para saber por qué borde entra la cara
  // nueva. Solo decide la animación, así que no hace falta que sobreviva a nada.
  const [dir, setDir] = useState<'up' | 'down'>('up')
  // La rueda manda muchos eventos por gesto; sin freno un golpe de trackpad
  // recorre la facultad entera de arriba abajo.
  const lastWheel = useRef(0)

  if (!activeFacultyId) return null

  const faculty = FACULTIES.find((f) => f.id === activeFacultyId)
  const levels = facultyLevels(mapping, activeFacultyId)
  // Con una sola planta en toda la facultad no hay nada que elegir, y un
  // selector de un elemento solo ocupa sitio.
  if (levels.length < 2) return null

  // `levels` viene de mayor a menor, así que subir es restar índice.
  const index = activeFloor === null ? -1 : levels.findIndex((l) => l.level === activeFloor)
  const current = index === -1 ? null : levels[index]
  // Desde "Todo" las flechas tienen que aterrizar en algún sitio, y ese sitio es
  // la planta de acceso: el piso 1 si la facultad lo tiene, y si no la más alta.
  const entry = levels.find((l) => l.level === 1) ?? levels[0]

  const step = (delta: -1 | 1) => {
    setDir(delta === -1 ? 'up' : 'down')
    if (index === -1) {
      setActiveFloor(entry.level)
      return
    }
    const next = levels[index + delta]
    if (next) setActiveFloor(next.level)
  }

  const onWheel = (e: React.WheelEvent) => {
    const now = Date.now()
    if (now - lastWheel.current < 220) return
    lastWheel.current = now
    step(e.deltaY < 0 ? -1 : 1)
  }

  const ARROW =
    'flex items-center justify-center py-0.5 text-neutral-500 transition-colors hover:bg-neutral-100/70 disabled:opacity-25 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-neutral-800/70'

  return (
    <div className="pointer-events-auto absolute right-3 top-1/2 z-20 -translate-y-1/2 sm:right-5">
      {/* Columna estrecha y de ancho fijo: es un control de tránsito, no un
          panel. Con el nombre completo de la facultad medía el doble y se
          comía el mapa, que es justo lo que se está mirando. */}
      <div
        onWheel={onWheel}
        className="glass-hud flex w-11 flex-col items-stretch overflow-hidden rounded-2xl premium-shadow"
      >
        <p
          title={localizedName(faculty, i18n.language)}
          className="truncate border-b border-neutral-200/60 px-1 py-1 text-center text-[9px] font-black uppercase tracking-tight text-neutral-500 dark:border-neutral-700/60"
        >
          {faculty ? facultyShortName(localizedName(faculty, i18n.language)) : t('indoor.floorsTitle', 'Piso')}
        </p>

        <button
          onClick={() => step(-1)}
          disabled={index === 0}
          aria-label={t('indoor.floorUp', 'Subir un piso')}
          title={t('indoor.floorUp', 'Subir un piso')}
          className={ARROW}
        >
          <ChevronUp size={15} strokeWidth={3} />
        </button>

        {/* La ventanilla. `key` fuerza el remontado en cada cambio, que es lo que
            dispara la animación de entrada; sin él React reusa el nodo y el
            número salta sin deslizarse. */}
        <div
          aria-live="polite"
          title={current ? floorName(current.level, current.label) : t('indoor.allFloorsHint', 'Ver todas las plantas')}
          className={`flex h-9 items-center justify-center overflow-hidden transition-colors ${
            current ? 'bg-[#D41F2D] text-white' : 'text-neutral-400 dark:text-neutral-500'
          }`}
        >
          <span
            key={activeFloor ?? 'all'}
            className={`block truncate px-1 text-[15px] font-black leading-none tabular-nums ${
              dir === 'up' ? 'floor-roll-up' : 'floor-roll-down'
            }`}
          >
            {current
              ? current.label
                ? current.label.slice(0, 3)
                : floorShortName(current.level)
              : '—'}
          </span>
        </div>

        <button
          onClick={() => step(1)}
          disabled={index === levels.length - 1}
          aria-label={t('indoor.floorDown', 'Bajar un piso')}
          title={t('indoor.floorDown', 'Bajar un piso')}
          className={ARROW}
        >
          <ChevronDown size={15} strokeWidth={3} />
        </button>

        {/* "Todo" apaga el filtro sin salir de la facultad: cada edificio vuelve
            a su planta por defecto, que es la vista de conjunto. Con la
            ventanilla en "—", es también lo que explica qué significa ese guion. */}
        <button
          onClick={() => {
            setDir('down')
            setActiveFloor(null)
          }}
          aria-pressed={activeFloor === null}
          title={t('indoor.allFloorsHint', 'Ver todas las plantas')}
          className={`border-t border-neutral-200/60 px-1 py-1 text-[8.5px] font-black uppercase tracking-tight transition-colors dark:border-neutral-700/60 ${
            activeFloor === null
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'text-neutral-500 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70'
          }`}
        >
          {t('indoor.allFloors', 'Todo')}
        </button>
      </div>
    </div>
  )
}
