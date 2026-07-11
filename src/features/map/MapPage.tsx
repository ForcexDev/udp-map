import { useEffect, useState, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Accessibility, Menu, MapPin, Search, Loader2 } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { useSidebarStore } from '@/shared/stores/sidebarStore'
import { useGuard } from '@/features/auth/useGuard'
import { usePins } from '@/features/pins/usePins'
import { PinDetail } from '@/features/pins/PinDetail'
import { CreatePinModal } from '@/features/pins/CreatePinModal'
import { TutorialModal } from './TutorialModal'
import { ProfileSetupModal } from '@/features/auth/ProfileSetupModal'
import { updatePinLocation } from '@/features/pins/api'
import { CAMPUSES, FACULTIES, DEMO_FLOOR_PLANS } from '@/shared/data/campusData'
import { formatDistance, type LatLng } from '@/shared/utils/geo'
import { MapView, getMapCenter } from './MapView'
import { FacultyDetail } from './FacultyDetail'
import { FiltersPanel } from './FiltersPanel'
import { IndoorPanel } from './IndoorPanel'
import { getWalkingRoute, type WalkingRoute } from './routing'

function useUserLocation(): LatLng | null {
  const [loc, setLoc] = useState<LatLng | null>(null)
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLoc(null),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [])
  return loc
}

export function MapPage() {
  const { t, i18n } = useTranslation()
  const guard = useGuard()
  const { pins, favoriteIds } = usePins()
  // role was removed since it's unused
  const pickingLocation = useUIStore((s) => s.pickingLocation)
  const cancelPickingLocation = useUIStore((s) => s.cancelPickingLocation)
  const startPickingLocation = useUIStore((s) => s.startPickingLocation)
  const movingPinId = useUIStore((s) => s.movingPinId)
  const cancelMovingPin = useUIStore((s) => s.cancelMovingPin)
  const selectedPinId = useUIStore((s) => s.selectedPinId)
  const routeTargetPinId = useUIStore((s) => s.routeTargetPinId)
  const setRouteTarget = useUIStore((s) => s.setRouteTarget)
  const accessibleRoute = useUIStore((s) => s.accessibleRoute)
  const setAccessibleRoute = useUIStore((s) => s.setAccessibleRoute)
  const indoorFacultyId = useUIStore((s) => s.indoorFacultyId)
  const indoorFloor = useUIStore((s) => s.indoorFloor)
  const campusId = useUIStore((s) => s.campusId)
  const setCampusId = useUIStore((s) => s.setCampusId)
  const showToast = useUIStore((s) => s.showToast)
  const selectedFacultyId = useUIStore((s) => s.selectedFacultyId)
  const openSidebar = useSidebarStore((s) => s.open)
  const queryClient = useQueryClient()

  const userLocation = useUserLocation()
  const [route, setRoute] = useState<WalkingRoute | null>(null)

  // Faculty search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const selectedPin = pins.find((p) => p.id === selectedPinId) ?? null
  const routeTarget = pins.find((p) => p.id === routeTargetPinId) ?? null
  const floorPlan =
    DEMO_FLOOR_PLANS.find((fp) => fp.faculty_id === indoorFacultyId && fp.floor === indoorFloor) ??
    null

  // Filter faculties for search dropdown
  const filteredFaculties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const all = FACULTIES
    if (!q) return all
    return all.filter((f) => {
      const name = i18n.language === 'en' ? f.name_en : f.name
      return name.toLowerCase().includes(q)
    })
  }, [searchQuery, i18n.language])

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

  const handleSelectFaculty = (faculty: typeof FACULTIES[0]) => {
    setCampusId(faculty.campus_id)
    // Dispatch custom event for MapView to flyTo faculty coordinates
    window.dispatchEvent(
      new CustomEvent('faculty-flyto', { detail: { lat: faculty.lat, lng: faculty.lng } })
    )
    setSearchQuery('')
    setSearchOpen(false)
  }

  // Calcular ruta
  useEffect(() => {
    if (!routeTarget) {
      setRoute(null)
      return
    }
    const campus = CAMPUSES.find((c) => c.id === campusId) ?? CAMPUSES[0]
    const origin = userLocation ?? { lat: campus.lat, lng: campus.lng }
    let cancelled = false
    getWalkingRoute(origin, { lat: routeTarget.lat, lng: routeTarget.lng }, accessibleRoute)
      .then((r) => {
        if (!cancelled) setRoute(r)
      })
      .catch(() => {
        if (!cancelled) {
          setRoute(null)
          showToast(t('pin.routeError'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [routeTarget, accessibleRoute, userLocation, campusId, showToast, t])

  const movePin = useMutation({
    mutationFn: ({ lat, lng }: { lat: number; lng: number }) => {
      if (!movingPinId) throw new Error('No pin to move')
      return updatePinLocation(movingPinId, lat, lng)
    },
    onSuccess: () => {
      showToast(t('pin.moved', 'Pin reubicado correctamente'))
      cancelMovingPin()
    },
    onError: () => showToast(t('common.error')),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['pins'] }),
  })

  const onCreateClick = () => {
    if (!guard('pin.create.report')) return
    startPickingLocation()
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapView pins={pins} route={route} floorPlan={floorPlan} userLocation={userLocation} />

      {/* ── TOP HUD ─────────────────────────────────────── */}
      {!pickingLocation && !movingPinId && (
        <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none p-3 sm:p-5 flex flex-col gap-2">
          {/* Top Bar: Search + Sidebar */}
          <div className="flex items-center justify-between gap-2.5 w-full pointer-events-auto" ref={searchRef}>
            {/* Search Input */}
            <div className="flex-1 w-full relative md:max-w-md">
              <div className="glass-hud h-12 rounded-2xl premium-shadow flex items-center gap-2.5 px-3.5 w-full">
                <Search size={18} className="text-neutral-400 flex-shrink-0" strokeWidth={2} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setSearchOpen(true)
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder={t('map.searchFaculty', 'Buscar facultad en {{campus}}...', { campus: CAMPUSES.find((c) => c.id === campusId)?.name ?? '' })}
                  className="flex-1 bg-transparent text-sm font-semibold text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setSearchOpen(false) }}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
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
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60 active:scale-[0.98]"
                          >
                            <div className="w-8 h-8 rounded-xl bg-[#D41F2D]/10 flex items-center justify-center flex-shrink-0">
                              <MapPin size={14} className="text-[#D41F2D]" strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200 leading-tight truncate">
                                {i18n.language === 'en' ? f.name_en : f.name}
                              </span>
                              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                                {campus?.name ?? ''}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400 text-center py-6">
                      {t('map.noResults', 'Sin resultados')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar Button */}
            <button
              onClick={openSidebar}
              className="w-12 h-12 rounded-2xl glass-hud premium-shadow flex items-center justify-center transition-transform active:scale-90 flex-shrink-0"
              aria-label={t('sidebar.settings')}
            >
              <Menu size={20} className="text-neutral-700 dark:text-neutral-300" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {/* Filters Panel — hide during pin placement */}
      {!pickingLocation && !movingPinId && (
        <>
          <FiltersPanel />
          <IndoorPanel />
        </>
      )}

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
                  onClick={() => {
                    const center = getMapCenter()
                    if (center) {
                      if (movingPinId) {
                        movePin.mutate(center)
                      } else {
                        useUIStore.getState().setDraftLocation(center)
                      }
                    }
                  }}
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
      {!pickingLocation && !movingPinId && !selectedPin && !selectedFacultyId && (
        <div className="absolute bottom-4 left-4 z-30">
          <button
            onClick={onCreateClick}
            aria-label={t('pin.create')}
            className="w-12 h-12 bg-[#D41F2D] text-white rounded-full red-shadow flex items-center justify-center transition-transform active:scale-90"
          >
            <Plus size={28} strokeWidth={3} />
          </button>
        </div>
      )}

      {selectedPin && (
        <PinDetail pin={selectedPin} isFavorite={favoriteIds.has(selectedPin.id)} />
      )}
      <FacultyDetail />
      <CreatePinModal />
      <TutorialModal />
      <ProfileSetupModal />
    </div>
  )
}
