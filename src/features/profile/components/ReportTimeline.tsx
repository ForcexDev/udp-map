import { useTranslation } from 'react-i18next'
import { ReportCardWithVote } from './ReportCardWithVote'
import { FACULTIES } from '@/shared/data/campusData'
import { relativeTime } from '@/shared/utils/datetime'
import type { Pin } from '@/shared/types/database'

interface ReportTimelineProps {
  pins: Pin[]
  loading: boolean
  onViewOnMap: (pin: Pin) => void
}

const AGO_KEY = { minute: 'agoMinutes', hour: 'agoHours', day: 'agoDays' } as const

export function ReportTimeline({ pins, loading, onViewOnMap }: ReportTimelineProps) {
  const { t, i18n } = useTranslation()

  return (
    <div>
      <div className="flex justify-between items-baseline mx-[22px] mt-5 mb-1.5">
        <h2 className="font-display text-[11.5px] font-semibold text-neutral-500 dark:text-profile-faint uppercase tracking-[0.08em] m-0">
          Historial de reportes
        </h2>
        <span className="font-mono text-[12px] text-neutral-500 dark:text-profile-faint">
          {pins.length} en total
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#D41F2D] dark:border-profile-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pins.length === 0 ? (
        <div className="mx-[22px] mt-[30px] py-[36px] text-center border-t border-neutral-200 dark:border-profile-line">
          <p className="text-[13px] text-neutral-500 dark:text-profile-faint m-0">
            {t('profile.noReports', 'No hay reportes')}
          </p>
        </div>
      ) : (
        <div className="report-timeline mx-[22px] mb-8">
          {pins.map((pin) => {
            const faculty = pin.faculty_id ? FACULTIES.find((f) => f.id === pin.faculty_id) : null
            const facultyName = faculty ? (i18n.language === 'en' ? faculty.name_en : faculty.name) : null
            const rel = relativeTime(pin.created_at)
            const timeAgo = t(`time.${AGO_KEY[rel.unit]}`, { n: rel.value, defaultValue: `hace ${rel.value} ${rel.unit}` })
            
            return (
              <ReportCardWithVote
                key={pin.id}
                pin={pin}
                title={pin.title}
                description={pin.description}
                authorName="Tú"
                authorAvatarUrl={null}
                timeAgo={timeAgo}
                location={facultyName}
                photoUrl={pin.pin_photos?.[0]?.url}
                photoCount={pin.pin_photos?.length}
                showTimeline={true}
                onViewOnMap={() => onViewOnMap(pin)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
