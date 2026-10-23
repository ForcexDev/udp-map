import { useEffect, useMemo } from 'react'
import { interiorBuildingIds, useMapping } from '@/features/mapping/useMapping'
import { currentMap, useMapStyleEpoch } from '@/shared/lib/mapInstance'
import { indoor3dFacultyId, useUIStore } from '@/shared/stores/uiStore'
import { GROUND_LEVEL } from '@/shared/utils/floorVisibility'
import { openRing } from '@/shared/utils/geometry'
import { areasToLocal } from '@/shared/utils/indoor/load'
import { levelIndex, projectionAround, zMeters } from '@/shared/utils/indoor/projection'
import {
  buildFloorPrisms,
  EXPLODED_GAP_M,
  GAP_ANIMATION_MS,
  removeFloorLayers,
  setFloorData,
  setFloorOpacities,
  useIndoorGap,
  type SceneBuilding,
} from './explodedView'
import { hasLabelOverlay, labelOverlay } from './LabelOverlay'
import { escapeHtml } from './shapes'
import { useNavGraph } from './useNavGraph'

// ─────────────────────────────────────────────────────────────────────────────
// El interior de una facultad en 3D, mientras se navega o con los pisos
// separados. No pinta nada en React: dirige capas del mapa.
//
// Es el único dueño de las losas, suelos, muros y peldaños; la hoja de
// navegación pone encima la ruta y la figura. Las dos leen la misma separación
// (`useIndoorGap`) para que la ruta suba con su planta.
// ─────────────────────────────────────────────────────────────────────────────

const FLOOR_LABELS = 'floor:'
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export function IndoorScene() {
  const facultyId = useUIStore(indoor3dFacultyId)
  const navigating = useUIStore((s) => s.indoorNavFacultyId !== null)
  const exploded = useUIStore((s) => s.explodedFloors)
  const activeFloor = useUIStore((s) => s.activeFloor)
  const theme = useUIStore((s) => s.theme)
  const epoch = useMapStyleEpoch()
  const { mapping } = useMapping()
  const { model } = useNavGraph(facultyId)
  const gap = useIndoorGap((s) => s.gap)

  const dark =
    theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'))

  const scene = useMemo(() => {
    if (!facultyId) return null
    const ids = new Set(interiorBuildingIds(mapping, facultyId))
    if (ids.size === 0) return null
    const sourceAreas = mapping.areas.filter((a) => a.building_id !== null && ids.has(a.building_id))
    const footprints = mapping.buildings.filter((b) => ids.has(b.id))
    // El plano de la navegación si hay grafo: ruta y edificio tienen que caer
    // en los mismos metros.
    const plane =
      model?.plane ??
      projectionAround(
        footprints.flatMap((b) => openRing(b.footprint.coordinates[0] ?? []).map(([lng, lat]) => ({ lng, lat }))),
      )
    const buildings: SceneBuilding[] = footprints.map((b) => ({
      id: b.id,
      footprint: openRing(b.footprint.coordinates[0] ?? []).map(([lng, lat]) => plane.toLocal(lng, lat)),
      levels: mapping.floors.filter((f) => f.building_id === b.id).map((f) => f.level),
    }))
    const levels = [...new Set(buildings.flatMap((b) => b.levels))].sort((a, b) => levelIndex(a) - levelIndex(b))
    return { plane, buildings, levels, areas: areasToLocal(sourceAreas, plane), sourceAreas }
  }, [facultyId, mapping, model])

  // Separar o juntar los pisos: el gap se anima y la escena se repinta con él.
  useEffect(() => {
    const target = exploded && facultyId ? EXPLODED_GAP_M : 0
    const from = useIndoorGap.getState().gap
    if (from === target) return
    if (prefersReducedMotion()) {
      useIndoorGap.getState().setGap(target)
      return
    }
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const f = Math.min(1, (now - start) / GAP_ANIMATION_MS)
      const eased = f * f * (3 - 2 * f)
      useIndoorGap.getState().setGap(from + (target - from) * eased)
      if (f < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [exploded, facultyId])

  const active = activeFloor ?? scene?.levels.find((l) => l === GROUND_LEVEL) ?? scene?.levels[0] ?? GROUND_LEVEL

  // Geometría: losas, suelos, muros y peldaños.
  useEffect(() => {
    const map = currentMap()
    if (!map || epoch === 0) return
    if (!scene) {
      removeFloorLayers(map)
      return
    }
    const prisms = buildFloorPrisms({
      buildings: scene.buildings,
      areas: scene.areas,
      graph: model?.graph ?? null,
      gap,
      dark,
    })
    setFloorData(map, prisms, scene.plane, scene.levels)
  }, [scene, model, gap, dark, epoch])

  useEffect(() => {
    const map = currentMap()
    if (!map || epoch === 0 || !scene) return
    setFloorOpacities(map, scene.levels, active, navigating, gap > 0.5)
  }, [scene, active, navigating, gap, epoch])

  // Al dejar de verse el interior, fuera capas y etiquetas.
  useEffect(() => {
    if (scene) return
    const map = currentMap()
    if (map && hasLabelOverlay(map)) labelOverlay(map).clear(FLOOR_LABELS)
  }, [scene])

  // Etiquetas en altura: nombres de sala de la planta activa y una pastilla
  // por planta para cambiar de piso. Con los pisos juntos solo hay sitio para
  // los nombres; las pastillas son de la vista separada.
  useEffect(() => {
    const map = currentMap()
    if (!map || epoch === 0 || !scene) return
    const overlay = labelOverlay(map)
    const wanted = new Set<string>()

    for (const area of scene.sourceAreas) {
      if (area.floor !== active || area.kind === 'corridor' || area.kind === 'service') continue
      const local = scene.areas.find((a) => a.id === area.id)
      if (!local) continue
      const c = local.ring.reduce((acc, p) => ({ x: acc.x + p.x / local.ring.length, y: acc.y + p.y / local.ring.length }), {
        x: 0,
        y: 0,
      })
      const id = `${FLOOR_LABELS}area:${area.id}`
      wanted.add(id)
      overlay.set(id, {
        lngLat: scene.plane.toLngLat(c),
        altitude: zMeters(active, gap) + 0.4,
        html: `<span class="rounded-md bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-stone-700 shadow-xs dark:bg-stone-900/80 dark:text-stone-200">${escapeHtml(area.name)}</span>`,
      })
    }

    if (gap > 0.5) {
      for (const building of scene.buildings) {
        const corner = building.footprint[0]
        if (!corner) continue
        for (const level of building.levels) {
          const id = `${FLOOR_LABELS}pill:${building.id}:${level}`
          wanted.add(id)
          const isActive = level === active
          overlay.set(id, {
            lngLat: scene.plane.toLngLat(corner),
            altitude: zMeters(level, gap) + 0.6,
            html: `<span class="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums shadow-xs ${
              isActive ? 'bg-[#C22B38] text-white' : 'bg-white text-stone-700 dark:bg-stone-800 dark:text-stone-200'
            }">${level < 0 ? `S${-level}` : `P${level}`}</span>`,
            onClick: () => useUIStore.getState().setActiveFloor(level),
          })
        }
      }
    }

    for (const id of overlay.ids(FLOOR_LABELS)) if (!wanted.has(id)) overlay.remove(id)
  }, [scene, active, gap, epoch])

  // Al desmontar (salir del mapa), la escena se va con él.
  useEffect(() => {
    return () => {
      const map = currentMap()
      if (!map) return
      try {
        if (hasLabelOverlay(map)) labelOverlay(map).clear(FLOOR_LABELS)
        removeFloorLayers(map)
      } catch {
        // El mapa puede estar desmontándose a la vez.
      }
    }
  }, [])

  return null
}
