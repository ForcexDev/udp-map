import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { DEMO_FLOOR_PLANS, FACULTIES } from '@/shared/data/campusData'

/** Selector edificio/piso para planos indoor (Dev A, Sprint 2). */
export function IndoorPanel() {
  const { t } = useTranslation()
  const facultyId = useUIStore((s) => s.indoorFacultyId)
  const floor = useUIStore((s) => s.indoorFloor)
  const setIndoor = useUIStore((s) => s.setIndoor)

  if (!facultyId) return null
  const plans = DEMO_FLOOR_PLANS.filter((fp) => fp.faculty_id === facultyId)
  if (plans.length === 0) return null
  const faculty = FACULTIES.find((f) => f.id === facultyId)

  return (
    <div className="pointer-events-auto absolute right-3 top-[136px] z-20 glass-hud rounded-[22px] p-4 shadow-3xl sm:top-[140px]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">{plans[0].building}</p>
          {faculty && <p className="text-[11px] text-neutral-500">{faculty.name}</p>}
        </div>
        <button
          onClick={() => setIndoor(null)}
          aria-label={t('indoor.exit')}
          className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {plans
          .sort((a, b) => b.floor - a.floor)
          .map((fp) => (
            <button
              key={fp.id}
              onClick={() => setIndoor(facultyId, fp.floor)}
              aria-pressed={fp.floor === floor}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                fp.floor === floor
                  ? 'bg-udp-700 text-white'
                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
              }`}
            >
              {t('indoor.floor', { n: fp.floor })}
            </button>
          ))}
      </div>
    </div>
  )
}
