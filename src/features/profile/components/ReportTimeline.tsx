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
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="m-0 text-xs font-bold text-stone-500 dark:text-stone-400">
          {t('profile.activePosts', 'Publicaciones activas')}
        </h2>
        <span className="text-xs font-semibold text-stone-400 dark:text-stone-500">
          {t('profile.total', { n: pins.length, defaultValue: `${pins.length} total` })}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C22B38] border-t-transparent dark:border-[#D93846]" />
        </div>
      ) : pins.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-[#E6E0D5] bg-white px-6 py-12 text-center shadow-xs dark:border-white/[0.07] dark:bg-[#1E222D]">
          <MapPinned size={36} strokeWidth={1.5} className="text-stone-300 dark:text-stone-600" />
          <p className="m-0 mt-1 text-xs font-medium text-stone-500 dark:text-stone-400">
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
