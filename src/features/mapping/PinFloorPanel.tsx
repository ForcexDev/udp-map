import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Building2, Check, Save } from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { dbErrorMessage, isUserFacingDbError } from '@/shared/utils/dbError'
import { smallestContaining } from '@/shared/utils/geometry'
import { categoryById } from '@/shared/data/campusData'
import { adminSetPinFloors } from '@/features/admin/api'
import { floorName } from './areaStyles'
import type { FacultyMapping } from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Asignar planta a los pines que ya existen.
//
// Sin esto, ponerle piso a los pines de un edificio sería abrirlos uno a uno
// desde el mapa. Aquí se ven todos los del edificio en una tabla, se marca la
// planta de cada uno y se guarda de una vez.
//
// El edificio se deduce del punto (el área de menor superficie que lo contiene);
// la planta NO se puede deducir, porque desde arriba el piso 1 y el 3 son el
// mismo punto. Por eso hay que marcarla a mano, y por eso existe esta pantalla.
// ─────────────────────────────────────────────────────────────────────────────

interface PinFloorPanelProps {
  mapping: FacultyMapping
  pins: Pin[]
  onSaved: () => void
}

export function PinFloorPanel({ mapping, pins, onSaved }: PinFloorPanelProps) {
  const showToast = useUIStore((s) => s.showToast)
  const [buildingId, setBuildingId] = useState<string | null>(mapping.buildings[0]?.id ?? null)
  const [pending, setPending] = useState<Map<string, number | null>>(new Map())

  const building = mapping.buildings.find((b) => b.id === buildingId) ?? null
  const floors = mapping.floors
    .filter((f) => f.building_id === buildingId)
    .sort((a, b) => b.level - a.level)

  // Un pin pertenece al edificio si cae dentro de su huella. Se reutiliza
  // smallestContaining para que la regla sea la misma que usará el mapa.
  const pinsInBuilding = useMemo(() => {
    if (!building) return []
    return pins.filter((pin) => {
      const match = smallestContaining(
        mapping.buildings.map((b) => ({ id: b.id, polygon: b.footprint })),
        pin.lng,
        pin.lat,
      )
      return match?.id === building.id
    })
  }, [building, mapping.buildings, pins])

  const save = useMutation({
    mutationFn: () =>
      adminSetPinFloors([...pending.entries()].map(([pinId, floor]) => ({ pinId, floor }))),
    onSuccess: () => {
      showToast(`${pending.size} ${pending.size === 1 ? 'pin actualizado' : 'pines actualizados'}.`)
      setPending(new Map())
      onSaved()
    },
    onError: (error) => {
      showToast(
        isUserFacingDbError(error) ? dbErrorMessage(error) : 'No se pudieron guardar las plantas.',
      )
      if (!isUserFacingDbError(error)) console.error(error)
    },
  })

  const floorOf = (pin: Pin) => (pending.has(pin.id) ? pending.get(pin.id)! : pin.floor)

  const setFloor = (pinId: string, floor: number | null) => {
    setPending((prev) => new Map(prev).set(pinId, floor))
  }

  if (mapping.buildings.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay edificios"
        body="Traza al menos un edificio en la pestaña Trazar para poder asignar plantas a los pines."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <div className="flex flex-wrap gap-1">
          {mapping.buildings.map((b) => (
            <button
              key={b.id}
              onClick={() => setBuildingId(b.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                buildingId === b.id
                  ? 'bg-[#D41F2D] text-white'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
              }`}
            >
              <Building2 size={12} /> {b.short_name || b.name}
            </button>
          ))}
        </div>

        {pending.size > 0 && (
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#D41F2D] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#b01a25] disabled:opacity-50"
          >
            <Save size={13} />
            {save.isPending ? 'Guardando…' : `Guardar ${pending.size}`}
          </button>
        )}
      </div>

      {floors.length === 0 ? (
        <EmptyState
          title="Este edificio no tiene plantas"
          body="Agrégalas desde el árbol en la pestaña Trazar y vuelve aquí."
        />
      ) : pinsInBuilding.length === 0 ? (
        <EmptyState
          title="Ningún post cae dentro de este edificio"
          body={`Aquí aparecen los posts que ya publicó la gente (baños, impresoras, comida, salas) para decirles en qué planta están: eso no se puede deducir del mapa, porque desde arriba el piso 1 y el 3 son el mismo punto. Hay ${pins.length} ${pins.length === 1 ? 'post' : 'posts'} en esta facultad, pero ninguno queda dentro de esta huella. Si esperabas alguno, revisa que la huella del edificio lo cubra.`}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  Pin
                </th>
                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  Planta
                </th>
              </tr>
            </thead>
            <tbody>
              {pinsInBuilding.map((pin) => {
                const current = floorOf(pin)
                const changed = pending.has(pin.id)
                return (
                  <tr
                    key={pin.id}
                    className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {changed && <Check size={12} className="shrink-0 text-emerald-500" />}
                        <div className="min-w-0">
                          <p className="truncate font-bold text-neutral-800 dark:text-neutral-100">
                            {pin.title}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {categoryById(pin.category_id)?.name ?? pin.type}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <FloorChip
                          active={current === null}
                          onClick={() => setFloor(pin.id, null)}
                          label="Exterior"
                        />
                        {floors.map((floor) => (
                          <FloorChip
                            key={floor.level}
                            active={current === floor.level}
                            onClick={() => setFloor(pin.id, floor.level)}
                            label={floorName(floor.level, floor.label)}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FloorChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
        active
          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400'
      }`}
    >
      {label}
    </button>
  )
}

/** Un estado vacío sin salida es un callejón: siempre dice qué hacer. */
function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 p-8 text-center">
      <p className="text-sm font-black text-neutral-700 dark:text-neutral-200">{title}</p>
      <p className="max-w-sm text-xs leading-snug text-neutral-400">{body}</p>
    </div>
  )
}
