import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Copy,
  Download,
  Grid3x3,
  Layers,
  Magnet,
  Monitor,
  MousePointer2,
  PenLine,
  Redo2,
  Square,
  Undo2,
} from 'lucide-react'
import type { Polygon } from 'geojson'
import { FACULTIES } from '@/shared/data/campusData'
import { useUIStore } from '@/shared/stores/uiStore'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import { Spinner } from '@/shared/ui/Spinner'
import { fetchPins } from '@/features/pins/api'
import {
  formatArea,
  polygonAreaM2,
  polygonCentroid,
  smallestContaining,
  splitQuadIntoN,
} from '@/shared/utils/geometry'
import { dbErrorMessage, isUserFacingDbError } from '@/shared/utils/dbError'
import {
  addFloor,
  createArea,
  createAreas,
  deleteArea,
  deleteBuilding,
  deleteFloor,
  fetchFacultyMapping,
  updateArea,
  upsertBuilding,
} from './api'
import { MappingCanvas } from './MappingCanvas'
import { MappingProperties, type AreaFormValues, type BuildingFormValues } from './MappingProperties'
import { MappingTree } from './MappingTree'
import { PinFloorPanel } from './PinFloorPanel'
import { buildExport, downloadExport } from './export'
import { draftPolygon, floorKey, useMappingEditor, type Tool } from './editorStore'
import { floorName } from './areaStyles'

// ─────────────────────────────────────────────────────────────────────────────
// Editor de mapeo. Tres paneles: árbol, lienzo y propiedades.
//
// Es de escritorio y solo para administradores, así que no hay concesiones al
// móvil: manda el teclado. Los atajos son los que hacen que trazar un edificio
// entero no sea una tarde perdida.
// ─────────────────────────────────────────────────────────────────────────────

type Mode = 'draw' | 'pins'

const TOOLS: { tool: Tool; icon: typeof Square; label: string; key: string }[] = [
  { tool: 'select', icon: MousePointer2, label: 'Seleccionar', key: 'V' },
  { tool: 'rect', icon: Square, label: 'Rectángulo', key: 'R' },
  { tool: 'polygon', icon: PenLine, label: 'Polígono', key: 'P' },
  { tool: 'trace', icon: Copy, label: 'Calcar de OSM', key: 'T' },
]

export function MappingPage() {
  const queryClient = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)

  const facultyId = useMappingEditor((s) => s.facultyId)
  const setFacultyId = useMappingEditor((s) => s.setFacultyId)
  const selectedBuildingId = useMappingEditor((s) => s.selectedBuildingId)
  const selectedFloor = useMappingEditor((s) => s.selectedFloor)
  const selectedAreaId = useMappingEditor((s) => s.selectedAreaId)
  const tool = useMappingEditor((s) => s.tool)
  const setTool = useMappingEditor((s) => s.setTool)
  const draft = useMappingEditor((s) => s.draft)
  const ortho = useMappingEditor((s) => s.ortho)
  const snapEnabled = useMappingEditor((s) => s.snapEnabled)
  const showGhostFloor = useMappingEditor((s) => s.showGhostFloor)
  const toggleGhostFloor = useMappingEditor((s) => s.toggleGhostFloor)
  const canUndo = useMappingEditor((s) => s.canUndo)
  const canRedo = useMappingEditor((s) => s.canRedo)

  const [mode, setMode] = useState<Mode>('draw')
  const [drawingBuilding, setDrawingBuilding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'building'; id: string; name: string }
    | { kind: 'floor'; buildingId: string; level: number; areas: number }
    | { kind: 'area'; id: string; name: string }
    | null
  >(null)

  const mappingQuery = useQuery({
    queryKey: ['mapping', facultyId],
    queryFn: () => fetchFacultyMapping(facultyId),
  })

  // Los pines se traen sin filtros y se recortan por facultad: el editor los
  // muestra para comprobar que las áreas cayeron donde debían.
  const pinsQuery = useQuery({
    queryKey: ['mapping-pins', facultyId],
    queryFn: () => fetchPins(null, { types: ['place', 'event', 'report'], categoryId: null, facultyId, onlyFavorites: false }),
  })

  const mapping = mappingQuery.data ?? { buildings: [], floors: [], areas: [] }
  const pins = useMemo(() => pinsQuery.data ?? [], [pinsQuery.data])

  const selectedBuilding = mapping.buildings.find((b) => b.id === selectedBuildingId) ?? null
  const selectedArea = mapping.areas.find((a) => a.id === selectedAreaId) ?? null

  const activePolygon: Polygon | null = draft
    ? draftPolygon(draft)
    : (selectedArea?.polygon ?? (selectedFloor === null ? (selectedBuilding?.footprint ?? null) : null))

  /**
   * Cuánto de la facultad está mapeado, para saber qué falta.
   *
   * Se suman las huellas de los edificios y las áreas exteriores contra la
   * superficie del perímetro. Es una SUMA, no una unión: si dos polígonos se
   * solapan, ese trozo cuenta dos veces y el porcentaje sale alto. Calcular la
   * unión real de polígonos arbitrarios es otro problema entero, y para "¿me
   * falta mucho?" la suma responde igual de bien. Por eso se recorta a 100 y se
   * presenta como aproximación.
   */
  const coverage = useMemo(() => {
    const faculty = FACULTIES.find((f) => f.id === facultyId)
    if (!faculty?.polygon) return null
    const total = polygonAreaM2(faculty.polygon)
    if (total <= 0) return null

    const mapped =
      mapping.buildings.reduce((acc, b) => acc + polygonAreaM2(b.footprint), 0) +
      mapping.areas
        .filter((a) => a.building_id === null)
        .reduce((acc, a) => acc + polygonAreaM2(a.polygon), 0)

    return { total, mapped, percent: Math.min(100, Math.round((mapped / total) * 100)) }
  }, [facultyId, mapping.buildings, mapping.areas])

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const area of mapping.areas) {
      const key = floorKey(area.building_id, area.floor)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [mapping.areas])

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['mapping', facultyId] })
  }, [queryClient, facultyId])

  /** Un solo sitio para traducir el fallo: el mensaje del servidor solo se
   *  muestra cuando fue escrito para una persona (SQLSTATE P0001). */
  const reportError = useCallback(
    (error: unknown, fallback: string) => {
      showToast(isUserFacingDbError(error) ? dbErrorMessage(error) : fallback)
      if (!isUserFacingDbError(error)) console.error(error)
    },
    [showToast],
  )

  /**
   * A qué edificio y planta pertenece un área recién trazada.
   *
   * En la vista por edificio ya está decidido. En la vista por planta no hay
   * edificio fijado, así que se deduce del propio trazado: el edificio cuya
   * huella contiene el centro del área, o exterior si no cae en ninguno. Es la
   * misma regla que asigna facultad a un pin, un nivel más abajo.
   */
  const resolveTargetFloor = useCallback(
    (polygon: Polygon): { buildingId: string | null; floor: number | null } => {
      const state = useMappingEditor.getState()
      if (state.viewMode === 'building') {
        return { buildingId: state.selectedBuildingId, floor: state.selectedFloor }
      }

      const centre = polygonCentroid(polygon)
      const match = smallestContaining(
        mapping.buildings.map((b) => ({ id: b.id, polygon: b.footprint })),
        centre[0],
        centre[1],
      )
      if (!match) return { buildingId: null, floor: null }

      // El edificio puede no tener esa planta (un edificio de 2 pisos cuando se
      // está viendo el 3). Sin la planta, la clave foránea compuesta lo
      // rechazaría, así que se trata como exterior y se avisa.
      const hasLevel = mapping.floors.some(
        (f) => f.building_id === match.id && f.level === state.activeLevel,
      )
      if (!hasLevel) {
        showToast(`Ese edificio no tiene ${floorName(state.activeLevel ?? 1, null)}. Se guarda como exterior.`)
        return { buildingId: null, floor: null }
      }
      return { buildingId: match.id, floor: state.activeLevel }
    },
    [mapping.buildings, mapping.floors, showToast],
  )

  // ── Mutaciones ──
  const saveArea = useMutation({
    mutationFn: async (values: AreaFormValues) => {
      const polygon = activePolygon
      if (!polygon) throw new Error('SIN_FORMA')
      // El tipo libre solo tiene sentido con kind 'other'; en el resto se
      // limpia, para que no quede un texto huérfano si se cambia de tipo.
      const customKind =
        values.kind === 'other' && values.customKind.trim() ? values.customKind.trim() : null

      if (selectedArea) {
        return updateArea(selectedArea.id, {
          name: values.name.trim(),
          kind: values.kind,
          custom_kind: customKind,
          color: values.color,
          polygon,
        })
      }

      // En la vista por planta no hay edificio fijado, así que se deduce del
      // punto: el edificio cuya huella contiene el área. Si no cae en ninguno,
      // es exterior.
      const target = resolveTargetFloor(polygon)

      return createArea({
        faculty_id: facultyId,
        building_id: target.buildingId,
        floor: target.floor,
        kind: values.kind,
        custom_kind: customKind,
        name: values.name.trim(),
        polygon,
        color: values.color,
      })
    },
    onSuccess: () => {
      showToast('Área guardada.')
      useMappingEditor.getState().resetHistory()
      useMappingEditor.getState().selectArea(null)
      invalidate()
    },
    onError: (error) => reportError(error, 'No se pudo guardar el área.'),
  })

  const saveBuilding = useMutation({
    mutationFn: async (values: BuildingFormValues) => {
      const polygon = activePolygon
      if (!polygon) throw new Error('SIN_FORMA')
      // 0 y vacío significan lo mismo —"no generes volumen, deja el de OSM"— y
      // la base solo admite null o un positivo (`buildings_height_m_check`).
      // Sin esta traducción, guardar el 0 que enseña el formulario reventaba
      // con un 23514 y el edificio no se guardaba.
      const typed = Number(values.height_m)
      const height = values.height_m.trim() === '' || !(typed > 0) ? null : typed
      return upsertBuilding({
        id: selectedBuilding?.id ?? slugify(facultyId, values.short_name || values.name),
        faculty_id: facultyId,
        name: values.name.trim(),
        short_name: values.short_name.trim() || null,
        aliases: values.aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        footprint: polygon,
        default_floor: selectedBuilding?.default_floor ?? 1,
        height_m: height,
        color: values.color.trim() || null,
      })
    },
    onSuccess: async (building) => {
      showToast('Edificio guardado.')
      setDrawingBuilding(false)
      useMappingEditor.getState().resetHistory()
      // Un edificio sin plantas no sirve para nada: se le crea la planta baja
      // en el acto para poder empezar a dibujar dentro.
      const hasFloors = mapping.floors.some((f) => f.building_id === building.id)
      if (!hasFloors) {
        try {
          await addFloor(building.id, 1, null)
        } catch (error) {
          reportError(error, 'El edificio se guardó, pero no se pudo crear su planta baja.')
        }
      }
      invalidate()
    },
    onError: (error) => reportError(error, 'No se pudo guardar el edificio.'),
  })

  const splitArea = useMutation({
    mutationFn: async (parts: number) => {
      const polygon = activePolygon
      if (!polygon) throw new Error('SIN_FORMA')
      const slices = splitQuadIntoN(polygon, parts)
      if (slices.length < 2) throw new Error('NO_DIVISIBLE')
      const target = resolveTargetFloor(polygon)
      return createAreas(
        slices.map((slice, index) => ({
          faculty_id: facultyId,
          building_id: target.buildingId,
          floor: target.floor,
          kind: 'other' as const,
          custom_kind: null,
          name: `Área ${index + 1}`,
          polygon: slice,
          color: null,
          sort_order: index,
        })),
      )
    },
    onSuccess: (created) => {
      showToast(`${created.length} áreas creadas. Renómbralas una a una.`)
      useMappingEditor.getState().resetHistory()
      invalidate()
    },
    onError: (error) => reportError(error, 'No se pudo dividir la forma.'),
  })

  /** Copia todas las áreas de la planta activa a otra. */
  const copyFloor = useMutation({
    mutationFn: async (target: number) => {
      if (!selectedBuildingId || selectedFloor === null) throw new Error('SIN_PLANTA')
      const source = mapping.areas.filter(
        (a) => a.building_id === selectedBuildingId && a.floor === selectedFloor,
      )
      if (source.length === 0) throw new Error('PLANTA_VACIA')
      return createAreas(
        source.map((area) => ({
          faculty_id: area.faculty_id,
          building_id: area.building_id,
          floor: target,
          kind: area.kind,
          custom_kind: area.custom_kind,
          name: area.name,
          polygon: area.polygon,
          color: area.color,
          sort_order: area.sort_order,
        })),
      )
    },
    onSuccess: (created) => {
      showToast(`${created.length} áreas copiadas. Ajusta las que cambien.`)
      invalidate()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : ''
      if (message === 'PLANTA_VACIA') return showToast('Esta planta no tiene áreas que copiar.')
      reportError(error, 'No se pudo copiar la planta.')
    },
  })

  const floorMutation = useMutation({
    mutationFn: ({ buildingId, level }: { buildingId: string; level: number }) =>
      addFloor(buildingId, level, null),
    onSuccess: () => invalidate(),
    onError: (error) => reportError(error, 'No se pudo agregar la planta.'),
  })

  const removeMutation = useMutation({
    mutationFn: async (target: NonNullable<typeof confirmDelete>) => {
      if (target.kind === 'building') return deleteBuilding(target.id)
      if (target.kind === 'floor') return deleteFloor(target.buildingId, target.level)
      return deleteArea(target.id)
    },
    onSuccess: (_data, target) => {
      showToast(
        target.kind === 'building'
          ? 'Edificio eliminado.'
          : target.kind === 'floor'
            ? 'Planta eliminada.'
            : 'Área eliminada.',
      )
      setConfirmDelete(null)
      useMappingEditor.getState().resetHistory()
      if (target.kind === 'building') useMappingEditor.getState().selectOutdoor()
      else useMappingEditor.getState().selectArea(null)
      invalidate()
    },
    onError: (error) => reportError(error, 'No se pudo eliminar.'),
  })

  // ── Atajos de teclado ──
  useEffect(() => {
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

    const onKeyDown = (e: KeyboardEvent) => {
      const state = useMappingEditor.getState()
      if (e.key === 'Shift') state.setOrtho(true)
      if (e.key === 'Alt') {
        // El navegador usa Alt para enfocar la barra de menús; sin esto, la
        // primera pulsación saca el foco del lienzo.
        e.preventDefault()
        state.setSnapEnabled(false)
      }
      if (isTyping(e.target)) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) state.redo()
        else state.undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        state.redo()
        return
      }
      if (e.ctrlKey || e.metaKey) return

      const shortcut: Record<string, Tool> = { v: 'select', r: 'rect', p: 'polygon', t: 'trace' }
      const next = shortcut[e.key.toLowerCase()]
      if (next) {
        state.setTool(next)
        return
      }
      // Enter cierra el polígono en curso. Es el atajo del botón "Cerrar forma"
      // de la barra flotante; acertarle al primer vértice sigue funcionando,
      // pero ya no es la única salida.
      if (e.key === 'Enter') {
        const current = state.draft
        if (current?.kind === 'ring' && current.phase === 'drawing' && current.ring.length >= 3) {
          e.preventDefault()
          state.commitDraft({ kind: 'ring', ring: current.ring, phase: 'ready' })
        }
        return
      }
      if (e.key === 'Escape') {
        state.resetHistory()
        state.selectArea(null)
        setDrawingBuilding(false)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const state = useMappingEditor.getState()
      if (e.key === 'Shift') state.setOrtho(false)
      if (e.key === 'Alt') state.setSnapEnabled(true)
    }

    // Soltar la ventana con Shift pulsado dejaba el modo ortogonal encendido
    // para siempre, sin forma de apagarlo salvo volver a pulsarlo y soltarlo.
    const onBlur = () => {
      const state = useMappingEditor.getState()
      state.setOrtho(false)
      state.setSnapEnabled(true)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const handleExport = () => {
    downloadExport(buildExport(mapping))
    showToast('Exportado. Reemplaza los archivos en src/shared/data/ para versionarlos.')
  }

  const floorsOfBuilding = mapping.floors
    .filter((f) => f.building_id === selectedBuildingId)
    .map((f) => f.level)
    .sort((a, b) => a - b)

  return (
    <>
      {/* El editor es de ratón y teclado: imanes de un metro, arrastre de
          vértices y atajos. En una pantalla de teléfono no es que se vea
          apretado, es que no se puede trabajar. Mejor decirlo que dejar que se
          descubra a base de intentarlo. */}
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center lg:hidden">
        <Monitor size={32} className="text-neutral-300 dark:text-neutral-600" />
        <p className="text-sm font-black text-neutral-700 dark:text-neutral-200">
          El editor de mapeo necesita un computador
        </p>
        <p className="max-w-xs text-xs leading-snug text-neutral-400">
          Trazar áreas se hace con ratón y teclado. Abre esta página desde un
          computador para dibujar edificios, plantas y áreas.
        </p>
        <Link
          to="/admin"
          className="mt-2 rounded-xl bg-neutral-100 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
        >
          Volver al panel
        </Link>
      </div>

      <div className="hidden h-full w-full flex-col overflow-hidden lg:flex">
      {/* ── Barra de herramientas unificada y centrada ── */}
      <div className="relative flex min-h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-900">
        {/* Sección izquierda: Selección de Facultad y Modo */}
        <div className="flex items-center gap-3">
          <div className="w-64 shrink-0">
            <CustomSelect
              options={FACULTIES.map((f) => ({ value: f.id, label: f.name }))}
              value={facultyId}
              onChange={setFacultyId}
              placeholder="Facultad"
            />
          </div>

          <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
            <ModeButton active={mode === 'draw'} onClick={() => setMode('draw')}>
              Trazar
            </ModeButton>
            <ModeButton active={mode === 'pins'} onClick={() => setMode('pins')}>
              Pines
            </ModeButton>
          </div>
        </div>

        {/* Sección central: Herramientas de dibujo (Centrado absoluto) */}
        {mode === 'draw' && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl bg-neutral-100/90 p-1 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/60 shadow-xs">
            {TOOLS.map(({ tool: id, icon: Icon, label, key }) => (
              <ToolButton
                key={id}
                active={tool === id}
                onClick={() => setTool(id)}
                title={`${label} (${key})`}
              >
                <Icon size={15} />
              </ToolButton>
            ))}

            <div className="mx-1 h-4 w-px shrink-0 bg-neutral-300 dark:bg-neutral-700" />

            <ToolButton
              active={ortho}
              onClick={() => useMappingEditor.getState().setOrtho(!ortho)}
              title="Modo ortogonal: aristas a 90°/45° de la veta del edificio (Shift)"
            >
              <Grid3x3 size={15} />
            </ToolButton>
            <ToolButton
              active={snapEnabled}
              onClick={() => useMappingEditor.getState().setSnapEnabled(!snapEnabled)}
              title="Imanes a vértices y aristas cercanas (Alt para desactivar)"
            >
              <Magnet size={15} />
            </ToolButton>
            <ToolButton
              active={showGhostFloor}
              onClick={toggleGhostFloor}
              title="Calco: dibuja en línea de puntos las áreas de la planta de abajo, para copiar su forma sin volver a medirla"
            >
              <Layers size={15} />
            </ToolButton>

            <div className="mx-1 h-4 w-px shrink-0 bg-neutral-300 dark:bg-neutral-700" />

            <ToolButton
              active={false}
              disabled={!canUndo}
              onClick={() => useMappingEditor.getState().undo()}
              title="Deshacer (Ctrl+Z)"
            >
              <Undo2 size={15} />
            </ToolButton>
            <ToolButton
              active={false}
              disabled={!canRedo}
              onClick={() => useMappingEditor.getState().redo()}
              title="Rehacer (Ctrl+Y)"
            >
              <Redo2 size={15} />
            </ToolButton>

            {selectedFloor !== null && floorsOfBuilding.length > 1 && (
              <>
                <div className="mx-1 h-4 w-px shrink-0 bg-neutral-300 dark:bg-neutral-700" />
                <CopyFloorMenu
                  levels={floorsOfBuilding.filter((l) => l !== selectedFloor)}
                  onCopy={(target) => copyFloor.mutate(target)}
                />
              </>
            )}
          </div>
        )}

        {/* Sección derecha: cobertura + Exportar */}
        <div className="flex items-center gap-2">
          {coverage && (
            <div
              className="hidden shrink-0 items-center gap-2 rounded-xl bg-neutral-50 px-3 py-1.5 lg:flex dark:bg-neutral-800/60"
              title={`${formatArea(coverage.mapped)} mapeados de ${formatArea(coverage.total)} del perímetro. Es una suma, así que los solapes cuentan doble.`}
            >
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${coverage.percent}%` }}
                />
              </div>
              <span className="text-[10px] font-black tabular-nums text-neutral-500 dark:text-neutral-400">
                {coverage.percent}% mapeado
              </span>
            </div>
          )}

          <button
            onClick={handleExport}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-neutral-100 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            title="Descarga buildings.ts y areas.ts para versionarlos en git"
          >
            <Download size={13} /> Exportar
          </button>
        </div>
      </div>

      {/* ── Tres paneles ── */}
      <div className="flex min-h-0 flex-1">
        {mode === 'pins' ? (
          <PinFloorPanel mapping={mapping} pins={pins} onSaved={() => void pinsQuery.refetch()} />
        ) : (
          <>
            <aside className="w-56 shrink-0 border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              {mappingQuery.isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner />
                </div>
              ) : (
                <MappingTree
                  buildings={mapping.buildings}
                  floors={mapping.floors}
                  areaCounts={areaCounts}
                  outdoorCount={areaCounts.get(floorKey(null, null)) ?? 0}
                  onAddBuilding={() => {
                    useMappingEditor.getState().selectBuilding(null)
                    useMappingEditor.getState().setTool('rect')
                    setDrawingBuilding(true)
                  }}
                  onAddFloor={(buildingId, level) => floorMutation.mutate({ buildingId, level })}
                  onRemoveFloor={(buildingId, level) =>
                    setConfirmDelete({
                      kind: 'floor',
                      buildingId,
                      level,
                      areas: areaCounts.get(floorKey(buildingId, level)) ?? 0,
                    })
                  }
                />
              )}
            </aside>

            <main className="relative min-w-0 flex-1">
              {mappingQuery.isError ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-sm font-bold text-[#D41F2D]">No se pudo cargar el mapeo.</p>
                  <button
                    onClick={() => void mappingQuery.refetch()}
                    className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-bold dark:bg-neutral-800"
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                <MappingCanvas mapping={mapping} pins={pins} onDraftReady={() => {}} />
              )}
            </main>

            <aside className="flex w-72 shrink-0 flex-col border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <MappingProperties
                areas={mapping.areas}
                selectedArea={selectedArea}
                selectedBuilding={selectedBuilding}
                activePolygon={activePolygon}
                drawingBuilding={drawingBuilding}
                onSaveArea={(values) => saveArea.mutate(values)}
                onSaveBuilding={(values) => saveBuilding.mutate(values)}
                onDeleteArea={(id) =>
                  setConfirmDelete({
                    kind: 'area',
                    id,
                    name: mapping.areas.find((a) => a.id === id)?.name ?? 'esta área',
                  })
                }
                onDeleteBuilding={(id) =>
                  setConfirmDelete({
                    kind: 'building',
                    id,
                    name: mapping.buildings.find((b) => b.id === id)?.name ?? 'este edificio',
                  })
                }
                onSplit={(parts) => splitArea.mutate(parts)}
                onCancel={() => {
                  useMappingEditor.getState().resetHistory()
                  useMappingEditor.getState().selectArea(null)
                  setDrawingBuilding(false)
                }}
                saving={saveArea.isPending || saveBuilding.isPending || splitArea.isPending}
              />
            </aside>
          </>
        )}
      </div>

        <ConfirmDialog
          open={confirmDelete !== null}
          onOpenChange={(open) => !open && setConfirmDelete(null)}
          title={
            confirmDelete?.kind === 'building'
              ? 'Eliminar edificio'
              : confirmDelete?.kind === 'floor'
                ? 'Eliminar planta'
                : 'Eliminar área'
          }
          // El borrado en cascada se dice ANTES, con el número exacto: enterarse
          // después de que se fueron doce áreas no tiene arreglo.
          description={
            confirmDelete?.kind === 'building'
              ? `Se eliminarán "${confirmDelete.name}", todas sus plantas y todas las áreas que haya dentro.`
              : confirmDelete?.kind === 'floor'
                ? `Se eliminará ${floorName(confirmDelete.level, null)}${
                    confirmDelete.areas > 0
                      ? ` y las ${confirmDelete.areas} áreas que tiene dentro`
                      : ''
                  }.`
                : `Se eliminará "${confirmDelete?.name}".`
          }
          confirmText="Eliminar"
          onConfirm={() => confirmDelete && removeMutation.mutate(confirmDelete)}
        />
      </div>
    </>
  )
}

/** id estable y legible a partir del código o el nombre. */
function slugify(facultyId: string, source: string): string {
  const slug = source
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${facultyId}-${slug || Date.now().toString(36)}`
}

function ToolButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? 'bg-[#D41F2D] text-white'
          : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
      }`}
    >
      {children}
    </button>
  )
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1 text-[11px] font-black uppercase tracking-wider transition-colors ${
        active
          ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
          : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
      }`}
    >
      {children}
    </button>
  )
}

function CopyFloorMenu({ levels, onCopy }: { levels: number[]; onCopy: (level: number) => void }) {
  const [open, setOpen] = useState(false)
  if (levels.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        title="Copiar todas las áreas de esta planta a otra"
        className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        <Copy size={14} /> Copiar planta
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 flex w-40 flex-col gap-0.5 rounded-xl border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
            <p className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-neutral-400">
              Copiar a
            </p>
            {levels.map((level) => (
              <button
                key={level}
                onClick={() => {
                  onCopy(level)
                  setOpen(false)
                }}
                className="rounded-lg px-2 py-1.5 text-left text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                {floorName(level, null)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
