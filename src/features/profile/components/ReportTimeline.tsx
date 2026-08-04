import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { MapPinned } from 'lucide-react'
import { ReportCardWithVote } from './ReportCardWithVote'
import { fetchPinCommentCounts } from '../publicProfileApi'
import { FACULTIES, categoryById } from '@/shared/data/campusData'
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

  const pinIds = useMemo(() => pins.map((p) => p.id).sort(), [pins])

  const commentCountsQuery = useQuery({
    queryKey: ['pin-comment-counts', pinIds],
    queryFn: () => fetchPinCommentCounts(pinIds),
    enabled: pinIds.length > 0,
  })
  const commentCounts = commentCountsQuery.data ?? {}

  return (
    <div className="px-5 pb-6">
      <div className="flex justify-between items-baseline mb-3">
        <h2 className="text-[11px] font-black text-neutral-400 uppercase tracking-widest m-0">
          {t('profile.activePosts', 'Publicaciones activas')}
        </h2>
        <span className="text-[11px] font-bold text-neutral-400">
          {t('profile.total', { n: pins.length, defaultValue: `${pins.length} total` })}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#D41F2D] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pins.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 py-12 px-6 text-center shadow-sm">
          <MapPinned size={36} strokeWidth={1.5} className="text-neutral-300 dark:text-neutral-700" />
          <p className="text-[13px] font-bold text-neutral-500 dark:text-neutral-400 m-0 mt-1">
            {t('profile.noActivePosts', 'No hay publicaciones activas.')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {pins.map((pin) => {
            const faculty = pin.faculty_id ? FACULTIES.find((f) => f.id === pin.faculty_id) : null
            const facultyName = faculty ? (i18n.language === 'en' ? faculty.name_en : faculty.name) : null

            // Sin categoría (lugares y algunos eventos) la etiqueta cae al tipo
            // de pin, que es lo que muestran las badges del mapa.
            const category = categoryById(pin.category_id)
            const categoryLabel = category
              ? (i18n.language === 'en' ? category.name_en : category.name)
              : pin.type === 'place'
                ? t('pin.typePlace', 'Lugar')
                : pin.type === 'event'
                  ? t('pin.typeEvent', 'Evento')
                  : t('pin.typeReport', 'Reporte')

            const rel = relativeTime(pin.created_at)
            const timeAgo = t(`time.${AGO_KEY[rel.unit]}`, { n: rel.value, defaultValue: `hace ${rel.value} ${rel.unit}` })

            return (
              <ReportCardWithVote
                key={pin.id}
                pin={pin}
                title={pin.title}
                description={pin.description}
                categoryLabel={categoryLabel}
                categoryColor={category?.color ?? null}
                timeAgo={timeAgo}
                location={facultyName}
                photoUrl={pin.pin_photos?.[0]?.url}
                photoCount={pin.pin_photos?.length}
                commentCount={commentCounts[pin.id] ?? 0}
                onViewOnMap={() => onViewOnMap(pin)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
