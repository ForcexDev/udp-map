import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal, Star, X } from 'lucide-react'
import { useFilterStore } from '@/shared/stores/filterStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { CATEGORIES, FACULTIES } from '@/shared/data/campusData'
import { useGuard } from '@/features/auth/useGuard'
import type { PinType } from '@/shared/types/database'

const TYPE_KEYS: { type: PinType; key: string }[] = [
  { type: 'place', key: 'filters.places' },
  { type: 'event', key: 'filters.events' },
  { type: 'report', key: 'filters.reports' },
]

export function FiltersPanel() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [facultyDropdownOpen, setFacultyDropdownOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const guard = useGuard()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (open && panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])
  const {
    types,
    categoryId,
    facultyId,
    onlyFavorites,
    toggleType,
    setCategoryId,
    setFacultyId,
    setOnlyFavorites,
    clear,
  } = useFilterStore()

  const reportCategories = CATEGORIES.filter((c) => c.kind === 'report')

  return (
    <div ref={panelRef} className="pointer-events-auto absolute left-3 top-[72px] z-20 sm:top-[80px]">
      {!open ? (
        <button
          onClick={() => {
            setOpen(true)
            useUIStore.getState().selectPin(null)
          }}
          aria-label={t('filters.title')}
          className="glass-hud flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-semibold premium-shadow active:scale-95 transition-transform"
        >
          <SlidersHorizontal size={16} />
          {t('filters.title')}
        </button>
      ) : (
        <div className="glass-hud w-72 max-h-[calc(100dvh-220px)] sm:max-h-[calc(100dvh-120px)] overflow-y-auto rounded-[22px] p-5 shadow-3xl animate-scale-in [&::-webkit-scrollbar]:hidden sm:[&::-webkit-scrollbar]:block sm:[&::-webkit-scrollbar]:w-1.5 sm:[&::-webkit-scrollbar-track]:bg-transparent sm:[&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:sm:[&::-webkit-scrollbar-thumb]:bg-neutral-600 sm:[&::-webkit-scrollbar-thumb]:rounded-full">
          <div className="mb-4 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-black tracking-tight">{t('filters.title')}</h2>
            <button
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
              className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X size={16} />
            </button>
          </div>

          <p className="mb-2 text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em]">
            {t('filters.types')}
          </p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {TYPE_KEYS.map(({ type, key }) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                aria-pressed={types.includes(type)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${types.includes(type)
                  ? 'bg-[#D41F2D] text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                  }`}
              >
                {t(key)}
              </button>
            ))}
          </div>

          <p className="mb-2 text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em]">
            {t('filters.category')}
          </p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategoryId(null)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${categoryId === null
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                }`}
            >
              {t('filters.allCategories')}
            </button>
            {reportCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${categoryId === c.id
                  ? 'text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                  }`}
                style={categoryId === c.id ? { background: c.color } : {}}
              >
                {c.svgPath ? (
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                    <path d={c.svgPath} />
                  </svg>
                ) : (
                  <span className="text-[10px]">{c.emoji}</span>
                )}
                {c.name}
              </button>
            ))}
          </div>

          <p className="mb-2 text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em]">
            {t('filters.faculty')}
          </p>
          <div className="relative mb-4">
            <button
              type="button"
              onClick={() => setFacultyDropdownOpen(!facultyDropdownOpen)}
              className="w-full rounded-xl border border-neutral-200 bg-white/60 dark:bg-neutral-800/60 dark:border-neutral-700 px-3 py-2 text-sm font-medium backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#D41F2D]/20 flex justify-between items-center transition-colors"
            >
              <span className="truncate">
                {facultyId
                  ? FACULTIES.find(f => f.id === facultyId)?.name ?? t('filters.allFaculties')
                  : t('filters.allFaculties')}
              </span>
              <svg
                className={`w-4 h-4 ml-2 transition-transform ${facultyDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {facultyDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl overflow-hidden animate-scale-in">
                <div className="max-h-48 overflow-y-auto p-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <button
                    onClick={() => {
                      setFacultyId(null)
                      setFacultyDropdownOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${facultyId === null
                      ? 'bg-[#D41F2D]/10 text-[#D41F2D] font-bold'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                      }`}
                  >
                    {t('filters.allFaculties')}
                  </button>
                  {FACULTIES.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setFacultyId(f.id)
                        setFacultyDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${facultyId === f.id
                        ? 'bg-[#D41F2D]/10 text-[#D41F2D] font-bold'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                        }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              if (!onlyFavorites && !guard('pin.favorite')) return
              setOnlyFavorites(!onlyFavorites)
            }}
            aria-pressed={onlyFavorites}
            className={`mb-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${onlyFavorites
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
              }`}
          >
            <Star size={14} fill={onlyFavorites ? 'currentColor' : 'none'} />
            {t('filters.onlyFavorites')}
          </button>

          <button
            onClick={clear}
            className="w-full text-center text-xs font-bold text-[#D41F2D] hover:underline"
          >
            {t('filters.clear')}
          </button>
        </div>
      )}
    </div>
  )
}
