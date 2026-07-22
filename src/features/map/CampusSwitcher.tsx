import { useTranslation } from 'react-i18next'
import { useUIStore } from '@/shared/stores/uiStore'
import { CAMPUSES } from '@/shared/data/campusData'
import { CustomSelect } from '@/shared/ui/CustomSelect'

export function CampusSwitcher() {
  const { t } = useTranslation()
  const campusId = useUIStore((s) => s.campusId)
  const setCampusId = useUIStore((s) => s.setCampusId)

  return (
    <CustomSelect
      options={CAMPUSES.map((c) => ({ value: c.id, label: c.name }))}
      value={campusId}
      onChange={(val) => setCampusId(val)}
      placeholder={t('map.campus')}
      buttonClassName="!px-3 !py-1.5 !text-xs sm:!text-sm"
    />
  )
}
