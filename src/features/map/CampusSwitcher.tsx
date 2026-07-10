import { useTranslation } from 'react-i18next'
import { useUIStore } from '@/shared/stores/uiStore'
import { CAMPUSES } from '@/shared/data/campusData'

export function CampusSwitcher() {
  const { t } = useTranslation()
  const campusId = useUIStore((s) => s.campusId)
  const setCampusId = useUIStore((s) => s.setCampusId)

  return (
    <select
      aria-label={t('map.campus')}
      value={campusId}
      onChange={(e) => setCampusId(e.target.value)}
      className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
    >
      {CAMPUSES.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}
