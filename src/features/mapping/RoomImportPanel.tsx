import { useMemo } from 'react'
import { CircleCheck, DoorOpen, MapPin, RefreshCw, X } from 'lucide-react'
import type { Building, Pin } from '@/shared/types/database'
import {
  buildingMatchesCode,
  catalogRoomsOf,
  normalizeRoomCode,
  type CatalogRoom,
} from '@/shared/utils/roomCatalog'
import { floorName } from './areaStyles'
import { useMappingEditor } from './editorStore'
import { useEitRoomCatalog } from './salasEit'
import type { FacultyMapping } from './api'

// ─────────────────────────────────────────────────────────────────────────────
// El importador de salas.
//
// El problema que resuelve: el horario de la FIC conoce 82 salas repartidas en
// once edificios (`docs/SALAS.md` §5), y crearlas a mano una por una —abriendo
// el formulario, escribiendo el código, eligiendo la planta— son 82 formularios.
//
// Lo que NO hace, y es deliberado: crearlas todas de golpe. Un alta masiva las
// pondría a todas en el centroide del edificio, que es exactamente el resultado
// inútil contra el que avisa el ROADMAP; y ni siquiera funcionaría, porque
// `prevent_occupied_pin_location` rechaza dos pines vivos en el mismo punto y
// la misma planta. La coordenada es el dato que la fuente NO tiene y que solo
// puede poner una persona mirando el plano.
//
// Así que el trato es: la lista pone el código y la planta —lo tedioso y lo
// que se escribe mal—, y quien mapea pone el punto con un clic.
// ─────────────────────────────────────────────────────────────────────────────

interface RoomImportPanelProps {
  mapping: FacultyMapping
  pins: Pin[]
  building: Building | null
}

export function RoomImportPanel({ mapping, pins, building }: RoomImportPanelProps) {
  const catalog = useEitRoomCatalog()
  const pendingRoom = useMappingEditor((s) => s.pendingRoom)
  const setPendingRoom = useMappingEditor((s) => s.setPendingRoom)

  // Qué prefijo del catálogo le corresponde a este edificio. Sale de su nombre
  // corto o de sus alias, porque el prefijo ES la dirección postal (§3).
  const buildingCode = useMemo(() => {
    if (!building) return null
    const codes = [building.short_name, ...(building.aliases ?? [])]
    const found = new Set((catalog.data ?? []).map((room) => room.buildingCode))
    for (const code of found) {
      if (buildingMatchesCode(codes, code)) return code
    }
    return null
  }, [building, catalog.data])

  // Las plantas declaradas del edificio. Una sala en una planta que nadie
  // declaró la rechaza `trg_validate_pin_floor`, así que aquí se avisa antes en
  // vez de dejar que el alta falle con un error de la base.
  const declaredFloors = useMemo(
    () =>
      new Set(
        mapping.floors.filter((f) => f.building_id === building?.id).map((f) => f.level),
      ),
    [mapping.floors, building?.id],
  )

  const rooms = useMemo(
    () => (buildingCode ? catalogRoomsOf(catalog.data ?? [], buildingCode) : []),
    [catalog.data, buildingCode],
  )

  // Qué códigos ya tienen pin. Normalizados, porque `room_code` se guarda tal
  // cual lo escribió quien publicó el pin.
  const taken = useMemo(
    () =>
      new Set(
        pins
          .map((pin) => pin.room_code)
          .filter((code): code is string => Boolean(code))
          .map(normalizeRoomCode),
      ),
    [pins],
  )

  if (!building) {
    return <Hint>Elige un edificio para ver qué salas conoce el horario de la FIC.</Hint>
  }

  if (catalog.isPending) {
    return <Hint>Leyendo el horario de la FIC…</Hint>
  }

  if ((catalog.data ?? []).length === 0) {
    return (
      <Hint>
        No se pudo leer el horario de la FIC. Es una fuente de terceros y puede estar caída; el
        resto del editor funciona igual.
      </Hint>
    )
  }

  if (!buildingCode) {
    return (
      <Hint>
        El horario no reconoce este edificio. El catálogo lo identifica por su dirección postal
        (<code>E441</code>, <code>V432</code>, <code>E278A</code>…): pon ese código en el nombre
        corto del edificio o entre sus alias y aparecerán sus salas.
      </Hint>
    )
  }

  const missing = rooms.filter((room) => !taken.has(normalizeRoomCode(room.code)))

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="m-0 text-[11px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Salas de {buildingCode}
          </h3>
          <p className="m-0 text-[11px] font-medium text-neutral-400">
            {rooms.length - missing.length} de {rooms.length} ya están en el mapa
          </p>
        </div>
        <button
          type="button"
          onClick={() => void catalog.refetch()}
          disabled={catalog.isFetching}
          title="Volver a leer el horario"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <RefreshCw size={14} className={catalog.isFetching ? 'animate-spin' : undefined} />
        </button>
      </header>

      {pendingRoom && (
        <div className="flex items-center gap-2 rounded-xl border border-[#D41F2D]/30 bg-[#D41F2D]/[0.06] px-3 py-2">
          <MapPin size={14} className="shrink-0 text-[#D41F2D]" />
          <p className="m-0 min-w-0 flex-1 text-[11px] font-bold leading-snug text-neutral-700 dark:text-neutral-200">
            Toca el mapa donde está <span className="font-black">{pendingRoom.code}</span>
          </p>
          <button
            type="button"
            onClick={() => setPendingRoom(null)}
            aria-label="Cancelar"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-700"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <ul className="m-0 flex max-h-80 flex-col gap-1 overflow-y-auto p-0 list-none">
        {rooms.map((room) => (
          <RoomRow
            key={room.code}
            room={room}
            exists={taken.has(normalizeRoomCode(room.code))}
            floorDeclared={declaredFloors.has(room.floor)}
            active={pendingRoom?.code === room.code}
            onPlace={() => setPendingRoom(room)}
          />
        ))}
      </ul>
    </div>
  )
}

interface RoomRowProps {
  room: CatalogRoom
  exists: boolean
  floorDeclared: boolean
  active: boolean
  onPlace: () => void
}

function RoomRow({ room, exists, floorDeclared, active, onPlace }: RoomRowProps) {
  return (
    <li
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        active ? 'bg-[#D41F2D]/10' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
      }`}
    >
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${
          exists
            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50'
            : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'
        }`}
      >
        {exists ? <CircleCheck size={13} /> : <DoorOpen size={13} />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-neutral-800 dark:text-neutral-200">
          {room.room}
        </span>
        <span className="block truncate text-[10px] font-medium text-neutral-400">
          {floorName(room.floor, null)} · {room.blocks} {room.blocks === 1 ? 'bloque' : 'bloques'}
        </span>
      </span>

      {exists ? null : !floorDeclared ? (
        // Es un aviso y no un botón deshabilitado y mudo: la planta que falta
        // se declara en este mismo editor, dos paneles más arriba.
        <span
          title="Declara esta planta en el edificio antes de colocar la sala"
          className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-950/50 dark:text-amber-500"
        >
          Falta la planta
        </span>
      ) : (
        <button
          type="button"
          onClick={onPlace}
          className="shrink-0 rounded-md bg-neutral-900 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#D41F2D] dark:bg-white dark:text-neutral-900 dark:hover:bg-[#D41F2D] dark:hover:text-white"
        >
          {active ? 'Colocando…' : 'Colocar'}
        </button>
      )}
    </li>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 rounded-xl border border-dashed border-neutral-200 px-3 py-4 text-center text-[11px] font-medium leading-relaxed text-neutral-400 dark:border-neutral-700">
      {children}
    </p>
  )
}
