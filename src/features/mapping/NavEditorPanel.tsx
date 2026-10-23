import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Feature, FeatureCollection } from 'geojson'
import { CircleDot, DoorOpen, Link2, Route, ShieldCheck, Spline, Trash2, TriangleAlert, Trees } from 'lucide-react'
import type { NavEdgeRow, NavNodeKind, NavNodeRow, Pin } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { dbErrorMessage } from '@/shared/utils/dbError'
import { openRing } from '@/shared/utils/geometry'
import { planCorridor, projectOnAxis } from '@/shared/utils/indoor/corridor'
import { areasToLocal, graphFromRows } from '@/shared/utils/indoor/load'
import {
  dist,
  levelIndex,
  projectionAround,
} from '@/shared/utils/indoor/projection'
import type { Vec2 } from '@/shared/utils/indoor/types'
import { validateNavGraph, type NavIssue } from '@/shared/utils/indoor/validate'
import {
  createNavEdges,
  createNavNodes,
  deleteNavEdges,
  deleteNavNodes,
  fetchNavGraph,
  updateNavNode,
  type FacultyMapping,
  type NavEdgeInput,
  type NavNodeInput,
} from './api'
import { activeFloorOf, useMappingEditor } from './editorStore'
import { areaAt, dedupeEdges, OPEN_KINDS, snapToWall } from './navEdit'
import { EMPTY_OVERLAY, useNavEditor, type NavClick, type NavMode } from './navEditorStore'

// ─────────────────────────────────────────────────────────────────────────────
// Herramienta "Navegación": el grafo de "cómo llegar", planta a planta.
//
// Quien mapea marca puertas sobre el borde de las áreas y dibuja el eje del
// pasillo; el pasillo, sus nodos y las salas detrás de cada puerta se generan
// (`shared/utils/indoor/corridor.ts`). Los núcleos se marcan una vez por planta
// con su `shaft`, y "Unir plantas" crea las aristas verticales.
//
// La validación se recalcula con cada cambio. El cliente decide qué se dibuja;
// la RLS (`has_capability('mapping')`) decide qué se guarda.
// ─────────────────────────────────────────────────────────────────────────────

/** Puertas que el pasillo recoge: las que quedan a esta distancia del eje. */
const CORRIDOR_REACH_M = 5
const CORE_LINK_M = 4
const ENTRANCE_LINK_M = 8

const MODES: { mode: NavMode; label: string; icon: typeof Route; hint: string }[] = [
  { mode: 'select', label: 'Elegir', icon: CircleDot, hint: 'Clic en un nodo para ver y editar sus datos.' },
  { mode: 'door', label: 'Puerta', icon: DoorOpen, hint: 'Clic sobre el borde de un área: la puerta se ajusta al borde.' },
  {
    mode: 'corridor',
    label: 'Pasillo',
    icon: Spline,
    hint: 'Clic a lo largo del eje del pasillo; doble clic o "Generar" lo cierra y une las puertas cercanas.',
  },
  { mode: 'stairs', label: 'Escalera', icon: Route, hint: 'Clic en el descanso de la escalera, dentro de su hueco.' },
  { mode: 'elevator', label: 'Ascensor', icon: Route, hint: 'Clic dentro de la cabina del ascensor.' },
  { mode: 'entrance', label: 'Entrada', icon: DoorOpen, hint: 'Clic en la puerta de fachada; se une al nodo interior más cercano.' },
  { mode: 'outdoor', label: 'Exterior', icon: Trees, hint: 'Clic en un punto exterior (vereda, patio). Únelo luego a la entrada.' },
  { mode: 'link', label: 'Unir', icon: Link2, hint: 'Clic en dos nodos para unirlos con un tramo a pie.' },
]

const KIND_COLOR: Record<NavNodeKind, string> = {
  walk: '#64748b',
  door: '#f59e0b',
  room: '#2563eb',
  stairs: '#c22b38',
  elevator: '#7c3aed',
  entrance: '#16a34a',
  outdoor: '#0d9488',
}

const ISSUE_TEXT: Record<NavIssue['code'], string> = {
  'isolated-node': 'Nodo sin ninguna arista',
  'no-entrance': 'No hay ninguna entrada: no se puede llegar desde la calle',
  'room-without-node': 'Sala con código sin nodo en el grafo',
  'room-unreachable': 'Sala inalcanzable desde las entradas',
  'room-unreachable-step-free': 'Sala inalcanzable sin escaleras',
  'shaft-gap': 'Núcleo que salta plantas',
  'shaft-unlinked': 'Núcleo sin unir entre plantas (usa "Unir plantas")',
  'door-off-wall': 'Puerta lejos del borde de su área',
}

interface NavEditorPanelProps {
  mapping: FacultyMapping
  pins: Pin[]
}

export function NavEditorPanel({ mapping, pins }: NavEditorPanelProps) {
  const queryClient = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)
  const facultyId = useMappingEditor((s) => s.facultyId)
  const viewMode = useMappingEditor((s) => s.viewMode)
  const activeLevel = useMappingEditor((s) => s.activeLevel)
  const selectedBuildingId = useMappingEditor((s) => s.selectedBuildingId)
  const selectedFloor = useMappingEditor((s) => s.selectedFloor)
  const floor = activeFloorOf({ viewMode, activeLevel, selectedBuildingId, selectedFloor })
  const buildingId = floor.crossBuilding ? null : floor.buildingId
  const level = floor.level

  const mode = useNavEditor((s) => s.mode)
  const setMode = useNavEditor((s) => s.setMode)
  const axis = useNavEditor((s) => s.axis)
  const selectedNodeId = useNavEditor((s) => s.selectedNodeId)
  const linkFrom = useNavEditor((s) => s.linkFrom)

  const [doorWidth, setDoorWidth] = useState(1)
  const [shaft, setShaft] = useState('')
  const [label, setLabel] = useState('')
  const [stepFree, setStepFree] = useState(true)

  const navQuery = useQuery({
    queryKey: ['navGraph', facultyId],
    queryFn: () => fetchNavGraph(facultyId),
    retry: 1,
  })
  const rows = navQuery.data

  // El plano se centra en el edificio elegido: ahí se trabaja en metros.
  const plane = useMemo(() => {
    const building = mapping.buildings.find((b) => b.id === buildingId)
    const points = building
      ? openRing(building.footprint.coordinates[0] ?? []).map(([lng, lat]) => ({ lng, lat }))
      : (rows?.nodes ?? []).map((n) => ({ lng: n.lng, lat: n.lat }))
    return projectionAround(points.length > 0 ? points : [{ lng: -70.66, lat: -33.45 }])
  }, [mapping.buildings, buildingId, rows])

  const facultyAreas = useMemo(() => mapping.areas.filter((a) => a.faculty_id === facultyId), [mapping.areas, facultyId])
  const localAreas = useMemo(() => areasToLocal(facultyAreas, plane), [facultyAreas, plane])
  const graph = useMemo(
    () => (rows ? graphFromRows(rows.nodes, rows.edges, { plane, areas: facultyAreas }).graph : null),
    [rows, plane, facultyAreas],
  )
  const floorAreas = useMemo(
    () => localAreas.filter((a) => a.buildingId === buildingId && a.floor === level),
    [localAreas, buildingId, level],
  )
  const onFloor = (n: NavNodeRow) =>
    (n.building_id === null && n.floor === null) || (n.building_id === buildingId && n.floor === level)

  const issues = useMemo(() => {
    if (!graph) return []
    const roomCodes = pins
      .filter((p) => p.faculty_id === facultyId && p.room_code && p.building_id)
      .map((p) => p.room_code as string)
    return validateNavGraph({ graph, areas: localAreas, roomCodes })
  }, [graph, localAreas, pins, facultyId])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['navGraph', facultyId] })
  const fail = (error: unknown) => showToast(dbErrorMessage(error) || 'No se pudo guardar el grafo.')

  const write = useMutation({
    mutationFn: async (change: { nodes?: NavNodeInput[]; edges?: NavEdgeInput[] }) => {
      // Nodos primero: las aristas los referencian.
      await createNavNodes(change.nodes ?? [])
      await createNavEdges(dedupeEdges(change.edges ?? [], rows?.edges ?? []))
    },
    onSuccess: () => void refresh(),
    onError: fail,
  })

  const remove = useMutation({
    mutationFn: async (change: { nodes?: string[]; edges?: string[] }) => {
      await deleteNavEdges(change.edges ?? [])
      await deleteNavNodes(change.nodes ?? [])
    },
    onSuccess: () => {
      useNavEditor.getState().selectNode(null)
      void refresh()
    },
    onError: fail,
  })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<NavNodeInput> }) => updateNavNode(id, patch),
    onSuccess: () => void refresh(),
    onError: fail,
  })

  const nodeInput = (kind: NavNodeKind, p: Vec2, extra: Partial<NavNodeInput> = {}): NavNodeInput => {
    const [lng, lat] = plane.toLngLat(p)
    const outdoor = kind === 'outdoor'
    return {
      id: crypto.randomUUID(),
      faculty_id: facultyId,
      building_id: outdoor ? null : buildingId,
      floor: outdoor ? null : level,
      kind,
      lng,
      lat,
      landmark: null,
      via: null,
      area_id: null,
      room_code: null,
      shaft: null,
      width_m: null,
      ...extra,
    }
  }
  const edgeInput = (a: string, b: string, kind: NavEdgeInput['kind'] = 'walk', free = true): NavEdgeInput => ({
    id: crypto.randomUUID(),
    faculty_id: facultyId,
    a,
    b,
    kind,
    step_free: kind === 'stairs' ? false : free,
  })

  const nearest = (p: Vec2, kinds: NavNodeKind[], maxM: number): string | null => {
    if (!graph) return null
    let best: string | null = null
    let bestD = maxM
    for (const node of graph.nodes.values()) {
      if (!kinds.includes(node.kind) || node.buildingId !== buildingId || node.floor !== level) continue
      const d = dist(node.p, p)
      if (d < bestD) {
        bestD = d
        best = node.id
      }
    }
    return best
  }

  const generateCorridor = () => {
    if (!graph || axis.length < 2) return
    const local = axis.map(([lng, lat]) => plane.toLocal(lng, lat))
    // Las puertas de esta planta cerca del eje que todavía no cuelgan de nada.
    const doors = [...graph.nodes.values()].filter((n) => {
      if (n.kind !== 'door' || n.buildingId !== buildingId || n.floor !== level) return false
      const hosted = graph.neighbors(n.id).some(({ to }) => {
        const kind = graph.node(to).kind
        return kind === 'walk' || kind === 'entrance' || kind === 'outdoor'
      })
      const projected = projectOnAxis(local, n.p)
      return !hosted && projected !== null && projected.distance <= CORRIDOR_REACH_M
    })
    const plan = planCorridor(
      local,
      doors.map((d) => ({ id: d.id, p: d.p, room: needsRoom(d.id) })),
      'w',
    )
    const ids = new Map<string, string>()
    const nodes: NavNodeInput[] = []
    for (const w of plan.walk) {
      const node = nodeInput('walk', w.p, { area_id: areaAt(floorAreas, w.p)?.id ?? null })
      ids.set(w.key, node.id!)
      nodes.push(node)
    }
    for (const room of plan.rooms) {
      const door = graph.node(room.door)
      const code = door.areaId
        ? (pins.find((p) => p.area_id === door.areaId && p.room_code)?.room_code ?? null)
        : null
      const node = nodeInput('room', room.p, { area_id: door.areaId, room_code: code })
      ids.set(room.key, node.id!)
      nodes.push(node)
    }
    const edges = plan.edges.map((e) => edgeInput(ids.get(e.a) ?? e.a, ids.get(e.b) ?? e.b))
    write.mutate({ nodes, edges })
    useNavEditor.getState().setAxis([])
    showToast(`Pasillo: ${plan.walk.length} nodos, ${doors.length} puertas unidas, ${plan.rooms.length} salas.`)
  }

  /** La puerta abre a una sala cerrada que aún no tiene su nodo. */
  const needsRoom = (doorId: string): boolean => {
    if (!graph) return false
    const door = graph.node(doorId)
    if (!door.areaId || graph.roomBehind(doorId)) return false
    const area = localAreas.find((a) => a.id === door.areaId)
    if (!area || OPEN_KINDS.has(area.kind)) return false
    return ![...graph.nodes.values()].some((n) => n.kind === 'room' && n.areaId === door.areaId)
  }

  const linkFloors = () => {
    if (!graph || !buildingId) return
    const groups = new Map<string, { id: string; floor: number; kind: 'stairs' | 'elevator' }[]>()
    for (const node of graph.nodes.values()) {
      if ((node.kind !== 'stairs' && node.kind !== 'elevator') || node.buildingId !== buildingId || !node.shaft) continue
      const key = `${node.kind}|${node.shaft}`
      groups.set(key, [...(groups.get(key) ?? []), { id: node.id, floor: node.floor ?? 1, kind: node.kind }])
    }
    const edges: NavEdgeInput[] = []
    for (const group of groups.values()) {
      group.sort((a, b) => levelIndex(a.floor) - levelIndex(b.floor))
      for (let i = 1; i < group.length; i++) {
        if (graph.edgeBetween(group[i - 1].id, group[i].id)) continue
        edges.push(edgeInput(group[i - 1].id, group[i].id, group[i].kind, group[i].kind === 'elevator'))
      }
    }
    if (edges.length === 0) {
      showToast('Los núcleos ya estaban unidos.')
      return
    }
    write.mutate({ edges })
    showToast(`${edges.length} tramos verticales creados.`)
  }

  // ── Clics del lienzo ──
  useEffect(() => {
    const onClick = ({ lng, lat, nodeId }: NavClick) => {
      const editor = useNavEditor.getState()
      const p = plane.toLocal(lng, lat)
      if (editor.mode === 'select') {
        editor.selectNode(nodeId)
        return
      }
      if (editor.mode === 'link') {
        if (!nodeId) return
        if (!editor.linkFrom) {
          editor.setLinkFrom(nodeId)
          return
        }
        if (editor.linkFrom !== nodeId) write.mutate({ edges: [edgeInput(editor.linkFrom, nodeId, 'walk', stepFree)] })
        editor.setLinkFrom(null)
        return
      }
      if (editor.mode === 'corridor') {
        editor.setAxis([...editor.axis, [lng, lat]])
        return
      }
      if (editor.mode === 'outdoor') {
        write.mutate({ nodes: [nodeInput('outdoor', p, { landmark: label || null })] })
        return
      }
      if (!buildingId || level === null) {
        showToast('Elige un edificio y una planta en el árbol.')
        return
      }
      if (editor.mode === 'door') {
        const snap = snapToWall(floorAreas, p)
        if (!snap) {
          showToast('Haz clic sobre el borde de un área.')
          return
        }
        write.mutate({
          nodes: [nodeInput('door', snap.p, { area_id: snap.areaId, width_m: doorWidth, landmark: label || null })],
        })
        return
      }
      if (editor.mode === 'stairs' || editor.mode === 'elevator') {
        const isStairs = editor.mode === 'stairs'
        const node = nodeInput(editor.mode, p, {
          shaft: shaft || (isStairs ? 'ESC' : 'ASC'),
          landmark: label || (isStairs ? 'la escalera' : 'el ascensor'),
        })
        const door = nearest(p, ['door'], CORE_LINK_M)
        write.mutate({ nodes: [node], edges: door ? [edgeInput(node.id!, door)] : [] })
        return
      }
      if (editor.mode === 'entrance') {
        const node = nodeInput('entrance', p, { landmark: label || null, width_m: doorWidth })
        const inside = nearest(p, ['walk'], ENTRANCE_LINK_M)
        write.mutate({ nodes: [node], edges: inside ? [edgeInput(node.id!, inside, 'walk', stepFree)] : [] })
      }
    }
    useNavEditor.getState().setHandlers(onClick, generateCorridor)
    return () => useNavEditor.getState().setHandlers(null, null)
  })

  // ── Lo que pinta el lienzo ──
  useEffect(() => {
    if (!rows) {
      useNavEditor.getState().setOverlay(EMPTY_OVERLAY)
      return
    }
    const visible = new Map(rows.nodes.filter(onFloor).map((n) => [n.id, n]))
    const features: Feature[] = []
    for (const e of rows.edges) {
      const a = visible.get(e.a)
      const b = visible.get(e.b)
      if (!a || !b) continue
      features.push({
        type: 'Feature',
        properties: { part: 'edge', color: e.step_free ? '#64748b' : '#c22b38' },
        geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
      })
    }
    for (const n of visible.values()) {
      features.push({
        type: 'Feature',
        properties: {
          part: 'node',
          id: n.id,
          color: KIND_COLOR[n.kind],
          selected: n.id === selectedNodeId || n.id === linkFrom ? 1 : 0,
        },
        geometry: { type: 'Point', coordinates: [n.lng, n.lat] },
      })
    }
    if (axis.length > 0) {
      features.push({
        type: 'Feature',
        properties: { part: 'axis', color: '#2563eb' },
        geometry: axis.length > 1 ? { type: 'LineString', coordinates: axis } : { type: 'Point', coordinates: axis[0] },
      })
    }
    const overlay: FeatureCollection = { type: 'FeatureCollection', features }
    useNavEditor.getState().setOverlay(overlay)
    // `onFloor` depende de edificio y planta, que ya están en la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, buildingId, level, axis, selectedNodeId, linkFrom])

  useEffect(() => () => useNavEditor.getState().setOverlay(EMPTY_OVERLAY), [])

  const selected = selectedNodeId ? rows?.nodes.find((n) => n.id === selectedNodeId) : undefined
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const hint = MODES.find((m) => m.mode === mode)?.hint

  if (navQuery.isError) {
    return (
      <div className="p-4 text-xs text-neutral-500">
        No se pudo cargar el grafo de navegación. Si la migración 20261023000000 no está aplicada en este
        entorno, aplícala en el SQL Editor de Supabase.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4 text-xs">
      <div>
        <h3 className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Navegación</h3>
        <p className="mt-1 text-neutral-500">
          {buildingId && level !== null
            ? `Planta ${level} de ${mapping.buildings.find((b) => b.id === buildingId)?.name ?? buildingId}`
            : 'Elige un edificio y una planta en el árbol (los puntos exteriores se ven en todas).'}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {MODES.map(({ mode: id, label: text, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-bold transition-colors ${
              mode === id
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'
            }`}
          >
            <Icon size={13} />
            {text}
          </button>
        ))}
      </div>
      {hint && <p className="text-neutral-500">{hint}</p>}

      {(mode === 'door' || mode === 'entrance') && (
        <label className="flex items-center justify-between gap-2">
          <span className="text-neutral-600 dark:text-neutral-300">Ancho del vano (m)</span>
          <input
            type="number"
            min={0.5}
            max={10}
            step={0.1}
            value={doorWidth}
            onChange={(e) => setDoorWidth(Number(e.target.value) || 1)}
            className="w-20 rounded-lg border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800"
          />
        </label>
      )}
      {(mode === 'stairs' || mode === 'elevator') && (
        <TextField label="Núcleo (shaft)" value={shaft} onChange={setShaft} placeholder={mode === 'stairs' ? 'ESC' : 'ASC'} />
      )}
      {(mode === 'door' || mode === 'stairs' || mode === 'elevator' || mode === 'entrance' || mode === 'outdoor') && (
        <TextField label="Lo que se ve (landmark)" value={label} onChange={setLabel} placeholder="la puerta principal" />
      )}
      {(mode === 'link' || mode === 'entrance') && (
        <label className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
          <input type="checkbox" checked={stepFree} onChange={(e) => setStepFree(e.target.checked)} />
          Apto sin escalones
        </label>
      )}
      {mode === 'corridor' && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={axis.length < 2}
            onClick={generateCorridor}
            className="flex-1 rounded-lg bg-[#D41F2D] px-3 py-1.5 font-bold text-white disabled:opacity-40"
          >
            Generar pasillo ({axis.length} puntos)
          </button>
          <button
            type="button"
            onClick={() => useNavEditor.getState().setAxis([])}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 font-bold dark:bg-neutral-800"
          >
            Borrar
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={linkFloors}
        disabled={!buildingId}
        className="rounded-lg bg-neutral-100 px-3 py-1.5 font-bold text-neutral-700 hover:bg-neutral-200 disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-200"
        title="Crea las aristas de escalera y ascensor entre plantas consecutivas del mismo núcleo"
      >
        Unir plantas
      </button>

      {selected && (
        <NodeForm
          key={selected.id}
          node={selected}
          edges={(rows?.edges ?? []).filter((e) => e.a === selected.id || e.b === selected.id)}
          onSave={(patch) => update.mutate({ id: selected.id, patch })}
          onDelete={() => remove.mutate({ nodes: [selected.id] })}
          onDeleteEdge={(id) => remove.mutate({ edges: [id] })}
        />
      )}

      <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <div className="flex items-center gap-1.5 font-bold">
          {errors.length === 0 && warnings.length === 0 ? (
            <>
              <ShieldCheck size={14} className="text-green-600" /> Grafo en verde
            </>
          ) : (
            <>
              <TriangleAlert size={14} className={errors.length > 0 ? 'text-[#D41F2D]' : 'text-amber-500'} />
              {errors.length} errores · {warnings.length} avisos
            </>
          )}
        </div>
        <ul className="mt-2 flex flex-col gap-1">
          {issues.slice(0, 40).map((issue, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => issue.nodeIds[0] && focusNode(issue.nodeIds[0], rows?.nodes ?? [])}
                className="w-full rounded-lg px-2 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className={issue.severity === 'error' ? 'text-[#D41F2D]' : 'text-amber-600'}>●</span>{' '}
                {ISSUE_TEXT[issue.code]}
                {issue.detail ? ` · ${issue.detail}` : ''}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Lleva el árbol a la planta del nodo y lo deja elegido. */
function focusNode(id: string, nodes: NavNodeRow[]) {
  const node = nodes.find((n) => n.id === id)
  if (!node) return
  if (node.building_id && node.floor !== null) useMappingEditor.getState().selectFloor(node.building_id, node.floor)
  useMappingEditor.getState().setTool('nav')
  useNavEditor.getState().setMode('select')
  useNavEditor.getState().selectNode(id)
}

function NodeForm({
  node,
  edges,
  onSave,
  onDelete,
  onDeleteEdge,
}: {
  node: NavNodeRow
  edges: NavEdgeRow[]
  onSave: (patch: Partial<NavNodeInput>) => void
  onDelete: () => void
  onDeleteEdge: (id: string) => void
}) {
  const [landmark, setLandmark] = useState(node.landmark ?? '')
  const [roomCode, setRoomCode] = useState(node.room_code ?? '')
  const [via, setVia] = useState(node.via ?? '')
  const [shaft, setShaft] = useState(node.shaft ?? '')
  const [width, setWidth] = useState(node.width_m === null ? '' : String(node.width_m))
  const vertical = node.kind === 'stairs' || node.kind === 'elevator'

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
      <div className="font-bold">Nodo: {node.kind}</div>
      <TextField label="Lo que se ve (landmark)" value={landmark} onChange={setLandmark} />
      {(node.kind === 'room' || node.kind === 'door') && (
        <TextField label="Código de sala" value={roomCode} onChange={setRoomCode} placeholder="V432.4.S413" />
      )}
      {node.kind === 'outdoor' && <TextField label="Por dónde (vía)" value={via} onChange={setVia} />}
      {vertical && <TextField label="Núcleo (shaft)" value={shaft} onChange={setShaft} />}
      {(node.kind === 'door' || node.kind === 'entrance') && (
        <TextField label="Ancho (m)" value={width} onChange={setWidth} />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            onSave({
              landmark: landmark.trim() || null,
              room_code: roomCode.trim() || null,
              via: via.trim() || null,
              ...(vertical ? { shaft: shaft.trim() || node.shaft } : {}),
              width_m: width.trim() ? Number(width) : null,
            })
          }
          className="flex-1 rounded-lg bg-neutral-900 px-3 py-1.5 font-bold text-white dark:bg-white dark:text-neutral-900"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Borra el nodo y sus aristas"
          className="rounded-lg bg-[#D41F2D]/10 px-3 py-1.5 font-bold text-[#D41F2D]"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {edges.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {edges.map((e) => (
            <li key={e.id} className="flex items-center justify-between text-neutral-500">
              <span>
                {e.kind}
                {e.step_free ? '' : ' · con escalones'}
              </span>
              <button type="button" onClick={() => onDeleteEdge(e.id)} className="text-[#D41F2D]" title="Quitar tramo">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-neutral-600 dark:text-neutral-300">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800"
      />
    </label>
  )
}
