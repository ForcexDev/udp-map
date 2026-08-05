import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Info, Ruler, Scissors, Trash2, X } from 'lucide-react'
import type { Polygon } from 'geojson'
import type { Area, AreaKind, Building } from '@/shared/types/database'
import { FACULTIES } from '@/shared/data/campusData'
import { formatArea, polygonAreaM2 } from '@/shared/utils/geometry'
import { draftVertices, useMappingEditor } from './editorStore'
import { AREA_STYLES, BUILDING_COLOR, INDOOR_KINDS, OUTDOOR_KINDS, floorName } from './areaStyles'
import { hasErrors, issuesFor, validateArea, validateBuilding, type ValidationIssue } from './validation'

// ─────────────────────────────────────────────────────────────────────────────
// Panel derecho: el formulario de lo que esté seleccionado o dibujándose.
//
// Los mensajes de validación van SIEMPRE junto al campo, nunca como toast: son
// correcciones en curso, y un aviso que se desvanece a los tres segundos no
// sirve para corregir nada.
// ─────────────────────────────────────────────────────────────────────────────

/** Superficie del polígono en curso; un guion mientras no haya forma. */
function formatAreaSafe(polygon: Polygon | null): string {
  return polygon ? formatArea(polygonAreaM2(polygon)) : '—'
}

const LABEL = 'text-[10px] font-black uppercase tracking-wider text-neutral-400'
const INPUT =
  'w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 outline-none transition-colors focus:border-[#D41F2D] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white'

export interface AreaFormValues {
  name: string
  kind: AreaKind
  /** Nombre del tipo cuando `kind` es 'other'. La lista cerrada se queda corta. */
  customKind: string
  color: string | null
}

export interface BuildingFormValues {
  name: string
  short_name: string
  aliases: string
  height_m: string
  color: string
}

interface MappingPropertiesProps {
  areas: Area[]
  selectedArea: Area | null
  selectedBuilding: Building | null
  /** Polígono en curso, o el del elemento seleccionado si no se está dibujando. */
  activePolygon: Polygon | null
  /** true cuando lo que se dibuja es la huella de un edificio, no un área. */
  drawingBuilding: boolean
  onSaveArea: (values: AreaFormValues) => void
  onSaveBuilding: (values: BuildingFormValues) => void
  onDeleteArea: (areaId: string) => void
  onDeleteBuilding: (buildingId: string) => void
  onSplit: (parts: number) => void
  onCancel: () => void
  saving: boolean
}

export function MappingProperties({
  areas,
  selectedArea,
  selectedBuilding,
  activePolygon,
  drawingBuilding,
  onSaveArea,
  onSaveBuilding,
  onDeleteArea,
  onDeleteBuilding,
  onSplit,
  onCancel,
  saving,
}: MappingPropertiesProps) {
  const facultyId = useMappingEditor((s) => s.facultyId)
  const selectedBuildingId = useMappingEditor((s) => s.selectedBuildingId)
  const selectedFloor = useMappingEditor((s) => s.selectedFloor)
  const draft = useMappingEditor((s) => s.draft)

  const outdoor = selectedBuildingId === null
  const kinds = outdoor ? OUTDOOR_KINDS : INDOOR_KINDS

  const [areaForm, setAreaForm] = useState<AreaFormValues>({
    name: '',
    kind: outdoor ? 'courtyard' : 'other',
    customKind: '',
    color: null,
  })
  const [buildingForm, setBuildingForm] = useState<BuildingFormValues>({
    name: '',
    short_name: '',
    aliases: '',
    height_m: '',
    color: '',
  })
  const [splitCount, setSplitCount] = useState(2)

  // El formulario sigue a la selección: al elegir otra área hay que ver SUS
  // datos, no los de la anterior a medio editar.
  useEffect(() => {
    if (selectedArea) {
      setAreaForm({
        name: selectedArea.name,
        kind: selectedArea.kind,
        customKind: selectedArea.custom_kind ?? '',
        color: selectedArea.color,
      })
    } else if (draft) {
      setAreaForm((prev) => ({ ...prev, name: '' }))
    }
  }, [selectedArea, draft])

  useEffect(() => {
    if (!selectedBuilding) return
    setBuildingForm({
      name: selectedBuilding.name,
      short_name: selectedBuilding.short_name ?? '',
      aliases: selectedBuilding.aliases.join(', '),
      // Sin altura asignada se enseña un 0, no un vacío: 0 es la respuesta
      // ("no generes volumen"), y un campo en blanco parece un dato que falta.
      height_m: selectedBuilding.height_m === null ? '0' : String(selectedBuilding.height_m),
      color: selectedBuilding.color ?? '',
    })
  }, [selectedBuilding])

  const faculty = FACULTIES.find((f) => f.id === facultyId)

  const areaIssues = useMemo<ValidationIssue[]>(() => {
    if (drawingBuilding || (!draft && !selectedArea)) return []
    return validateArea(areaForm.name, activePolygon, {
      container: outdoor ? (faculty?.polygon ?? null) : (selectedBuilding?.footprint ?? null),
      containerLabel: outdoor ? 'el perímetro de la facultad' : 'la huella del edificio',
      siblings: areas
        .filter((a) => a.building_id === selectedBuildingId && a.floor === selectedFloor)
        .map((a) => ({ id: a.id, name: a.name, polygon: a.polygon })),
      editingAreaId: selectedArea?.id ?? null,
    })
  }, [
    areaForm.name,
    activePolygon,
    areas,
    drawingBuilding,
    draft,
    faculty,
    outdoor,
    selectedArea,
    selectedBuilding,
    selectedBuildingId,
    selectedFloor,
  ])

  const buildingIssues = useMemo<ValidationIssue[]>(() => {
    if (!drawingBuilding && !selectedBuilding) return []
    return validateBuilding(buildingForm.name, activePolygon, {
      perimeter: faculty?.polygon ?? null,
    })
  }, [buildingForm, activePolygon, drawingBuilding, faculty, selectedBuilding])

  const vertices = draft ? draftVertices(draft).length : activePolygon ? activePolygon.coordinates[0].length - 1 : 0
  const canSplit = Boolean(draft && vertices === 4)

  // ── Edificio ──
  if (drawingBuilding || (selectedBuilding && selectedFloor === null && !draft)) {
    return (
      <Panel
        title={drawingBuilding ? 'Edificio nuevo' : 'Edificio'}
        polygon={activePolygon}
        vertices={vertices}
      >
        <Field label="Nombre" issues={issuesFor(buildingIssues, 'name')}>
          <input
            className={INPUT}
            value={buildingForm.name}
            onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
            placeholder="Edificio Ejército 441"
          />
        </Field>

        {/* Sin campo de código: el código es de la SALA, no del edificio. Un
            mismo edificio hospeda salas con esquemas distintos (E441.1.S101 y
            SMV-03), hay edificios con una sola sala con código, y hay salas de
            estudio sin ninguno. Cada sala guarda el suyo, opcional, en su pin. */}
        <Field label="Nombre corto" hint="Opcional, para el árbol y las etiquetas">
          <input
            className={INPUT}
            value={buildingForm.short_name}
            onChange={(e) => setBuildingForm({ ...buildingForm, short_name: e.target.value })}
            placeholder="E441"
          />
        </Field>

        <Field label="Alias" hint="Cómo lo llama la gente, separado por comas">
          <input
            className={INPUT}
            value={buildingForm.aliases}
            onChange={(e) => setBuildingForm({ ...buildingForm, aliases: e.target.value })}
            placeholder="edificio del KAEA, astronomía"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          {/* En 0 el edificio NO se genera, y es lo que se quiere casi siempre:
              el campus ya está en OpenStreetMap con sus alturas y el mapa lo
              levanta solo. Poner metros aquí dibuja un volumen propio encima,
              así que solo se rellena para los edificios que le falten a OSM. */}
          <Field label="Altura 3D (m)" hint="0 = usa el edificio de OpenStreetMap">
            <input
              className={INPUT}
              type="number"
              min="0"
              value={buildingForm.height_m}
              onChange={(e) => setBuildingForm({ ...buildingForm, height_m: e.target.value })}
              placeholder="0"
            />
          </Field>
          <Field label="Color" hint="Vacío = rojo UDP">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-7 w-10 cursor-pointer rounded border border-neutral-200 bg-transparent dark:border-neutral-700"
                value={buildingForm.color || BUILDING_COLOR}
                onChange={(e) => setBuildingForm({ ...buildingForm, color: e.target.value })}
              />
              {buildingForm.color && (
                <button
                  onClick={() => setBuildingForm({ ...buildingForm, color: '' })}
                  className="text-[10px] font-bold text-neutral-400 hover:text-[#D41F2D]"
                >
                  Quitar
                </button>
              )}
            </div>
          </Field>
        </div>

        <Issues issues={issuesFor(buildingIssues, 'shape')} />

        <Actions
          onSave={() => onSaveBuilding(buildingForm)}
          onCancel={onCancel}
          disabled={hasErrors(buildingIssues) || saving}
          saving={saving}
          onDelete={selectedBuilding ? () => onDeleteBuilding(selectedBuilding.id) : undefined}
          deleteLabel="Eliminar edificio y todas sus plantas"
        />
      </Panel>
    )
  }

  // ── Nada seleccionado y nada dibujándose ──
  if (!draft && !selectedArea) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <Info size={20} className="text-neutral-300" />
        <p className="text-xs font-bold text-neutral-500">
          {selectedFloor === null && selectedBuildingId === null
            ? 'Trazando el exterior de la facultad'
            : selectedFloor === null
              ? 'Elige una planta en el árbol'
              : 'Nada seleccionado'}
        </p>
        <p className="max-w-[200px] text-[11px] leading-snug text-neutral-400">
          Elige una herramienta y dibuja en el mapa, o haz clic en un área para editarla.
        </p>
      </div>
    )
  }

  // ── Área ──
  return (
    <Panel
      title={selectedArea ? 'Área' : 'Área nueva'}
      polygon={activePolygon}
      vertices={vertices}
    >
      <Field label="Nombre" issues={issuesFor(areaIssues, 'name')}>
        <input
          className={INPUT}
          value={areaForm.name}
          onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
          placeholder={outdoor ? 'Patio central' : 'Hall central'}
          autoFocus
        />
      </Field>

      <Field label="Tipo">
        <div className="flex flex-wrap gap-1">
          {kinds.map((kind) => (
            <button
              key={kind}
              onClick={() => setAreaForm({ ...areaForm, kind })}
              className={`rounded-full px-2 py-1 text-[10px] font-bold transition-colors ${
                areaForm.kind === kind
                  ? 'text-white'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
              }`}
              style={areaForm.kind === kind ? { background: AREA_STYLES[kind].color } : undefined}
            >
              {AREA_STYLES[kind].label}
            </button>
          ))}
        </div>
      </Field>

      {/* La lista de tipos siempre se queda corta en un edificio real: aparece
          una bodega, un auditorio, una sala de máquinas. "Otro" deja escribirlo
          en vez de dejar el área etiquetada como "algo". */}
      {areaForm.kind === 'other' && (
        <Field label="Nombre del tipo" hint="Bodega, auditorio, sala de máquinas…">
          <input
            className={INPUT}
            value={areaForm.customKind}
            onChange={(e) => setAreaForm({ ...areaForm, customKind: e.target.value })}
            placeholder="Escribe el tipo"
            maxLength={40}
          />
        </Field>
      )}

      <Field label="Color" hint="Vacío = el color del tipo">
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="h-7 w-10 cursor-pointer rounded border border-neutral-200 bg-transparent dark:border-neutral-700"
            value={areaForm.color ?? AREA_STYLES[areaForm.kind].color}
            onChange={(e) => setAreaForm({ ...areaForm, color: e.target.value })}
          />
          {areaForm.color && (
            <button
              onClick={() => setAreaForm({ ...areaForm, color: null })}
              className="text-[10px] font-bold text-neutral-400 hover:text-[#D41F2D]"
            >
              Usar el del tipo
            </button>
          )}
        </div>
      </Field>

      {canSplit && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 dark:border-blue-900/50 dark:bg-blue-950/30">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
            <Scissors size={11} /> Dividir en franjas
          </div>
          <p className="mb-2 text-[10px] leading-snug text-blue-800/70 dark:text-blue-200/70">
            Parte este rectángulo por su eje mayor. Un pasillo de salas iguales se dibuja una vez.
          </p>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="2"
              max="30"
              value={splitCount}
              onChange={(e) => setSplitCount(Math.max(2, Math.min(30, Number(e.target.value) || 2)))}
              className={`${INPUT} w-16`}
            />
            <button
              onClick={() => onSplit(splitCount)}
              className="flex-1 rounded-lg bg-blue-600 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-blue-700"
            >
              Dividir
            </button>
          </div>
        </div>
      )}

      <Issues issues={issuesFor(areaIssues, 'shape')} />

      <Actions
        onSave={() => onSaveArea(areaForm)}
        onCancel={onCancel}
        disabled={hasErrors(areaIssues) || saving}
        saving={saving}
        onDelete={selectedArea ? () => onDeleteArea(selectedArea.id) : undefined}
        deleteLabel="Eliminar área"
      />
    </Panel>
  )
}

function Panel({
  title,
  polygon,
  vertices,
  children,
}: {
  title: string
  polygon: Polygon | null
  vertices: number
  children: React.ReactNode
}) {
  const selectedFloor = useMappingEditor((s) => s.selectedFloor)
  const selectedBuildingId = useMappingEditor((s) => s.selectedBuildingId)

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div>
        <h2 className="text-sm font-black tracking-tight text-neutral-900 dark:text-white">{title}</h2>
        <p className="text-[10px] font-medium text-neutral-400">
          {selectedBuildingId === null
            ? 'Exterior'
            : selectedFloor === null
              ? 'Huella del edificio'
              : floorName(selectedFloor, null)}
        </p>
      </div>

      {/* Lectura en vivo: si una sala da 600 m² en vez de 60, se ve mientras se
          dibuja y no tres semanas después. */}
      <div className="flex items-center gap-3 rounded-lg bg-neutral-50 px-2.5 py-1.5 dark:bg-neutral-800/60">
        <Ruler size={12} className="text-neutral-400" />
        <span className="font-mono text-xs font-bold text-neutral-700 dark:text-neutral-200">
          {formatAreaSafe(polygon)}
        </span>
        <span className="ml-auto text-[10px] text-neutral-400">{vertices} vértices</span>
      </div>

      {children}
    </div>
  )
}

function Field({
  label,
  hint,
  issues = [],
  children,
}: {
  label: string
  hint?: string
  issues?: ValidationIssue[]
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={LABEL}>{label}</label>
      {children}
      {hint && <p className="text-[10px] leading-tight text-neutral-400">{hint}</p>}
      <Issues issues={issues} />
    </div>
  )
}

function Issues({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      {issues.map((issue, i) => (
        <p
          key={i}
          className={`flex items-start gap-1 text-[10px] font-medium leading-tight ${
            issue.level === 'error' ? 'text-[#D41F2D]' : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          <AlertTriangle size={11} className="mt-px shrink-0" />
          {issue.message}
        </p>
      ))}
    </div>
  )
}

function Actions({
  onSave,
  onCancel,
  onDelete,
  deleteLabel,
  disabled,
  saving,
}: {
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  deleteLabel?: string
  disabled: boolean
  saving: boolean
}) {
  return (
    <div className="mt-auto flex flex-col gap-2 pt-2">
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex items-center justify-center rounded-lg bg-neutral-100 px-3 py-2 text-neutral-500 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          title="Cancelar"
        >
          <X size={14} />
        </button>
        <button
          onClick={onSave}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#D41F2D] px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:bg-[#b01a25] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check size={13} /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold text-neutral-400 transition-colors hover:bg-red-50 hover:text-[#D41F2D] dark:hover:bg-red-950/40"
        >
          <Trash2 size={11} /> {deleteLabel}
        </button>
      )}
    </div>
  )
}
