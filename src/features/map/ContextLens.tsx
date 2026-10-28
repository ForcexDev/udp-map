import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, FoldVertical, Layers, UnfoldVertical } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { facultyLevels, interiorBuildingIds, useMapping } from '@/features/mapping/useMapping'

export function ContextLens() {
  const { t } = useTranslation()
  const { mapping } = useMapping()

  const activeFacultyId = useUIStore((s) => s.activeFacultyId)
  const selectedFacultyId = useUIStore((s) => s.selectedFacultyId)
  const activeFloor = useUIStore((s) => s.activeFloor)
  const setActiveFloor = useUIStore((s) => s.setActiveFloor)
  const placeFocus = useUIStore((s) => s.placeFocus)
  const setPlaceFocus = useUIStore((s) => s.setPlaceFocus)
  const explodedFloors = useUIStore((s) => s.explodedFloors)
  const setExplodedFloors = useUIStore((s) => s.setExplodedFloors)

  const facultyId = selectedFacultyId ?? activeFacultyId
  const levels = useMemo(
    () => (facultyId ? facultyLevels(mapping, facultyId) : []),
    [mapping, facultyId],
  )

  const buildings = useMemo(() => {
    if (!facultyId) return []
    return mapping.buildings
      .filter((b) => b.faculty_id === facultyId)
      .map((b) => ({ id: b.id, label: b.short_name || b.name }))
  }, [mapping.buildings, facultyId])

  // Separar pisos solo tiene sentido con interior dibujado y más de una planta,
  // y en la facultad activa: es la que pinta la escena interior.
  const canExplode = useMemo(
    () =>
      activeFacultyId !== null &&
      facultyId === activeFacultyId &&
      levels.length >= 2 &&
      interiorBuildingIds(mapping, activeFacultyId).length > 0,
    [activeFacultyId, facultyId, levels.length, mapping],
  )

  // Ordenamos de menor a mayor (-1, 1, 2, 3) para lectura izquierda → derecha natural
  const sortedLevels = useMemo(() => [...levels].sort((a, b) => a.level - b.level), [levels])

  const floorTrackRef = useRef<HTMLDivElement | null>(null)
  const floorBtnRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = floorTrackRef.current
    if (!el) return
    const overflows = el.scrollWidth > el.clientWidth + 2
    setIsOverflowing(overflows)
    setCanScrollLeft(overflows && el.scrollLeft > 2)
    setCanScrollRight(overflows && el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    const el = floorTrackRef.current
    if (!el) return
    updateScrollState()
    const ro = new ResizeObserver(() => updateScrollState())
    ro.observe(el)
    el.addEventListener('scroll', updateScrollState, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', updateScrollState)
    }
  }, [updateScrollState, sortedLevels.length, buildings.length, facultyId])

  // Centrar automáticamente el piso activo dentro del carrusel cuando cambia
  useEffect(() => {
    if (activeFloor === null) return
    const btn = floorBtnRefs.current.get(activeFloor)
    const track = floorTrackRef.current
    if (!btn || !track) return
    const targetLeft = btn.offsetLeft - track.clientWidth / 2 + btn.clientWidth / 2
    track.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
  }, [activeFloor, facultyId])

  if (!facultyId || (levels.length < 2 && buildings.length === 0)) return null

  const scrollFloorsBy = (dir: -1 | 1) => {
    const el = floorTrackRef.current
    if (!el) return
    // Desplaza ~3 botones de planta por toque
    el.scrollBy({ left: dir * 114, behavior: 'smooth' })
  }

  const handleFloorWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = floorTrackRef.current
    if (!el || !isOverflowing) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
  }

  return (
    <div className="glass-hud premium-shadow pointer-events-auto flex items-center justify-between gap-2 rounded-2xl p-1.5">
      {/* Selector de Edificio (Izquierda) */}
      <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth pl-1.5">
        <Layers size={15} className="mr-1 shrink-0 text-stone-500 dark:text-stone-400" />
        <button
          type="button"
          onClick={() => setPlaceFocus(null)}
          className={`shrink-0 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
            placeFocus === null
              ? 'bg-stone-900 text-[#FAF8F5] shadow-xs dark:bg-stone-100 dark:text-stone-950'
              : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
          }`}
        >
          {t('common.all', 'Todos')}
        </button>

        {buildings.map((b) => {
          const isSelected = placeFocus?.kind === 'building' && placeFocus.id === b.id
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setPlaceFocus(isSelected ? null : { kind: 'building', id: b.id })}
              className={`shrink-0 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-stone-900 text-[#FAF8F5] shadow-xs dark:bg-stone-100 dark:text-stone-950'
                  : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
              }`}
            >
              {b.label}
            </button>
          )
        })}
      </div>

      {/* Divisor vertical capilar */}
      {sortedLevels.length >= 2 && (
        <div className="h-5 w-px shrink-0 bg-stone-300/80 dark:bg-white/10" />
      )}

      {/* Selector de Planta (Derecha): se convierte en carrusel cuando no da abasto */}
      {sortedLevels.length >= 2 && (
        <div
          className={`flex min-w-0 items-center gap-0.5 pr-0.5 ${
            buildings.length > 0 ? 'max-w-[52%] sm:max-w-[58%]' : 'max-w-full'
          }`}
        >
          {isOverflowing && (
            <button
              type="button"
              onClick={() => scrollFloorsBy(-1)}
              disabled={!canScrollLeft}
              aria-label={t('indoor.floorDown', 'Bajar un piso')}
              className="flex h-7 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg text-stone-500 transition-opacity hover:bg-[#EFECE4] hover:text-stone-900 disabled:pointer-events-none disabled:opacity-25 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-100"
            >
              <ChevronLeft size={14} strokeWidth={2.5} />
            </button>
          )}

          <div
            ref={floorTrackRef}
            onWheel={handleFloorWheel}
            className="no-scrollbar relative flex min-w-0 items-center gap-1 overflow-x-auto scroll-smooth snap-x snap-mandatory"
          >
            {sortedLevels.map((lvl) => {
              const isActive = activeFloor === lvl.level
              return (
                <button
                  key={lvl.level}
                  ref={(node) => {
                    if (node) floorBtnRefs.current.set(lvl.level, node)
                    else floorBtnRefs.current.delete(lvl.level)
                  }}
                  type="button"
                  onClick={() => setActiveFloor(isActive ? null : lvl.level)}
                  title={lvl.label ?? `Piso ${lvl.level}`}
                  className={`flex h-8 w-[34px] shrink-0 snap-center cursor-pointer items-center justify-center rounded-xl text-xs font-bold tabular-nums transition-all ${
                    isActive
                      ? 'border border-[#F2D0CE] bg-[#FBECEB] text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300'
                      : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                  }`}
                >
                  {lvl.level}
                </button>
              )
            })}
          </div>

          {canExplode && (
            <button
              type="button"
              onClick={() => {
                const next = !explodedFloors
                // La vista separada es 3D: en 2D el mapa no se inclina y los
                // pisos se verían uno encima de otro desde arriba.
                if (next) useUIStore.getState().setViewMode('3d')
                setExplodedFloors(next)
              }}
              aria-pressed={explodedFloors}
              aria-label={
                explodedFloors
                  ? t('indoor.joinFloors', 'Juntar pisos')
                  : t('indoor.separateFloors', 'Separar pisos')
              }
              title={
                explodedFloors
                  ? t('indoor.joinFloors', 'Juntar pisos')
                  : t('indoor.separateFloors', 'Separar pisos')
              }
              className={`order-last ml-0.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-all ${
                explodedFloors
                  ? 'bg-stone-900 text-[#FAF8F5] dark:bg-stone-100 dark:text-stone-950'
                  : 'text-stone-500 hover:bg-[#EFECE4] hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-100'
              }`}
            >
              {explodedFloors ? <FoldVertical size={15} /> : <UnfoldVertical size={15} />}
            </button>
          )}

          {isOverflowing && (
            <button
              type="button"
              onClick={() => scrollFloorsBy(1)}
              disabled={!canScrollRight}
              aria-label={t('indoor.floorUp', 'Subir un piso')}
              className="flex h-7 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg text-stone-500 transition-opacity hover:bg-[#EFECE4] hover:text-stone-900 disabled:pointer-events-none disabled:opacity-25 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-100"
            >
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
