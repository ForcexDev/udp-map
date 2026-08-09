import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Accessibility, Menu, MapPin, Search, Loader2, ChevronDown, Bell, Building2 } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { useSidebarStore } from '@/shared/stores/sidebarStore'
import { useNotifications } from '@/features/notifications/useNotifications'
import { useGuard } from '@/features/auth/useGuard'
import { AnimatePresence } from 'framer-motion'
import { usePins } from '@/features/pins/usePins'
import { PinDetail } from '@/features/pins/PinDetail'
import { CreatePinModal } from '@/features/pins/CreatePinModal'
import { TutorialModal } from './TutorialModal'
import { ProfileSetupModal } from '@/features/auth/ProfileSetupModal'
import { updatePinLocation } from '@/features/pins/api'
import { useAuthStore } from '@/features/auth/authStore'
import type { Faculty } from '@/shared/types/database'
import { CAMPUSES } from '@/shared/data/campusData'
import { useFaculties } from '@/shared/data/facultyStore'
import { formatDistance, type LatLng } from '@/shared/utils/geo'
import { MapView, getMapCenter } from './MapView'
import { FacultyDetail } from './FacultyDetail'
import { FiltersPanel } from './FiltersPanel'
import { FloorSelector } from './FloorSelector'
import { getWalkingRoute, type WalkingRoute } from './routing'
import { isLocationOutOfBounds } from './campusBoundary'
import { isPinLocationOccupied } from '@/shared/utils/pinLocation'
import type { Polygon } from 'geojson'
import { polygonCentroid } from '@/shared/utils/geometry'
import { AREA_STYLES } from '@/features/mapping/areaStyles'
import { useMapping } from '@/features/mapping/useMapping'

function SearchRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2.5 text-left transition-all hover:bg-neutral-100/60 active:scale-[0.98] dark:hover:bg-neutral-800/60"
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
        {icon}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[12px] font-extrabold leading-snug text-neutral-800 dark:text-neutral-200">
          {title}
        </span>
        <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
          {subtitle}
        </span>
      </div>
    </button>
  )
}

function useUserLocation() {
  const [loc, setLoc] = useState<LatLng | null>(null)
  const [heading, setHeading] = useState<number | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  // Store the first-resolve callback so requestLocation doesn't recreate on every GPS update
  const resolveRef = useRef<((v: LatLng | null) => void) | null>(null)
  const locRef = useRef<LatLng | null>(null)
  const compassHandlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null)

  const startCompass = useCallback(async () => {
    if (compassHandlerRef.current) return // Ya está corriendo

    // 1. Manejo de permisos obligatorio para iOS 13+
    interface DeviceOrientationiOS {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }
    const DeviceOrientationAny = window.DeviceOrientationEvent as unknown as DeviceOrientationiOS
    if (typeof DeviceOrientationAny !== 'undefined' && typeof DeviceOrientationAny.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationAny.requestPermission()
        if (permission !== 'granted') return
      } catch (err) {
        console.error('Error pidiendo permiso de giroscopio', err)
        return
      }
    }

    let lastUpdate = 0
    let hasAbsoluteData = false
    let hasReceivedData = false
    const THROTTLE_MS = 100

    interface ExtendedDeviceOrientationEvent extends DeviceOrientationEvent {
      webkitCompassHeading?: number
    }

    const handler = (e: DeviceOrientationEvent) => {
      const extEv = e as ExtendedDeviceOrientationEvent
      // Determinar si el evento trae info absoluta real (Norte)
      const isAbsolute = e.type === 'deviceorientationabsolute' || 
                         e.absolute === true || 
                         extEv.webkitCompassHeading !== undefined

      if (isAbsolute) {
        hasAbsoluteData = true
      } else if (hasAbsoluteData) {
        // ANTI-GLITCH: Ignoramos eventos relativos si ya tenemos fuente absoluta confiable
        return
      }

      hasReceivedData = true
      const now = Date.now()
      if (now - lastUpdate < THROTTLE_MS) return
      lastUpdate = now

      const h = extEv.webkitCompassHeading ?? (e.alpha !== null ? (360 - e.alpha) % 360 : null)
      setHeading(h)
    }

    compassHandlerRef.current = handler
    const hasAbsolute = 'ondeviceorientationabsolute' in window
    const primaryEvent = hasAbsolute ? 'deviceorientationabsolute' : 'deviceorientation'
    
    window.addEventListener(primaryEvent, handler as EventListener, true)
    if (hasAbsolute) {
      window.addEventListener('deviceorientation', handler, true)
    }

    // ANTI-BRAVE: Health check para detectar bloqueo de hardware
    setTimeout(() => {
      if (!hasReceivedData) {
        useUIStore.getState().showToast('Brújula bloqueada. Permite acceso a "Sensores de movimiento" en tu navegador (ej. Escudos Brave).')
      }
    }, 1500)
  }, [])

  const requestLocation = useCallback((): Promise<LatLng | null> => {
    // Iniciar giroscopio (gatillado por la acción del usuario)
    void startCompass()

    // Already tracking and have a location — return immediately without a new watch
    if (watchIdRef.current !== null && locRef.current) {
      return Promise.resolve(locRef.current)
    }
    // Already watching but first fix not yet received
    if (watchIdRef.current !== null) {
      return new Promise((resolve) => { resolveRef.current = resolve })
    }

    return new Promise<LatLng | null>((resolve, reject) => {
      resolveRef.current = resolve
      const watchId = navigator.geolocation?.watchPosition(
        (pos) => {
          const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          locRef.current = newLoc
          setLoc(newLoc)
          setIsTracking(true)
          // Resolve the first call only
          if (resolveRef.current) {
            resolveRef.current(newLoc)
            resolveRef.current = null
          }
        },
        (err) => {
          locRef.current = null
          setLoc(null)
          setIsTracking(false)
          resolveRef.current = null
          if (err.code === err.PERMISSION_DENIED) {
            reject(new Error('PERMISSION_DENIED'))
          } else {
            reject(new Error('LOCATION_ERROR'))
          }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )

      if (watchId !== undefined) {
        watchIdRef.current = watchId
      } else {
        reject(new Error('NO_GEOLOCATION'))
      }
    })
  // Stable reference — no deps that change on every GPS update
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clean up both GPS and Compass on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current)
      }
      if (compassHandlerRef.current) {
        const handler = compassHandlerRef.current
        const hasAbsolute = 'ondeviceorientationabsolute' in window
        const primaryEvent = hasAbsolute ? 'deviceorientationabsolute' : 'deviceorientation'
        window.removeEventListener(primaryEvent, handler as EventListener, true)
        if (hasAbsolute) {
          window.removeEventListener('deviceorientation', handler, true)
        }
      }
    }
  }, [])

  return { loc, heading, isTracking, requestLocation }
}

export function MapPage() {
  const { t, i18n } = useTranslation()
  const guard = useGuard()
  const { pins, favoriteIds } = usePins()
  const { mapping } = useMapping()
  const role = useAuthStore((s) => s.role)
  const pickingLocation = useUIStore((s) => s.pickingLocation)
  const cancelPickingLocation = useUIStore((s) => s.cancelPickingLocation)
  const startPickingLocation = useUIStore((s) => s.startPickingLocation)
  const movingPinId = useUIStore((s) => s.movingPinId)
  const cancelMovingPin = useUIStore((s) => s.cancelMovingPin)
  const selectedPinId = useUIStore((s) => s.selectedPinId)
  const selectPin = useUIStore((s) => s.selectPin)
  const routeTargetPinId = useUIStore((s) => s.routeTargetPinId)
  const setRouteTarget = useUIStore((s) => s.setRouteTarget)
  const accessibleRoute = useUIStore((s) => s.accessibleRoute)
  const setAccessibleRoute = useUIStore((s) => s.setAccessibleRoute)
  const campusId = useUIStore((s) => s.campusId)
  const setCampusId = useUIStore((s) => s.setCampusId)
  const showToast = useUIStore((s) => s.showToast)
  const selectedFacultyId = useUIStore((s) => s.selectedFacultyId)
  const viewMode = useUIStore((s) => s.viewMode)
  const setViewMode = useUIStore((s) => s.setViewMode)
  const openSidebar = useSidebarStore((s) => s.open)
  const openNotifications = useSidebarStore((s) => s.openNotifications)
  const { data: notifications = [] } = useNotifications()
  const unreadNotificationsCount = notifications.filter((n) => !n.read_at).length
  const queryClient = useQueryClient()

  const handleSelectCampus = (id: string) => {
    setCampusId(id)
    const campus = CAMPUSES.find((c) => c.id === id)
    if (campus) {
      window.dispatchEvent(
        new CustomEvent('faculty-flyto', { detail: { lat: campus.lat, lng: campus.lng } })
      )
    }
  }

  const { loc: userLocation, heading: userHeading, isTracking, requestLocation } = useUserLocation()
  const [route, setRoute] = useState<WalkingRoute | null>(null)
  // Ref to the initial origin used when the route was first calculated.
  // We do NOT recalculate on GPS updates (industry standard: route is shown
  // once and the user follows it; recalc only on explicit user action).
  const routeOriginRef = useRef<LatLng | null>(null)

  // Faculty search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [campusDropdownOpen, setCampusDropdownOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const selectedPin = pins.find((p) => p.id === selectedPinId) ?? null
  const routeTarget = pins.find((p) => p.id === routeTargetPinId) ?? null

  // Filter faculties for search dropdown
  const faculties = useFaculties()
  const filteredFaculties = useMemo(() => {
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const q = normalize(searchQuery.trim())
    const all = faculties
    if (!q) return all

    return all.filter((f) => {
      const name = i18n.language === 'en' ? f.name_en : f.name
      const campus = CAMPUSES.find((c) => c.id === f.campus_id)
      const campusName = campus ? campus.name : ''

      return normalize(name).includes(q) || normalize(campusName).includes(q)
    })
  }, [faculties, searchQuery, i18n.language])

  /**
   * Edificios y \u00e1reas que coinciden con la b\u00fasqueda.
   *
   * Los alias importan tanto como el nombre oficial: nadie busca "Edificio de
   * Astronom\u00eda", buscan "KAEA". Se limita a ocho para que el desplegable no
   * tape el mapa entero.
   */
  const searchResults = useMemo(() => {
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const q = normalize(searchQuery.trim())
    if (q.length < 2) return { buildings: [], areas: [] }

    const buildings = mapping.buildings
      .filter((b) =>
        [b.name, b.short_name ?? '', ...b.aliases].some((label) => normalize(label).includes(q)),
      )
      .slice(0, 5)

    const areas = mapping.areas
      .filter((a) => normalize(a.name).includes(q) || normalize(a.custom_kind ?? '').includes(q))
      .slice(0, 8)

    return { buildings, areas }
  }, [searchQuery, mapping])

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Reset scroll on visualViewport resize (e.g. Android soft keyboard show/hide)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const handleViewportResize = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0)
      }
    }
    vv.addEventListener('resize', handleViewportResize)
    vv.addEventListener('scroll', handleViewportResize)
    return () => {
      vv.removeEventListener('resize', handleViewportResize)
      vv.removeEventListener('scroll', handleViewportResize)
    }
  }, [])

  // Deep link handler para ?pin= y ?faculty=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pinParam = params.get('pin')
    const facultyParam = params.get('faculty')
    let matched = false

    if (pinParam && pins.length > 0) {
      const exists = pins.find((p) => p.id === pinParam)
      if (exists && selectedPinId !== pinParam) {
        selectPin(pinParam)
        matched = true
      }
    } else if (facultyParam) {
      const exists = faculties.find((f) => f.id === facultyParam)
      if (exists) {
        useUIStore.getState().selectFaculty(facultyParam)
        matched = true
      }
    }

    if (matched) {
      // Limpiamos la URL para evitar re-selecciones si el usuario lo cierra manualmente
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [faculties, pins, selectedPinId, selectPin])

  /**
   * Vuela al centro de un edificio o un área encontrada en la búsqueda.
   *
   * Se entra con zoom 19: por debajo del umbral indoor el mapa no reconocería
   * que está dentro del edificio y el resultado sería aterrizar encima sin ver
   * nada. Si el área tiene planta, se activa esa.
   */
  const handleSelectMapped = (polygon: Polygon, facultyId: string, floor?: number | null) => {
    const [lng, lat] = polygonCentroid(polygon)
    setCampusId(faculties.find((f) => f.id === facultyId)?.campus_id ?? campusId)
    if (floor !== undefined && floor !== null) {
      useUIStore.getState().setActiveMappingFaculty(facultyId, floor)
    }
    window.dispatchEvent(new CustomEvent('faculty-flyto', { detail: { lat, lng, zoom: 19 } }))
    setSearchQuery('')
    setSearchOpen(false)
  }

  const handleSelectFaculty = (faculty: Faculty) => {
    setCampusId(faculty.campus_id)
    // Abre la ficha de la facultad con sus posts, igual que al tocar el
    // perímetro en el mapa. Sin esto, el buscador solo hacía flyTo y la
    // persona tenía que volver a tocar el mapa para ver el contenido.
    useUIStore.getState().selectFaculty(faculty.id)
    window.dispatchEvent(
      new CustomEvent('faculty-flyto', { detail: { lat: faculty.lat, lng: faculty.lng } })
    )
    setSearchQuery('')
    setSearchOpen(false)
  }

  // ── Calcular ruta (una sola vez al activar / cambiar modo accesible) ─────
  // Industry standard: calcular ruta al inicio, no recalcular en cada update
  // de GPS. El usuario sigue la ruta visualmente; recalculamos sólo si el
  // destino cambia o el usuario pulsa explícitamente el botón de recalcular.
  useEffect(() => {
    let cancelled = false

    if (!routeTarget) {
      setRoute(null)
      routeOriginRef.current = null
      return
    }

    const calculate = async () => {
      let currentLoc: LatLng | null = null
      try {
        currentLoc = await requestLocation()
      } catch (err) {
        const error = err as Error
        if (error.message === 'PERMISSION_DENIED') {
          showToast('Debes activar la ubicación en tu dispositivo o navegador.')
        } else {
          showToast('No se pudo obtener tu ubicación.')
        }
        setRouteTarget(null)
        return
      }

      if (cancelled) return

      const campus = CAMPUSES.find((c) => c.id === campusId) ?? CAMPUSES[0]
      let origin = { lat: campus.lat, lng: campus.lng }

      if (currentLoc) {
        const adminMapUnlocked = role === 'admin' && useUIStore.getState().devUnlockMap
        if (!adminMapUnlocked && isLocationOutOfBounds(currentLoc.lat, currentLoc.lng)) {
          showToast(t('map.outOfBounds', 'Estás demasiado lejos del campus para trazar una ruta a pie.'))
          setRouteTarget(null)
          return
        }
        origin = currentLoc
      }

      routeOriginRef.current = origin

      try {
        const r = await getWalkingRoute(origin, { lat: routeTarget.lat, lng: routeTarget.lng }, accessibleRoute)
        if (!cancelled) setRoute(r)
      } catch {
        if (!cancelled) {
          setRoute(null)
          showToast(t('pin.routeError'))
        }
      }
    }

    calculate()

    return () => {
      cancelled = true
    }
  // IMPORTANT: Only recalculate when the TARGET or accessible mode changes.
  // Do NOT include userLocation/requestLocation here — that would re-fire on
  // every GPS update and burn the ORS quota (the original bug).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeTarget?.id, accessibleRoute])

  const movePin = useMutation({
    mutationFn: ({ lat, lng }: { lat: number; lng: number }) => {
      if (!movingPinId) throw new Error('No pin to move')
      return updatePinLocation(movingPinId, lat, lng)
    },
    onSuccess: () => {
      showToast(t('pin.moved', 'Pin reubicado correctamente'))
      cancelMovingPin()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error)
      showToast(message.includes('PIN_LOCATION_OCCUPIED')
        ? t('pin.locationOccupied')
        : t('common.error'))
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['pins'] }),
  })

  const confirmPlacement = () => {
    const center = getMapCenter()
    if (!center) return

    // Al mover, se compara contra la planta que el pin ya tiene; al crear,
    // contra la planta que se está mirando en el mapa.
    const floor = movingPinId
      ? (pins.find((p) => p.id === movingPinId)?.floor ?? null)
      : useUIStore.getState().activeFloor

    if (isPinLocationOccupied(pins, center.lat, center.lng, floor, movingPinId)) {
      showToast(t('pin.locationOccupied'))
      return
    }

    if (movingPinId) {
      movePin.mutate(center)
      return
    }

    useUIStore.getState().setDraftLocation(center)
  }

  const onCreateClick = () => {
    if (!guard('pin.create.report')) return
    startPickingLocation()
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapView
        pins={pins}
        route={route}
        userLocation={userLocation}
        userHeading={userHeading}
        isTrackingLocation={isTracking}
        onRequestLocation={requestLocation}
      />

      {/* ── TOP HUD ─────────────────────────────────────── */}
      {!pickingLocation && !movingPinId && (
        <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none px-3 pb-3 pt-safe-hud sm:px-5 sm:pb-5 flex flex-col gap-2">
          {/* Top Bar: Search (Left) + Bell & Sidebar (Right) */}
          <div className="flex items-start justify-between gap-2.5 w-full pointer-events-auto">
            {/* Search Input on Left */}
            <div className="flex-1 max-w-xs sm:max-w-md relative z-40" ref={searchRef}>
              <div className="glass-hud h-10 rounded-full premium-shadow flex items-center gap-2 px-3.5 w-full">
                <Search size={18} className="text-neutral-400 flex-shrink-0" strokeWidth={2} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setSearchOpen(true)
                  }}
                  onFocus={() => {
                    setSearchOpen(true)
                    selectPin(null)
                  }}
                  onBlur={() => {
                    window.scrollTo(0, 0)
                  }}
                  placeholder={t('map.searchFaculty', 'Buscar facultad...')}
                  className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none truncate"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setSearchOpen(false) }}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Search Dropdown */}
              {searchOpen && (
                <div className="absolute top-14 left-0 right-0 glass-hud rounded-2xl premium-shadow animate-scale-in overflow-hidden">
                  {filteredFaculties.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto p-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                      {filteredFaculties.map((f) => {
                        const campus = CAMPUSES.find((c) => c.id === f.campus_id)
                        return (
                          <button
                            key={f.id}
                            onClick={() => handleSelectFaculty(f)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60 active:scale-[0.98] cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-xl bg-[#D41F2D]/10 flex items-center justify-center flex-shrink-0">
                              <MapPin size={14} className="text-[#D41F2D]" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[12px] font-extrabold text-neutral-800 dark:text-neutral-200 leading-snug">
                                {i18n.language === 'en' ? f.name_en : f.name}
                              </span>
                              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                                {campus?.name ?? ''}
                              </span>
                            </div>
                          </button>
                        )
                      })}

                      {/* Edificios y áreas del mapeo interior. Van debajo de las
                          facultades porque son más específicos: quien escribe
                          "ingeniería" quiere la facultad, no una de sus salas. */}
                      {(searchResults.buildings.length > 0 || searchResults.areas.length > 0) && (
                        <div className="mt-1 border-t border-neutral-200/60 pt-1 dark:border-neutral-700/60">
                          {searchResults.buildings.map((b) => (
                            <SearchRow
                              key={b.id}
                              icon={<Building2 size={14} className="text-neutral-500" strokeWidth={2.5} />}
                              title={b.name}
                              subtitle={b.aliases[0] ?? 'Edificio'}
                              onClick={() => handleSelectMapped(b.footprint, b.faculty_id)}
                            />
                          ))}
                          {searchResults.areas.map((a) => (
                            <SearchRow
                              key={a.id}
                              icon={<MapPin size={14} className="text-neutral-500" strokeWidth={2.5} />}
                              title={a.name}
                              subtitle={a.custom_kind ?? AREA_STYLES[a.kind].label}
                              onClick={() => handleSelectMapped(a.polygon, a.faculty_id, a.floor)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : searchResults.buildings.length > 0 || searchResults.areas.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto p-2">
                      {searchResults.buildings.map((b) => (
                        <SearchRow
                          key={b.id}
                          icon={<Building2 size={14} className="text-neutral-500" strokeWidth={2.5} />}
                          title={b.name}
                          subtitle={b.aliases[0] ?? 'Edificio'}
                          onClick={() => handleSelectMapped(b.footprint, b.faculty_id)}
                        />
                      ))}
                      {searchResults.areas.map((a) => (
                        <SearchRow
                          key={a.id}
                          icon={<MapPin size={14} className="text-neutral-500" strokeWidth={2.5} />}
                          title={a.name}
                          subtitle={a.custom_kind ?? AREA_STYLES[a.kind].label}
                          onClick={() => handleSelectMapped(a.polygon, a.faculty_id, a.floor)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400 text-center py-6">
                      {t('map.noResults', 'Sin resultados')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Top Right Actions: Bell + Menu (aligned with Sidebar right edge!) */}
            <div className="flex items-center gap-2 flex-shrink-0 z-40">
              {/* Notification Bell Button */}
              <button
                type="button"
                onClick={openNotifications}
                className="relative w-10 h-10 rounded-full glass-hud premium-shadow flex items-center justify-center transition-transform active:scale-90 flex-shrink-0 cursor-pointer"
                aria-label={t('sidebar.notifications', 'Notificaciones')}
              >
                <Bell size={18} className="text-neutral-700 dark:text-neutral-300" strokeWidth={2.2} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-[#D41F2D] border-2 border-white dark:border-neutral-900 text-white text-[9px] font-black leading-none flex items-center justify-center px-1 shadow-sm">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Sidebar Button */}
              <button
                type="button"
                onClick={openSidebar}
                className="w-10 h-10 rounded-full glass-hud premium-shadow flex items-center justify-center transition-transform active:scale-90 flex-shrink-0 cursor-pointer"
                aria-label={t('sidebar.settings')}
              >
                <Menu size={18} className="text-neutral-700 dark:text-neutral-300" strokeWidth={2.5} />
              </button>
            </div>
          </div>
          
          <div className="pointer-events-auto self-start mt-1">
            <FiltersPanel />
          </div>
        </div>
      )}

      {/* Selector de plantas: aparece al entrar en una facultad mapeada. */}
      {!pickingLocation && !movingPinId && !selectedPin && <FloorSelector />}

      {/* ── PLACEMENT MODE ──────────────────────────────── */}
      {(pickingLocation || movingPinId) && (
        <>
          {/* Center crosshair (user drags map under it) */}
          <div className="absolute inset-0 z-[500] pointer-events-none flex items-center justify-center">
            <div className="relative flex flex-col items-center -mt-10">
              <div className="reticle-float flex flex-col items-center">
                <div
                  className="bg-[#D41F2D] border-[2.5px] border-white flex items-center justify-center shadow-[0_8px_32px_rgba(212,31,45,0.45)]"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50% 50% 50% 0',
                    transform: 'rotate(-45deg)', // Rotate so the point faces exactly DOWN
                  }}
                >
                  <div className="w-3.5 h-3.5 bg-white rounded-full" style={{ transform: 'rotate(45deg)' }} />
                </div>
              </div>
              <div className="relative w-8 h-2 -mt-0.5">
                <div className="absolute inset-0 bg-[#D41F2D] rounded-full opacity-20 blur-[3px]" />
                <div className="absolute inset-[-4px] bg-[#D41F2D] rounded-full reticle-pulse-ring" />
              </div>
            </div>
          </div>

          {/* Placement bottom sheet */}
          <div className="absolute bottom-4 left-3 right-3 z-30 animate-fade-up sm:left-auto sm:right-4 sm:w-96">
            <div className="glass-hud p-5 rounded-[22px] shadow-3xl flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${movingPinId ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500' : 'bg-red-50 dark:bg-red-900/30 text-[#D41F2D]'} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <MapPin size={20} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-neutral-900 dark:text-white tracking-tight">
                    {movingPinId ? t('pin.relocateTitle', 'Reubicar pin') : t('pin.pickLocation')}
                  </span>
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">
                    {movingPinId ? t('pin.relocateHint', 'Mueve el mapa para reubicar este pin') : t('pin.pickLocationHint', 'Mueve el mapa para ajustar la ubicación')}
                  </span>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    if (movingPinId) cancelMovingPin()
                    else cancelPickingLocation()
                  }}
                  className="flex-1 h-12 bg-neutral-100/60 dark:bg-neutral-800 text-neutral-500 rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmPlacement}
                  disabled={movePin.isPending}
                  className={`flex-[2] h-12 ${movingPinId ? 'bg-blue-600 shadow-[0_8px_24px_-8px_rgba(37,99,235,0.4)]' : 'bg-[#D41F2D] red-shadow'} text-white rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
                >
                  {movingPinId
                    ? (movePin.isPending ? <Loader2 size={16} className="animate-spin" /> : t('pin.confirmMove', 'Guardar ubicación'))
                    : t('pin.confirmLocation', 'Confirmar ubicación')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── ROUTE INFO BAR ──────────────────────────────── */}
      {route && routeTarget && (
        <div className="pointer-events-auto absolute bottom-20 left-3 right-3 z-20 sm:left-auto sm:right-4 sm:w-96">
          <div className="glass-hud rounded-2xl premium-shadow px-4 py-3 flex items-center gap-3">
            <span className="font-semibold text-sm text-neutral-900 dark:text-white">
              {t('pin.routeInfo', {
                distance: formatDistance(route.distanceMeters),
                minutes: Math.max(1, Math.round(route.durationSeconds / 60)),
              })}
            </span>
            {route.source === 'fallback' && (
              <span className="text-xs text-neutral-500">{t('pin.routeApprox')}</span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setAccessibleRoute(!accessibleRoute)}
                aria-pressed={accessibleRoute}
                title={t('pin.accessibleRoute')}
                aria-label={t('pin.accessibleRoute')}
                className={`rounded-full p-1.5 ${accessibleRoute
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                  : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
              >
                <Accessibility size={16} />
              </button>
              <button
                onClick={() => setRouteTarget(null)}
                aria-label={t('common.close')}
                className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FAB: Create pin ───────────────────────────── */}
      {!pickingLocation && !movingPinId && !selectedPin && !selectedFacultyId && !routeTarget && (
        <div className="absolute bottom-[4.5rem] right-4 z-30">
          <button
            onClick={onCreateClick}
            aria-label={t('pin.create')}
            className="w-12 h-12 bg-[#D41F2D] text-white rounded-full red-shadow flex items-center justify-center transition-transform active:scale-90"
          >
            <Plus size={28} strokeWidth={3} />
          </button>
        </div>
      )}

      {/* ── HUD Controls (Campus + 2D/3D Selectors) ───────────────────────────── */}
      {!pickingLocation && !movingPinId && !selectedPin && !selectedFacultyId && !routeTarget && (
        <>
          {/* Campus Selector Dropdown (Left) */}
          <div className="absolute bottom-5 left-3 sm:left-4 z-30 transition-all duration-300">
            <div className="relative">
              <button
                onClick={() => setCampusDropdownOpen(!campusDropdownOpen)}
                className="flex items-center gap-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-neutral-100 dark:border-neutral-800 text-[11px] font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200 transition-all duration-200 active:scale-95 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <span>Sede: {campusId === 'ejercito' ? 'Centro' : campusId === 'republica' ? 'República' : 'Huechuraba'}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${campusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {campusDropdownOpen && (
                <>
                  {/* Backdrop to close when clicking outside */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setCampusDropdownOpen(false)}
                  />
                  
                  {/* Pop up menu (above the button) - Aligned to left */}
                  <div className="absolute bottom-full mb-2 left-0 z-50 w-44 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl border border-neutral-100 dark:border-neutral-800 flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {CAMPUSES.map((c) => {
                      const displayName = c.id === 'ejercito' ? 'Centro' : c.id === 'republica' ? 'República' : 'Huechuraba'
                      const isActive = campusId === c.id
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            handleSelectCampus(c.id)
                            setCampusDropdownOpen(false)
                          }}
                          className={`w-full text-left px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            isActive
                              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md'
                              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-white'
                          }`}
                        >
                          {displayName}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 2D / 3D Selector (Right) */}
          <div className="absolute bottom-5 right-3 sm:right-4 z-30 transition-all duration-300">
            <div className="flex items-center gap-1 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md p-1 rounded-2xl shadow-xl border border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setViewMode('2d')}
                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer ${
                  viewMode === '2d'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md scale-105'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                2D
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer ${
                  viewMode === '3d'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md scale-105'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                3D
              </button>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {selectedPin && (
          <PinDetail key="pin-detail" pin={selectedPin} isFavorite={favoriteIds.has(selectedPin.id)} userLocation={userLocation} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        <FacultyDetail key="faculty-detail" />
      </AnimatePresence>
      <CreatePinModal />
      <TutorialModal />
      <ProfileSetupModal />
    </div>
  )
}
