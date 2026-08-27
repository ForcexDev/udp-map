import { useEffect, useRef, useState } from 'react'
import { Box, Check, Square, X } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, Polygon, Position } from 'geojson'
import type { Area, Building, Pin } from '@/shared/types/database'
import { facultyPerimeter, useFaculties } from '@/shared/data/facultyStore'
import { MAP_STYLE_LIGHT } from '@/features/map/mapConfig'
import { useUIStore } from '@/shared/stores/uiStore'
import {
  grainAngle,
  openRing,
  polygonFromRing,
  rectangleDims,
  snapToPolygons,
  orthogonalSnap,
} from '@/shared/utils/geometry'
import { AREA_STYLES, BUILDING_COLOR, buildingHeightM } from './areaStyles'
import {
  activeFloorOf,
  draftPolygon,
  draftVertices,
  useMappingEditor,
  type Draft,
} from './editorStore'
import type { FacultyMapping } from './api'

// ─────────────────────────────────────────────────────────────────────────────
// El lienzo del editor.
//
// Usa el MISMO MapLibre, el mismo estilo y los mismos perímetros que el mapa
// real. Esa es la garantía de alineación: se dibuja exactamente donde después
// se ve, sin pasar por ninguna herramienta externa ni por otra proyección.
//
// Todo el pintado del borrador es IMPERATIVO (setData sobre las fuentes) y no
// por estado de React. Mover el ratón repinta el borrador decenas de veces por
// segundo; hacerlo con setState re-renderizaría el árbol completo en cada
// píxel.
// ─────────────────────────────────────────────────────────────────────────────

const SNAP_TOLERANCE_M = 1

interface MappingCanvasProps {
  mapping: FacultyMapping
  pins: Pin[]
  /** Se llama al terminar de trazar una forma nueva. */
  onDraftReady: () => void
  /** Se llama al clicar con la herramienta de sala activa, con el punto elegido. */
  onRoomPlaced: (lngLat: { lng: number; lat: number }) => void
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

function areaFeature(area: Area): Feature<Polygon> {
  return {
    type: 'Feature',
    id: area.id,
    properties: {
      id: area.id,
      name: area.name,
      color: area.color ?? AREA_STYLES[area.kind].color,
      opacity: AREA_STYLES[area.kind].opacity,
    },
    geometry: area.polygon,
  }
}

function buildingFeature(building: Building, height: number): Feature<Polygon> {
  return {
    type: 'Feature',
    id: building.id,
    properties: {
      id: building.id,
      name: building.name,
      color: building.color ?? BUILDING_COLOR,
      height,
    },
    geometry: building.footprint,
  }
}

export function MappingCanvas({ mapping, pins, onDraftReady, onRoomPlaced }: MappingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const vertexMarkersRef = useRef<maplibregl.Marker[]>([])
  const rotationMarkerRef = useRef<maplibregl.Marker | null>(null)
  const readyRef = useRef(false)
  // Inclinada o cenital. Se sincroniza con el mapa y no solo con el botón,
  // porque la brújula de MapLibre también inclina arrastrándola.
  const [pitched, setPitched] = useState(false)

  const faculties = useFaculties()
  const facultyId = useMappingEditor((s) => s.facultyId)
  const facultyEdit = useMappingEditor((s) => s.facultyEdit)
  const selectedBuildingId = useMappingEditor((s) => s.selectedBuildingId)
  const selectedFloor = useMappingEditor((s) => s.selectedFloor)
  const selectedAreaId = useMappingEditor((s) => s.selectedAreaId)
  const draft = useMappingEditor((s) => s.draft)
  const previewHeightM = useMappingEditor((s) => s.previewHeightM)
  const tool = useMappingEditor((s) => s.tool)
  const showGhostFloor = useMappingEditor((s) => s.showGhostFloor)
  const viewMode = useMappingEditor((s) => s.viewMode)
  const activeLevel = useMappingEditor((s) => s.activeLevel)

  // Los datos vivos se leen desde los manejadores, que se registran una sola
  // vez. Sin este ref verían el `mapping` del primer render para siempre.
  const dataRef = useRef({ mapping, pins })
  dataRef.current = { mapping, pins }
  const onDraftReadyRef = useRef(onDraftReady)
  onDraftReadyRef.current = onDraftReady
  const onRoomPlacedRef = useRef(onRoomPlaced)
  onRoomPlacedRef.current = onRoomPlaced

  // ── Polígonos de referencia para los imanes ──
  // Perímetro de la facultad, huellas de edificios y áreas de la planta activa
  // (menos la que se está editando, que si no se pegaría a sí misma).
  const snapReferences = (): Polygon[] => {
    const { mapping: data } = dataRef.current
    const state = useMappingEditor.getState()
    // El perímetro no entra como referencia cuando es lo que se está
    // retrazando: cada vértice nuevo se pegaría al trazo viejo, que es
    // exactamente el que se quiere corregir.
    const outline = state.facultyEdit ? null : facultyPerimeter(state.facultyId)
    const refs: Polygon[] = outline ? [outline] : []

    const active = activeFloorOf(state)
    for (const building of data.buildings) refs.push(building.footprint)
    for (const area of data.areas) {
      // Un área no se pega a sí misma: si no, arrastrar un vértice lo clavaría
      // en el sitio del que se está intentando mover.
      if (area.id === state.selectedAreaId) continue
      if (!active.crossBuilding && area.building_id !== active.buildingId) continue
      if (area.floor !== active.level && area.building_id !== null) continue
      refs.push(area.polygon)
    }
    return refs
  }

  /** Aplica imán y modo ortogonal a un punto del cursor, en ese orden. */
  const resolvePoint = (lngLat: maplibregl.LngLat, previous?: Position): Position => {
    const state = useMappingEditor.getState()
    let point: Position = [lngLat.lng, lngLat.lat]

    if (state.snapEnabled) {
      const snap = snapToPolygons(point, snapReferences(), SNAP_TOLERANCE_M)
      // El imán manda sobre el modo ortogonal: si hay una esquina real ahí, es
      // lo que la persona quiere, aunque rompa el ángulo recto.
      if (snap) return snap.position
    }

    if (state.ortho && previous) {
      const ring = state.draft?.kind === 'ring' ? state.draft.ring : []
      point = orthogonalSnap(previous, point, grainAngle(ring))
    }
    return point
  }

  // ── Instancia del mapa ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const faculty = faculties.find((f) => f.id === useMappingEditor.getState().facultyId)
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_LIGHT,
      center: [faculty?.lng ?? -70.661, faculty?.lat ?? -33.4527],
      zoom: 18,
      // Arranca cenital y mirando al norte, que es como se traza. Pero girar e
      // inclinar SÍ se permiten: de frente no se distingue si un área quedó
      // pegada a la fachada correcta ni qué edificio tapa a cuál, y revisar eso
      // es la mitad del trabajo. El trazado no sufre porque unproject() ya
      // tiene en cuenta el ángulo de la cámara: el clic cae donde se ve, esté
      // el mapa girado o no.
      pitch: 0,
      bearing: 0,
      maxPitch: 70,
      attributionControl: false,
      // Al dibujar, un doble clic cierra el polígono. Si además hiciera zoom,
      // el trazo terminaría en otro sitio del que se ve.
      doubleClickZoom: false,
    })
    // La brújula de MapLibre gira arrastrándola y vuelve al norte al pulsarla,
    // que es el gesto descubrible. `visualizePitch` le añade la inclinación.
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      'top-right',
    )

    map.on('pitchend', () => setPitched(map.getPitch() > 5))

    map.on('load', () => {
      for (const id of ['faculty', 'buildings', 'ghost', 'areas', 'draft'] as const) {
        map.addSource(id, { type: 'geojson', data: EMPTY })
      }
      map.addSource('pins', { type: 'geojson', data: EMPTY })
      map.addSource('draft-vertices', { type: 'geojson', data: EMPTY })

      // El editor tiene que enseñar EXACTAMENTE lo mismo que el mapa público:
      // si aquí el perímetro va relleno y allí no, se dibuja contra una
      // referencia que después no existe. Perímetro sin relleno y huellas con
      // la misma opacidad que `mappingLayers.ts`; lo único que el editor añade
      // es el resalte de lo seleccionado, que sí es suyo.
      map.addLayer({
        id: 'faculty-fill',
        type: 'fill',
        source: 'faculty',
        paint: { 'fill-color': BUILDING_COLOR, 'fill-opacity': 0 },
      })
      map.addLayer({
        id: 'faculty-line',
        type: 'line',
        source: 'faculty',
        paint: { 'line-color': BUILDING_COLOR, 'line-width': 2, 'line-opacity': 0.85 },
      })

      map.addLayer({
        id: 'buildings-fill',
        type: 'fill',
        source: 'buildings',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['get', 'selected'], 0.35, 0.2],
        },
      })
      map.addLayer({
        id: 'buildings-line',
        type: 'line',
        source: 'buildings',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['get', 'selected'], 2.5, 1.2],
          'line-opacity': ['case', ['get', 'selected'], 1, 0.8],
        },
      })
      // El volumen 3D que se va a generar, con la MISMA regla que el mapa
      // público (`buildingHeightM`): solo se levanta lo que tiene altura
      // asignada, porque el resto ya lo levanta OpenStreetMap y duplicarlo
      // dibujaría dos veces el mismo edificio.
      //
      // Se previsualiza aquí porque la altura era el único dato del editor que
      // no se podía comprobar sin guardar, ir al mapa y volver.
      map.addLayer({
        id: 'buildings-3d',
        type: 'fill-extrusion',
        source: 'buildings',
        filter: ['>', ['get', 'height'], 0],
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 1,
          'fill-extrusion-vertical-gradient': false,
          // Suaviza el tirón al escribir la altura dígito a dígito: sin esto,
          // pasar de 4 a 40 es un salto seco que cuesta leer.
          'fill-extrusion-height-transition': { duration: 180, delay: 0 },
        },
      })

      map.addLayer({
        id: 'buildings-label',
        type: 'symbol',
        source: 'buildings',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-font': ['Noto Sans Bold'],
        },
        paint: { 'text-color': '#7f1d1d', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      })

      // Planta inferior, para calcar.
      map.addLayer({
        id: 'ghost-line',
        type: 'line',
        source: 'ghost',
        paint: { 'line-color': '#71717a', 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': 0.7 },
      })

      map.addLayer({
        id: 'areas-fill',
        type: 'fill',
        source: 'areas',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['get', 'selected'], 0.55, ['get', 'opacity']],
        },
      })
      map.addLayer({
        id: 'areas-line',
        type: 'line',
        source: 'areas',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['get', 'selected'], 2.5, 1],
        },
      })
      map.addLayer({
        id: 'areas-label',
        type: 'symbol',
        source: 'areas',
        layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['Noto Sans Regular'] },
        paint: { 'text-color': '#27272a', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      })

      // Los pines de la planta activa: sirven para comprobar que las áreas
      // quedaron donde debían y para detectar pines mal ubicados.
      map.addLayer({
        id: 'pins-circle',
        type: 'circle',
        source: 'pins',
        paint: {
          'circle-radius': 5,
          'circle-color': '#18181b',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.85,
        },
      })

      map.addLayer({
        id: 'draft-fill',
        type: 'fill',
        source: 'draft',
        paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.25 },
      })
      map.addLayer({
        id: 'draft-line',
        type: 'line',
        source: 'draft',
        paint: { 'line-color': '#2563eb', 'line-width': 2 },
      })
      // Y el mismo volumen para el edificio que todavía no se ha guardado. Sin
      // esto la vista previa solo servía para corregir alturas ya puestas, no
      // para elegir la primera, que es justo cuando hace falta.
      // La altura va por PAINT y no como propiedad del feature: la fuente del
      // borrador se reescribe en cada movimiento del ratón y en cada vértice
      // arrastrado, y meter ahí un dato del formulario obligaría a pasarlo por
      // los cuatro sitios que la escriben.
      map.addLayer({
        id: 'draft-3d',
        type: 'fill-extrusion',
        source: 'draft',
        paint: {
          'fill-extrusion-color': '#2563eb',
          'fill-extrusion-height': 0,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.55,
          'fill-extrusion-vertical-gradient': false,
          'fill-extrusion-height-transition': { duration: 180, delay: 0 },
        },
      })

      map.addLayer({
        id: 'draft-vertex',
        type: 'circle',
        source: 'draft-vertices',
        paint: {
          'circle-radius': 4,
          'circle-color': '#fff',
          'circle-stroke-color': '#2563eb',
          'circle-stroke-width': 2,
        },
      })

      readyRef.current = true
      redrawAll()
    })

    // ── Clic: selecciona o construye el borrador según la herramienta ──
    map.on('click', (e) => {
      const state = useMappingEditor.getState()

      if (state.tool === 'select') {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['areas-fill'] })
        if (hits.length > 0) {
          state.selectArea(String(hits[0].properties?.id))
          return
        }
        const buildingHits = map.queryRenderedFeatures(e.point, { layers: ['buildings-fill'] })
        if (buildingHits.length > 0) state.selectBuilding(String(buildingHits[0].properties?.id))
        return
      }

      if (state.tool === 'trace') {
        traceBuildingAt(e.point)
        return
      }

      // Colocar la sala del importador. No pasa por `resolvePoint`: los imanes
      // son para que dos polígonos casen borde con borde, y una sala se pone en
      // el centro de su recinto, no pegada a una pared.
      if (state.tool === 'room') {
        if (state.pendingRoom) onRoomPlacedRef.current(e.lngLat)
        return
      }

      if (state.tool === 'rect') {
        const current = state.draft
        if (!current || current.kind !== 'rect' || current.phase === 'ready') {
          const anchor = resolvePoint(e.lngLat)
          state.commitDraft({
            kind: 'rect',
            anchor,
            widthM: 0,
            heightM: 0,
            rotationRad: 0,
            phase: 'sizing',
          })
        } else {
          state.commitDraft({ ...current, phase: 'ready' })
          onDraftReadyRef.current()
        }
        return
      }

      if (state.tool === 'polygon') {
        const current = state.draft
        const ring = current?.kind === 'ring' ? current.ring : []

        // Clic sobre el primer vértice = cerrar el polígono.
        if (ring.length >= 3) {
          const firstPixel = map.project(ring[0] as [number, number])
          if (Math.hypot(firstPixel.x - e.point.x, firstPixel.y - e.point.y) < 12) {
            state.commitDraft({ kind: 'ring', ring, phase: 'ready' })
            onDraftReadyRef.current()
            return
          }
        }

        const point = resolvePoint(e.lngLat, ring[ring.length - 1])
        state.commitDraft({ kind: 'ring', ring: [...ring, point], phase: 'drawing' })
      }
    })

    // Doble clic cierra el polígono sin tener que apuntar al primer vértice.
    map.on('dblclick', () => {
      const state = useMappingEditor.getState()
      if (state.tool !== 'polygon') return
      const current = state.draft
      if (current?.kind !== 'ring' || current.ring.length < 3) return
      state.commitDraft({ kind: 'ring', ring: current.ring, phase: 'ready' })
      onDraftReadyRef.current()
    })

    // ── Movimiento: previsualización, sin pasar por React ──
    map.on('mousemove', (e) => {
      const state = useMappingEditor.getState()
      const current = state.draft
      if (!current) {
        map.getCanvas().style.cursor = state.tool === 'select' ? '' : 'crosshair'
        return
      }

      if (current.kind === 'rect' && current.phase === 'sizing') {
        const cursor = resolvePoint(e.lngLat)
        const dims = rectangleDims(current.anchor, cursor, current.rotationRad)
        // setDraft y no commitDraft: cada píxel del arrastre no es un paso del
        // historial, o "deshacer" retrocedería un milímetro cada vez.
        state.setDraft({ ...current, ...dims })
        return
      }

      if (current.kind === 'ring' && current.phase === 'drawing' && current.ring.length > 0) {
        const preview = resolvePoint(e.lngLat, current.ring[current.ring.length - 1])
        drawDraftPreview([...current.ring, preview])
      }
    })

    /** Calca la huella de un edificio de OpenStreetMap bajo el cursor. */
    function traceBuildingAt(point: maplibregl.Point) {
      const extrusion = map.getStyle().layers?.find((l) => l.type === 'fill-extrusion')
      if (!extrusion) {
        useUIStore.getState().showToast('El estilo del mapa no trae edificios que calcar.')
        return
      }
      const hits = map.queryRenderedFeatures(point, { layers: [extrusion.id] })
      const geometry = hits[0]?.geometry
      if (!geometry || geometry.type !== 'Polygon') {
        useUIStore.getState().showToast('No hay ningún edificio de OpenStreetMap en ese punto.')
        return
      }

      useMappingEditor.getState().commitDraft({
        kind: 'ring',
        ring: openRing(geometry.coordinates[0] as Position[]),
        phase: 'ready',
      })
      // Las teselas vectoriales llegan recortadas al borde del tile, así que un
      // edificio que cruza ese borde se calca partido. Es limitación del
      // formato, no un fallo: por eso se avisa en vez de fingir precisión.
      useUIStore.getState().showToast(
        'Huella calcada de OpenStreetMap. Revisa el contorno: si el edificio cruza el borde de una tesela, puede llegar recortado.',
      )
      onDraftReadyRef.current()
    }

    mapRef.current = map
    return () => {
      readyRef.current = false
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Pinta un anillo en curso sin tocar el estado de React. */
  function drawDraftPreview(ring: Position[]) {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const source = map.getSource('draft') as maplibregl.GeoJSONSource | undefined
    const vertices = map.getSource('draft-vertices') as maplibregl.GeoJSONSource | undefined
    if (!source || !vertices) return

    source.setData(
      ring.length >= 3
        ? { type: 'Feature', properties: {}, geometry: polygonFromRing(ring) }
        : {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: ring },
          },
    )
    vertices.setData({
      type: 'FeatureCollection',
      features: ring.map((p) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Point' as const, coordinates: p },
      })),
    })
  }

  function redrawAll() {
    const map = mapRef.current
    if (!map || !readyRef.current) return

    const state = useMappingEditor.getState()
    const { mapping: data, pins: allPins } = dataRef.current
    // Solo el perímetro TRAZADO. Pintar el cuadrado aproximado de una facultad
    // sin trazo daría por dibujado algo que no lo está, y encima serviría de
    // imán para pegarle los edificios.
    const outline = state.facultyEdit === 'new' ? null : facultyPerimeter(state.facultyId)

    const setData = (id: string, value: FeatureCollection | Feature) => {
      const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined
      source?.setData(value)
    }

    setData('faculty', {
      type: 'FeatureCollection',
      features: outline ? [{ type: 'Feature', properties: {}, geometry: outline }] : [],
    })

    setData('buildings', {
      type: 'FeatureCollection',
      features: data.buildings.map((b) => {
        // El edificio en edición se levanta con lo que hay en el CAMPO, no con
        // lo guardado: es lo que convierte el número en algo que se puede
        // juzgar de un vistazo. Y mientras se retraza su huella baja a 0, que
        // el volumen lo lleva el borrador — si no, se verían los dos, el viejo
        // y el nuevo, uno dentro del otro.
        const selected = b.id === state.selectedBuildingId
        const height = selected
          ? state.draft !== null
            ? 0
            : (state.previewHeightM ?? buildingHeightM(b))
          : buildingHeightM(b)
        const feature = buildingFeature(b, height)
        feature.properties = { ...feature.properties, selected }
        return feature
      }),
    })

    const active = activeFloorOf(state)

    // En la vista por planta el filtro es SOLO el nivel, así que el piso 1 de
    // todos los edificios se ve junto, y el exterior con él: es la planta baja
    // completa de la facultad, que es como se recorre en la vida real.
    const onActiveFloor = (area: Area) =>
      active.crossBuilding
        ? area.floor === active.level || area.building_id === null
        : area.building_id === active.buildingId && area.floor === active.level

    setData('areas', {
      type: 'FeatureCollection',
      features: data.areas.filter(onActiveFloor).map((a) => {
        const feature = areaFeature(a)
        feature.properties = { ...feature.properties, selected: a.id === state.selectedAreaId }
        return feature
      }),
    })

    // Fantasma: la planta inmediatamente inferior a la activa, en línea de
    // puntos. Sirve para calcar — las plantas de un edificio se parecen entre
    // sí, y tener debajo el contorno del piso de abajo ahorra volver a medir.
    // El 0 no existe, así que bajar desde el 1 lleva al -1.
    const below = active.level === null ? null : active.level === 1 ? -1 : active.level - 1
    setData('ghost', {
      type: 'FeatureCollection',
      features:
        state.showGhostFloor && below !== null
          ? data.areas
              .filter(
                (a) =>
                  a.floor === below &&
                  (active.crossBuilding || a.building_id === active.buildingId),
              )
              .map(areaFeature)
          : [],
    })

    setData('pins', {
      type: 'FeatureCollection',
      features: allPins
        .filter((p) => (active.level === null ? p.floor === null : p.floor === active.level))
        .map((p) => ({
          type: 'Feature' as const,
          properties: { id: p.id, title: p.title },
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        })),
    })
  }

  // ── Redibujar cuando cambian los datos o la selección ──
  //
  // `hasDraft` y no `draft`: durante el arrastre de un rectángulo el borrador
  // cambia decenas de veces por segundo, y rehacer todas las fuentes en cada
  // píxel sobra. Lo único que le importa al repintado es si hay borrador o no.
  const hasDraft = draft !== null
  useEffect(() => {
    redrawAll()
  }, [
    mapping,
    hasDraft,
    previewHeightM,
    pins,
    selectedBuildingId,
    selectedFloor,
    selectedAreaId,
    facultyId,
    facultyEdit,
    faculties,
    showGhostFloor,
    viewMode,
    activeLevel,
  ])

  // ── Volar a la facultad al cambiarla ──
  useEffect(() => {
    const map = mapRef.current
    const faculty = faculties.find((f) => f.id === facultyId)
    if (map && faculty) map.flyTo({ center: [faculty.lng, faculty.lat], zoom: 18, duration: 800 })
    // Deliberadamente sin `faculties`: rehidratar el catálogo no es motivo para
    // mover la cámara de donde la dejó quien está trazando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facultyId])

  // ── Borrador: polígono, vértices arrastrables y tirador de rotación ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return

    for (const marker of vertexMarkersRef.current) marker.remove()
    vertexMarkersRef.current = []
    rotationMarkerRef.current?.remove()
    rotationMarkerRef.current = null

    const draftSource = map.getSource('draft') as maplibregl.GeoJSONSource | undefined
    const vertexSource = map.getSource('draft-vertices') as maplibregl.GeoJSONSource | undefined
    if (!draftSource || !vertexSource) return

    if (!draft) {
      draftSource.setData(EMPTY)
      vertexSource.setData(EMPTY)
      return
    }

    const polygon = draftPolygon(draft)
    draftSource.setData(
      polygon
        ? { type: 'Feature', properties: {}, geometry: polygon }
        : {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: draft.kind === 'ring' ? draft.ring : [draft.anchor],
            },
          },
    )

    const vertices = draftVertices(draft)

    // Mientras se traza, los vértices son puntos pintados por la capa: crear un
    // marcador arrastrable por cada clic estorbaría al siguiente clic.
    if (draft.phase !== 'ready') {
      vertexSource.setData({
        type: 'FeatureCollection',
        features: vertices.map((p) => ({
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'Point' as const, coordinates: p },
        })),
      })
      return
    }

    // Ya cerrado: cada vértice pasa a ser un tirador que se puede arrastrar.
    vertexSource.setData(EMPTY)
    vertices.forEach((position, index) => {
      const el = document.createElement('div')
      el.className = 'mapping-vertex'
      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(position as [number, number])
        .addTo(map)

      marker.on('drag', () => {
        const { lng, lat } = marker.getLngLat()
        const next = [...draftVertices(useMappingEditor.getState().draft ?? draft)]
        next[index] = [lng, lat]
        drawDraftPreview(next)
      })
      marker.on('dragend', () => {
        const state = useMappingEditor.getState()
        const current = state.draft ?? draft
        const next = [...draftVertices(current)]
        const { lng, lat } = marker.getLngLat()
        const snap = state.snapEnabled
          ? snapToPolygons([lng, lat], snapReferences(), SNAP_TOLERANCE_M)
          : null
        next[index] = snap ? snap.position : [lng, lat]
        // Mover un vértice suelto convierte el rectángulo en un anillo libre:
        // deja de ser un rectángulo, y el tirador de rotación desaparece.
        state.degradeToRing(next)
      })

      vertexMarkersRef.current.push(marker)
    })

    if (draft.kind === 'rect' && polygon) {
      const ring = openRing(polygon.coordinates[0])
      // A media altura del lado que sale del ancla: es el que marca el giro.
      const handleAt: Position = [
        (ring[1][0] + ring[2][0]) / 2,
        (ring[1][1] + ring[2][1]) / 2,
      ]
      const el = document.createElement('div')
      el.className = 'mapping-rotate-handle'
      el.title = 'Arrastra para girar'
      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(handleAt as [number, number])
        .addTo(map)

      const applyRotation = (commit: boolean) => {
        const state = useMappingEditor.getState()
        const current = state.draft
        if (current?.kind !== 'rect') return
        const { lng, lat } = marker.getLngLat()
        const dims = rectangleDims(current.anchor, [lng, lat], 0)
        const rotationRad = Math.atan2(dims.heightM, dims.widthM)
        const next: Draft = { ...current, rotationRad }
        if (commit) state.commitDraft(next)
        else state.setDraft(next)
      }
      marker.on('drag', () => applyRotation(false))
      marker.on('dragend', () => applyRotation(true))
      rotationMarkerRef.current = marker
    }
  }, [draft])

  // La altura del borrador sigue al campo del formulario. Va por su cuenta y no
  // dentro del efecto del borrador, que recrea todos los tiradores de vértice:
  // hacerlo ahí tiraría el marcador que se está arrastrando en cada tecla.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current || !map.getLayer('draft-3d')) return
    map.setPaintProperty('draft-3d', 'fill-extrusion-height', previewHeightM ?? 0)
  }, [previewHeightM])

  // El cursor dice qué va a pasar al hacer clic.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = tool === 'select' ? '' : 'crosshair'
  }, [tool])

  // ── Confirmar la forma ──
  // Cerrar un polígono acertándole al primer vértice, o con doble clic, era la
  // única salida y no se adivina. Esta barra es la vía visible: aparece en
  // cuanto hay algo trazado y dice exactamente qué falta.
  const ring = draft?.kind === 'ring' ? draft.ring : []
  const drawingPolygon = draft?.kind === 'ring' && draft.phase === 'drawing'
  const sizingRect = draft?.kind === 'rect' && draft.phase === 'sizing'
  const canClose = drawingPolygon && ring.length >= 3

  const closeShape = () => {
    const state = useMappingEditor.getState()
    if (state.draft?.kind !== 'ring' || state.draft.ring.length < 3) return
    state.commitDraft({ kind: 'ring', ring: state.draft.ring, phase: 'ready' })
    onDraftReadyRef.current()
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" aria-label="Lienzo de mapeo" />

      {/* Sin inclinar, un volumen visto desde arriba es su propia huella: la
          vista previa 3D no se vería y parecería que no funciona. La brújula de
          MapLibre ya inclina arrastrándola, pero eso no lo adivina nadie. */}
      <button
        onClick={() => {
          const map = mapRef.current
          if (!map) return
          const next = map.getPitch() > 5 ? 0 : 55
          map.easeTo({ pitch: next, duration: 500 })
          setPitched(next > 0)
        }}
        title={pitched ? 'Volver a la vista cenital' : 'Inclinar para ver los volúmenes 3D'}
        className="absolute bottom-5 left-4 z-10 flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-600 shadow-lg backdrop-blur transition-colors hover:text-[#D41F2D] dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-300"
      >
        {pitched ? <Square size={13} /> : <Box size={13} />}
        {pitched ? '2D' : '3D'}
      </button>

      {(drawingPolygon || sizingRect) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
            <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">
              {sizingRect
                ? 'Haz clic para fijar la esquina opuesta'
                : ring.length < 3
                  ? `${ring.length} de 3 puntos mínimos`
                  : `${ring.length} puntos trazados`}
            </span>

            {drawingPolygon && (
              <button
                onClick={closeShape}
                disabled={!canClose}
                className="flex items-center gap-1.5 rounded-lg bg-[#D41F2D] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#b01a25] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check size={13} /> Cerrar forma
                <kbd className="ml-0.5 rounded bg-white/20 px-1 font-sans text-[9px]">Enter</kbd>
              </button>
            )}

            <button
              onClick={() => useMappingEditor.getState().resetHistory()}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-[#D41F2D] dark:hover:bg-neutral-800"
            >
              <X size={13} /> Descartar
              <kbd className="ml-0.5 rounded bg-neutral-100 px-1 font-sans text-[9px] text-neutral-500 dark:bg-neutral-800">
                Esc
              </kbd>
            </button>
          </div>
        </div>
      )}

      {draft?.phase === 'ready' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/95 px-3 py-2 shadow-xl backdrop-blur dark:border-emerald-900/60 dark:bg-emerald-950/90">
            <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
              Forma lista. Ponle nombre en el panel de la derecha y guarda.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
