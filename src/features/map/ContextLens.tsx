import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { facultyLevels, useMapping } from '@/features/mapping/useMapping'

export function ContextLens() {
  const { t } = useTranslation()
  const { mapping } = useMapping()

  const activeFacultyId = useUIStore((s) => s.activeFacultyId)
  const selectedFacultyId = useUIStore((s) => s.selectedFacultyId)
  const activeFloor = useUIStore((s) => s.activeFloor)
  const setActiveFloor = useUIStore((s) => s.setActiveFloor)
  const placeFocus = useUIStore((s) => s.placeFocus)
  const setPlaceFocus = useUIStore((s) => s.setPlaceFocus)

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

  if (!facultyId || (levels.length < 2 && buildings.length === 0)) return null

  // Ordenamos de menor a mayor (-1, 1, 2, 3) para lectura izquierda → derecha natural
  const sortedLevels = [...levels].sort((a, b) => a.level - b.level)

  return (
    <div className="glass-hud premium-shadow pointer-events-auto flex items-center justify-between gap-2 rounded-2xl p-1.5">
      {/* Selector de Edificio (Izquierda) */}
      <div className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto pl-1.5">
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
              onClick={() =>
                setPlaceFocus(isSelected ? null : { kind: 'building', id: b.id })
              }
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

      {/* Selector de Planta (Derecha) */}
      {sortedLevels.length >= 2 && (
        <div className="flex shrink-0 items-center gap-1 pr-0.5">
          {sortedLevels.map((lvl) => {
            const isActive = activeFloor === lvl.level
            return (
              <button
                key={lvl.level}
                type="button"
                onClick={() => setActiveFloor(isActive ? null : lvl.level)}
                title={lvl.label ?? `Piso ${lvl.level}`}
                className={`flex h-8 w-[34px] cursor-pointer items-center justify-center rounded-xl text-xs font-bold tabular-nums transition-all ${
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
      )}
    </div>
  )
}
