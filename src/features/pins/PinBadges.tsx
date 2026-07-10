import { useTranslation } from 'react-i18next'
import { Lock, BadgeCheck, Clock } from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import { Badge } from '@/shared/ui/Badge'
import { expiryState } from '@/shared/utils/expiry'
import { relativeTime } from '@/shared/utils/datetime'
import { categoryById } from '@/shared/data/campusData'

const UNIT_KEY = { minute: 'Minutes', hour: 'Hours', day: 'Days' } as const

export function PinBadges({ pin }: { pin: Pin }) {
  const { t } = useTranslation()
  const category = categoryById(pin.category_id)
  const expiry = expiryState(pin.expires_at, pin.is_permanent)

  const typeLabel =
    pin.type === 'place'
      ? t('pin.typePlace')
      : pin.type === 'event'
        ? t('pin.typeEvent')
        : t('pin.typeReport')

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone="udp">{typeLabel}</Badge>
      {category && (
        <Badge tone="blue">
          {category.svgPath ? (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
              <path d={category.svgPath} />
            </svg>
          ) : (
            <span className="text-[10px]">{category.emoji}</span>
          )}
          {' '}{category.name}
        </Badge>
      )}
      {pin.is_permanent && (
        <Badge tone="green">
          <Lock size={12} /> {t('pin.permanent')}
        </Badge>
      )}
      {pin.is_official && (
        <Badge tone="green">
          <BadgeCheck size={12} /> {t('pin.official')}
        </Badge>
      )}
      {expiry.remainingMs !== null && pin.expires_at && (
        <Badge tone={expiry.status === 'fading' ? 'amber' : 'neutral'}>
          <Clock size={12} />
          {expiry.status === 'expired'
            ? t('pin.expired')
            : t('pin.expiresIn', {
                when: t(`time.in${UNIT_KEY[relativeTime(pin.expires_at).unit]}`, {
                  n: relativeTime(pin.expires_at).value,
                }),
              })}
        </Badge>
      )}
    </div>
  )
}
