import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Accessibility,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ArrowUpFromLine,
  ArrowUpLeft,
  ArrowUpRight,
  ChevronDown,
  CornerUpLeft,
  CornerUpRight,
  Crosshair,
  Footprints,
  MapPinCheck,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import type { LatLng } from '@/shared/utils/geo'
import { currentMap, useMapStyleEpoch } from '@/shared/lib/mapInstance'
import { useUIStore } from '@/shared/stores/uiStore'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import { buildInstructions } from '@/shared/utils/indoor/instructions'
import { microaddress } from '@/shared/utils/indoor/microaddress'
import { zMeters } from '@/shared/utils/indoor/projection'
import { activeStepIndex, buildTrack } from '@/shared/utils/indoor/track'
import type { Route, Step, StepIcon } from '@/shared/utils/indoor/types'
import { easeCamera, followPose, newFollowState, sheetPadding } from './camera'
import { shaftRectResolver, useIndoorGap } from './explodedView'
import {
  ensureRouteLayers,
  removeRouteLayers,
  setFigure,
  setRouteActiveLevel,
  setRouteData,
} from './indoorLayers'
import { hasLabelOverlay, labelOverlay } from './LabelOverlay'
import { escapeHtml } from './shapes'
import { chooseEntrance, originOptions } from './resolveTarget'
import { PLAYBACK_SPEEDS, usePlayback, type PlaybackSpeed } from './usePlayback'
import type { IndoorModel } from './useNavGraph'

// ─────────────────────────────────────────────────────────────────────────────
// "Cómo llegar" por dentro: la hoja de navegación giro a giro.
//
// Sustituye a `WayfinderSheet` cuando el destino tiene grafo; nunca se ven las
// dos. Calcula la ruta desde el origen elegido, la redacta, la anima (una
// figura la recorre, la cámara la sigue y el selector de planta cambia solo al
// subir) y la pinta encima del edificio que dibuja `IndoorScene`.
//
// La ruta de calle no se pide desde aquí: `features/map` la inyecta, para no
// sumar otro ciclo entre dominios.
// ─────────────────────────────────────────────────────────────────────────────

/** Lo mínimo de una ruta de calle que necesita la hoja. */
export interface StreetRoute {
  coordinates: [number, number][]
  distanceMeters: number
  durationSeconds: number
  source: string
}

interface IndoorRouteSheetProps {
  model: IndoorModel
  targetPin: Pin
  targetNodeId: string
  userLocation: LatLng | null
  requestLocation: () => Promise<LatLng | null>
  getStreetRoute: (from: LatLng, to: LatLng, accessible: boolean) => Promise<StreetRoute>
  onStreetRoute: (route: StreetRoute | null) => void
}

const GPS = 'gps'
const NAV_LABELS = 'nav:'

const ICONS: Record<StepIcon, typeof ArrowUp> = {
  depart: Footprints,
  straight: ArrowUp,
  'slight-left': ArrowUpLeft,
  'slight-right': ArrowUpRight,
  left: CornerUpLeft,
  right: CornerUpRight,
  uturn: Undo2,
  'stairs-up': ArrowUpFromLine,
  'stairs-down': ArrowDownToLine,
  elevator: ArrowUpDown,
  arrive: MapPinCheck,
}

const reducedMotionQuery = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function IndoorRouteSheet({
  model,
  targetPin,
  targetNodeId,
  userLocation,
  requestLocation,
  getStreetRoute,
  onStreetRoute,
}: IndoorRouteSheetProps) {
  const { t, i18n } = useTranslation()
  const reduceMotion = useReducedMotion() ?? false
  const accessibleRoute = useUIStore((s) => s.accessibleRoute)
  const setAccessibleRoute = useUIStore((s) => s.setAccessibleRoute)
  const setRouteTarget = useUIStore((s) => s.setRouteTarget)
  const activeFloor = useUIStore((s) => s.activeFloor)
  const gap = useIndoorGap((s) => s.gap)
  const epoch = useMapStyleEpoch()
  const { graph, plane } = model

  const sheetRef = useRef<HTMLDivElement>(null)
  const stepListRef = useRef<HTMLDivElement>(null)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [follow, setFollow] = useState(true)
  const [voice, setVoice] = useState(false)
  const [street, setStreet] = useState<StreetRoute | null>(null)
  const [locating, setLocating] = useState(false)

  const origins = useMemo(() => originOptions(model), [model])
  const [origin, setOrigin] = useState<string>(() => (userLocation ? GPS : (origins[0]?.id ?? GPS)))

  // ── Ruta ──
  const plan = useMemo(() => {
    if (origin === GPS) {
      if (!userLocation) return null
      const choice = chooseEntrance(
        model,
        targetNodeId,
        plane.toLocal(userLocation.lng, userLocation.lat),
        accessibleRoute,
      )
      return choice ? { route: choice.route, entranceId: choice.entrance.id } : null
    }
    const route = graph.route(origin, targetNodeId, { stepFree: accessibleRoute })
    return route ? { route, entranceId: null } : null
  }, [origin, userLocation, model, plane, graph, targetNodeId, accessibleRoute])

  const route: Route | null = plan?.route ?? null
  const steps: Step[] = useMemo(
    () => (route ? buildInstructions(route, graph, t, { targetName: targetPin.title }) : []),
    [route, graph, t, targetPin.title],
  )
  const shaftRect = useMemo(() => shaftRectResolver(graph, model.areas), [graph, model.areas])
  const track = useMemo(
    () => (route ? buildTrack(route, graph, { shaftRect }) : null),
    [route, graph, shaftRect],
  )
  const address = useMemo(
    () =>
      microaddress(targetNodeId, {
        graph,
        areas: model.areas,
        buildingName: () => null,
        t,
      }),
    [targetNodeId, graph, model.areas, t],
  )

  // ── Calle: solo para la entrada elegida (ORS tiene cupo diario) ──
  useEffect(() => {
    if (origin !== GPS || !userLocation || !plan?.entranceId) {
      setStreet(null)
      onStreetRoute(null)
      return
    }
    let cancelled = false
    const [lng, lat] = plane.toLngLat(graph.node(plan.entranceId).p)
    getStreetRoute(userLocation, { lng, lat }, accessibleRoute)
      .then((r) => {
        if (cancelled) return
        setStreet(r)
        onStreetRoute(r)
      })
      .catch(() => {
        if (!cancelled) setStreet(null)
      })
    return () => {
      cancelled = true
    }
    // La ruta de calle depende de la entrada elegida, no de cada lectura del GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, plan?.entranceId, accessibleRoute])

  useEffect(() => () => onStreetRoute(null), [onStreetRoute])

  // ── Sesión: facultad, 3D y cámara libre en altura ──
  useEffect(() => {
    const ui = useUIStore.getState()
    const previousViewMode = ui.viewMode
    ui.setIndoorNavFaculty(model.facultyId)
    if (previousViewMode !== '3d') ui.setViewMode('3d')
    currentMap()?.setCenterClampedToGround(false)
    return () => {
      const state = useUIStore.getState()
      state.setIndoorNavFaculty(null)
      if (previousViewMode !== '3d') state.setViewMode(previousViewMode)
      const map = currentMap()
      if (!map) return
      try {
        removeRouteLayers(map)
        if (hasLabelOverlay(map)) labelOverlay(map).clear(NAV_LABELS)
        map.setCenterElevation(0)
        map.setCenterClampedToGround(true)
      } catch {
        // El mapa puede estar desmontándose a la vez que la hoja.
      }
    }
  }, [model.facultyId])

  // ── Animación ──
  const followRef = useRef(follow)
  const startedRef = useRef(false)
  const lastLevelRef = useRef<number | null>(null)
  const followState = useRef(newFollowState())

  useEffect(() => {
    followRef.current = follow
    if (follow) followState.current = newFollowState()
  }, [follow])

  const onFrame = useCallback(
    (time: number, dt: number) => {
      const map = currentMap()
      if (!map || !track) return
      const pose = track.sample(time)
      const currentGap = useIndoorGap.getState().gap
      setFigure(map, pose, plane, currentGap)
      if (hasLabelOverlay(map))
        labelOverlay(map).move(
          `${NAV_LABELS}balloon`,
          plane.toLngLat(pose.p),
          zMeters(pose.z, currentGap) + 1.9,
        )
      // A mitad de escalera la planta redondea a la de destino, y el
      // selector cambia solo: a través del store, para respetar la regla de
      // planta de facultad.
      if (pose.level !== lastLevelRef.current) {
        lastLevelRef.current = pose.level
        useUIStore.getState().setActiveMappingFaculty(model.facultyId, pose.level)
      }
      if (followRef.current && startedRef.current) {
        followPose(
          map,
          pose,
          plane,
          currentGap,
          followState.current,
          dt,
          sheetPadding(sheetRef.current),
          reducedMotionQuery(),
        )
      }
    },
    [track, plane, model.facultyId],
  )

  const playback = usePlayback(track?.duration ?? 0, onFrame, reducedMotionQuery() ? 6 : 3)
  const { seek, pause } = playback
  const stepIndex = track ? activeStepIndex(steps, track.nodeTimes, playback.t) : 0
  const current = steps[stepIndex]

  // Ruta nueva: figura al principio, vista de conjunto y planta de partida.
  useEffect(() => {
    if (!route || !track) return
    startedRef.current = false
    lastLevelRef.current = null
    pause()
    seek(0)
    const map = currentMap()
    if (!map) return
    const points = route.nodes.map((id) => plane.toLngLat(graph.node(id).p))
    const lngs = points.map((p) => p[0])
    const lats = points.map((p) => p[1])
    const camera = map.cameraForBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: sheetPadding(sheetRef.current), maxZoom: 19.5, bearing: map.getBearing() },
    )
    const start = graph.node(route.nodes[0])
    if (camera) {
      easeCamera(
        map,
        { center: camera.center, zoom: camera.zoom, bearing: camera.bearing, pitch: 50 },
        zMeters(start.floor ?? 1, useIndoorGap.getState().gap),
        reducedMotionQuery() ? 0 : 900,
      )
    }
  }, [route, track, plane, graph, seek, pause])

  // Cinta, poste y destino: con la ruta, la separación de pisos o un estilo nuevo.
  useEffect(() => {
    const map = currentMap()
    if (!map || epoch === 0 || !route) return
    ensureRouteLayers(map)
    setRouteData(map, { route, graph, plane, gap, shaftRect })
    onFrame(playback.tRef.current, 0)
    // `playback.tRef` es una ref estable; `onFrame` cambia con la ruta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, graph, plane, gap, shaftRect, epoch, onFrame])

  useEffect(() => {
    const map = currentMap()
    if (!map || epoch === 0 || !route) return
    setRouteActiveLevel(map, activeFloor ?? 1)
  }, [activeFloor, route, epoch])

  // Arrastrar el mapa suelta la cámara; un botón la vuelve a enganchar.
  useEffect(() => {
    const map = currentMap()
    if (!map) return
    const release = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) setFollow(false)
    }
    map.on('dragstart', release)
    map.on('rotatestart', release)
    map.on('pitchstart', release)
    map.on('zoomstart', release)
    return () => {
      map.off('dragstart', release)
      map.off('rotatestart', release)
      map.off('pitchstart', release)
      map.off('zoomstart', release)
    }
  }, [epoch])

  // Etiquetas: partida, destino y el globo del paso actual sobre la figura.
  useEffect(() => {
    const map = currentMap()
    if (!map || epoch === 0 || !route) return
    const overlay = labelOverlay(map)
    const start = graph.node(route.nodes[0])
    const end = graph.node(route.nodes[route.nodes.length - 1])
    const tag = (text: string, tone: string) =>
      `<span class="rounded-lg px-2 py-0.5 text-[11px] font-bold shadow-xs ${tone}">${escapeHtml(text)}</span>`
    overlay.set(`${NAV_LABELS}start`, {
      lngLat: plane.toLngLat(start.p),
      altitude: zMeters(start.floor ?? 1, gap) + 1.8,
      anchor: 'bottom',
      html: tag(
        t('wayfinder.indoor.startLabel', 'Partida'),
        'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900',
      ),
    })
    overlay.set(`${NAV_LABELS}end`, {
      lngLat: plane.toLngLat(end.p),
      altitude: zMeters(end.floor ?? 1, gap) + 2.8,
      anchor: 'bottom',
      html: tag(t('wayfinder.destBadge', 'Destino'), 'bg-[#C22B38] text-white'),
    })
  }, [route, graph, plane, gap, epoch, t])

  useEffect(() => {
    const map = currentMap()
    if (!map || epoch === 0 || !current || !track) return
    const pose = track.sample(playback.tRef.current)
    labelOverlay(map).set(`${NAV_LABELS}balloon`, {
      lngLat: plane.toLngLat(pose.p),
      altitude: zMeters(pose.z, useIndoorGap.getState().gap) + 1.9,
      anchor: 'bottom',
      html: `<div class="max-w-[220px] rounded-xl bg-stone-900/90 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-white shadow-md dark:bg-stone-100/95 dark:text-stone-900">${escapeHtml(current.text)}</div>`,
    })
    // El globo cambia de texto con el paso; su posición la mueve `onFrame`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.text, track, plane, epoch])

  // Voz opcional: lee el paso al entrar en él.
  useEffect(() => {
    if (!voice || !current || typeof window.speechSynthesis === 'undefined') return
    const utterance = new SpeechSynthesisUtterance(
      current.detail ? `${current.text}. ${current.detail}` : current.text,
    )
    utterance.lang = i18n.language === 'en' ? 'en-US' : 'es-CL'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [voice, current, i18n.language])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  // Con la lista abierta, el paso actual queda a la vista.
  useEffect(() => {
    if (!stepsOpen) return
    stepListRef.current
      ?.querySelector(`[data-step="${stepIndex}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [stepIndex, stepsOpen, reduceMotion])

  const goToStep = (index: number) => {
    if (!track || !steps[index]) return
    startedRef.current = true
    setFollow(true)
    seek(track.nodeTimes[steps[index].from] ?? 0)
  }

  const togglePlay = () => {
    if (playback.playing) {
      playback.pause()
      return
    }
    startedRef.current = true
    playback.play()
  }

  const chooseOrigin = async (value: string) => {
    if (value !== GPS) {
      setOrigin(value)
      return
    }
    setLocating(true)
    try {
      const location = await requestLocation()
      if (location) setOrigin(GPS)
    } catch {
      useUIStore.getState().showToast(t('map.locationFailed', 'No se pudo obtener tu ubicación.'))
    } finally {
      setLocating(false)
    }
  }

  // ── Resumen ──
  const seconds = (route?.seconds ?? 0) + (street?.durationSeconds ?? 0)
  const meters = (route?.meters ?? 0) + (street?.distanceMeters ?? 0)
  const minutes = Math.max(1, Math.round(seconds / 60))
  const verticalKind = route?.kinds.includes('elevator')
    ? 'elevator'
    : route?.kinds.includes('stairs')
      ? 'stairs'
      : null
  const via =
    verticalKind === 'elevator'
      ? t('wayfinder.indoor.viaElevator', 'en ascensor')
      : verticalKind === 'stairs'
        ? t('wayfinder.indoor.viaStairs', 'por escalera')
        : null
  const summary = [
    `${minutes} min`,
    t('wayfinder.indoor.walkingMeters', '{{m}} m caminando', { m: Math.round(meters) }),
    via,
  ]
    .filter(Boolean)
    .join(' · ')

  const originChoices = [
    {
      value: GPS,
      label: locating
        ? t('common.loading', 'Cargando…')
        : t('wayfinder.indoor.fromHere', 'Tu ubicación'),
    },
    ...origins.map((n) => ({ value: n.id, label: capitalize(n.landmark ?? n.id) })),
  ]

  const targetNode = graph.node(targetNodeId)
  const approximate = targetNode.kind !== 'room'
  // Los ids del demo delatan el edificio de prueba: su plano es supuesto.
  const supposed = targetNodeId.startsWith('demo-')
  const floorLabel = (level: number | null) =>
    level === null
      ? t('wayfinder.indoor.groupStreet', 'Calle')
      : level < 0
        ? t('wayfinder.indoor.groupBasement', 'Subterráneo {{n}}', { n: -level })
        : t('wayfinder.indoor.groupFloor', 'Piso {{n}}', { n: level })

  const close = () => setRouteTarget(null)
  const back = () => {
    setRouteTarget(null)
    useUIStore.getState().selectPin(targetPin.id)
  }

  const chip =
    'flex h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl px-2.5 text-xs font-semibold transition-colors'
  const chipIdle =
    'bg-[#EFECE4] text-stone-700 hover:bg-stone-200 dark:bg-white/[0.08] dark:text-stone-200 dark:hover:bg-white/15'
  const chipOn = 'bg-stone-900 text-[#FAF8F5] dark:bg-stone-100 dark:text-stone-950'

  return (
    <div
      ref={sheetRef}
      className="pointer-events-auto absolute bottom-0 left-0 right-0 z-30 flex max-h-[52vh] flex-col rounded-t-[32px] border-t border-[#E5DEC9] bg-[#FAF8F5] shadow-[0_-14px_38px_rgba(28,25,23,0.10)] sm:bottom-4 sm:left-auto sm:right-4 sm:max-h-[calc(100vh-180px)] sm:w-[400px] sm:rounded-[32px] sm:border dark:border-white/10 dark:bg-[#151820]"
    >
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-stone-300 sm:hidden dark:bg-stone-700" />

      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 pb-5 pt-3">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={back}
              aria-label={t('common.back', 'Volver')}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#EFECE4] text-stone-700 dark:bg-white/[0.08] dark:text-stone-200"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">
                {t('wayfinder.indoor.title', 'Cómo llegar · {{target}}', {
                  target: targetPin.room_code ?? targetPin.title,
                })}
              </div>
              <p className="mt-0.5 truncate text-xs tabular-nums text-stone-500 dark:text-stone-400">
                {route ? summary : t('wayfinder.indoor.noRoute', 'No hay ruta desde ese punto')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t('common.close', 'Cerrar')}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#EFECE4] text-stone-700 dark:bg-white/[0.08] dark:text-stone-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Microdirección */}
        {address && (
          <div className="rounded-2xl border border-[#F2D0CE] bg-[#FBECEB] px-3.5 py-2.5 text-xs dark:border-[#D93846]/30 dark:bg-[#D93846]/10">
            <div className="font-semibold text-[#B02330] dark:text-rose-300">{address.line1}</div>
            {address.line2 && (
              <div className="mt-0.5 text-stone-700 dark:text-stone-300">{address.line2}</div>
            )}
          </div>
        )}
        {(approximate || supposed || (address && !address.line2)) && (
          <p className="-mt-1 text-[11px] leading-snug text-stone-500 dark:text-stone-400">
            {approximate
              ? t(
                  'wayfinder.indoor.approximate',
                  'Destino aproximado: se llega al punto mapeado más cercano.',
                )
              : supposed
                ? t(
                    'wayfinder.indoor.supposed',
                    'Plano de prueba: la posición de las salas es supuesta.',
                  )
                : t('wayfinder.indoor.noStairsMapped', 'Esta planta no tiene escalera mapeada.')}
          </p>
        )}

        {/* Desde y sin escaleras */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-semibold text-stone-500 dark:text-stone-400">
            {t('wayfinder.indoor.from', 'Desde')}
          </span>
          <CustomSelect
            className="min-w-0 flex-1"
            options={originChoices}
            value={origin}
            onChange={(value) => void chooseOrigin(value)}
          />
          <button
            type="button"
            onClick={() => setAccessibleRoute(!accessibleRoute)}
            aria-pressed={accessibleRoute}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              accessibleRoute
                ? 'border border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                : 'border border-[#E6E0D5] bg-white text-stone-600 dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-400'
            }`}
          >
            <Accessibility size={15} />
            <span>{t('wayfinder.stepFree', 'Sin escaleras')}</span>
          </button>
        </div>

        {!route && (
          <p className="rounded-2xl bg-[#EFECE4] p-3 text-xs text-stone-700 dark:bg-white/[0.06] dark:text-stone-300">
            {accessibleRoute
              ? t(
                  'wayfinder.indoor.noStepFreeRoute',
                  'No hay una ruta sin escaleras desde ese punto.',
                )
              : origin === GPS && !userLocation
                ? t(
                    'wayfinder.indoor.needLocation',
                    'Elige un punto de partida o activa tu ubicación.',
                  )
                : t('wayfinder.indoor.noRouteFrom', 'No hay una ruta mapeada desde ese punto.')}
          </p>
        )}

        {route && current && track && (
          <>
            {street && street.distanceMeters > 1 && (
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {t(
                  'wayfinder.indoor.streetLeg',
                  'Primero, {{m}} m por la calle hasta {{entrance}}',
                  {
                    m: Math.round(street.distanceMeters),
                    entrance: plan?.entranceId ? (graph.node(plan.entranceId).landmark ?? '') : '',
                  },
                )}
              </p>
            )}

            {/* Paso actual: destella al cambiar */}
            <motion.div
              key={stepIndex}
              initial={reduceMotion ? false : { scale: 0.97, backgroundColor: '#C22B38' }}
              animate={{ scale: 1, backgroundColor: '#1C1917' }}
              transition={{ duration: 0.35 }}
              className="flex items-start gap-3 rounded-2xl p-3.5 text-white"
              aria-live="polite"
            >
              <StepGlyph icon={current.icon} large />
              <div className="min-w-0">
                <div className="text-sm font-bold leading-snug">{current.text}</div>
                {current.detail && (
                  <div className="mt-1 text-xs leading-snug text-stone-300">{current.detail}</div>
                )}
                <div className="mt-1.5 text-[11px] font-semibold tabular-nums text-stone-400">
                  {t('wayfinder.indoor.stepOf', 'Paso {{n}} de {{total}} · {{floor}}', {
                    n: stepIndex + 1,
                    total: steps.length,
                    floor: floorLabel(current.level).toLowerCase(),
                  })}
                </div>
              </div>
            </motion.div>

            {/* Avance */}
            <input
              type="range"
              min={0}
              max={track.duration}
              step={0.1}
              value={playback.t}
              onPointerDown={() => {
                pause()
                startedRef.current = true
              }}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label={t('wayfinder.indoor.progress', 'Avance de la ruta')}
              className="w-full accent-[#C22B38]"
            />

            {/* Controles */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={`${chip} ${chipIdle}`}
                onClick={() => goToStep(Math.max(0, stepIndex - 1))}
                aria-label={t('wayfinder.indoor.prev', 'Paso anterior')}
              >
                <SkipBack size={15} />
              </button>
              <button
                type="button"
                className={`${chip} bg-[#C22B38] text-white hover:opacity-95 dark:bg-[#D93846]`}
                onClick={togglePlay}
                aria-label={
                  playback.playing
                    ? t('wayfinder.indoor.pause', 'Pausar')
                    : t('wayfinder.indoor.play', 'Reproducir')
                }
              >
                {playback.playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button
                type="button"
                className={`${chip} ${chipIdle}`}
                onClick={() => goToStep(Math.min(steps.length - 1, stepIndex + 1))}
                aria-label={t('wayfinder.indoor.next', 'Paso siguiente')}
              >
                <SkipForward size={15} />
              </button>
              <button
                type="button"
                className={`${chip} ${chipIdle} tabular-nums`}
                onClick={() => {
                  const i = PLAYBACK_SPEEDS.indexOf(playback.speed)
                  playback.setSpeed(
                    PLAYBACK_SPEEDS[(i + 1) % PLAYBACK_SPEEDS.length] as PlaybackSpeed,
                  )
                }}
                aria-label={t('wayfinder.indoor.speed', 'Velocidad')}
              >
                {playback.speed}×
              </button>
              <div className="flex-1" />
              <button
                type="button"
                className={`${chip} ${follow ? chipOn : chipIdle}`}
                onClick={() => {
                  startedRef.current = true
                  setFollow(!follow)
                  if (!follow) onFrame(playback.tRef.current, 0)
                }}
                aria-pressed={follow}
                aria-label={t('wayfinder.indoor.follow', 'Seguir con la cámara')}
              >
                <Crosshair size={15} />
              </button>
              <button
                type="button"
                className={`${chip} ${voice ? chipOn : chipIdle}`}
                onClick={() => setVoice(!voice)}
                aria-pressed={voice}
                aria-label={t('wayfinder.indoor.voice', 'Leer los pasos en voz alta')}
              >
                {voice ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            </div>

            {/* Lista de pasos, plegada por defecto */}
            <button
              type="button"
              onClick={() => setStepsOpen(!stepsOpen)}
              className="flex cursor-pointer items-center justify-between rounded-xl px-1 text-xs font-semibold text-stone-600 dark:text-stone-300"
              aria-expanded={stepsOpen}
            >
              <span>
                {t('wayfinder.indoor.seeSteps', 'Ver los {{n}} pasos', { n: steps.length })}
              </span>
              <ChevronDown
                size={15}
                className={`transition-transform ${stepsOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {stepsOpen && (
              <div ref={stepListRef} className="flex flex-col gap-1">
                {steps.map((step, i) => (
                  <div key={i}>
                    {(i === 0 || steps[i - 1].level !== step.level) && (
                      <div className="mb-1 mt-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                        {floorLabel(step.level)}
                      </div>
                    )}
                    <button
                      type="button"
                      data-step={i}
                      onClick={() => goToStep(i)}
                      className={`flex w-full cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
                        i === stepIndex
                          ? 'border-stone-900 bg-white dark:border-white/40 dark:bg-white/[0.08]'
                          : 'border-transparent hover:bg-white/70 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <StepGlyph icon={step.icon} />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-stone-900 dark:text-stone-100">
                          {step.text}
                        </span>
                        {step.detail && (
                          <span className="mt-0.5 block text-[11px] text-stone-500 dark:text-stone-400">
                            {step.detail}
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StepGlyph({ icon, large = false }: { icon: StepIcon; large?: boolean }) {
  const Icon = ICONS[icon]
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl ${
        large
          ? 'h-10 w-10 bg-white/10 text-white'
          : 'h-7 w-7 bg-[#EFECE4] text-stone-700 dark:bg-white/[0.08] dark:text-stone-200'
      }`}
    >
      <Icon size={large ? 20 : 15} strokeWidth={2.2} />
    </span>
  )
}
