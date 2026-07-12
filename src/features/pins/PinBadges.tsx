import { useTranslation } from 'react-i18next'
import { Lock, BadgeCheck, Clock, User, Flag, MapPin } from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import { expiryState } from '@/shared/utils/expiry'
import { relativeTime } from '@/shared/utils/datetime'

const UNIT_KEY = { minute: 'Minutes', hour: 'Hours', day: 'Days' } as const

// Fallback en español por si falta la clave en el archivo de traducciones
// (evita mostrar literales como "time.inHours" o "pin.addedBy" en pantalla)
const UNIT_FALLBACK = { minute: 'min', hour: 'h', day: 'd' } as const

export function PinBadges({ pin }: { pin: Pin }) {
  const { t } = useTranslation()
  const expiry = expiryState(pin.expires_at, pin.is_permanent)
  const { unit, value } = relativeTime(pin.expires_at ?? '')

  const TypeIcon = pin.type === 'place' ? MapPin : pin.type === 'event' ? Clock : Flag
  const typeLabel =
    pin.type === 'place'
      ? t('pin.typePlace', 'Lugar')
      : pin.type === 'event'
        ? t('pin.typeEvent', 'Evento')
        : t('pin.typeReport', 'Reporte')

  const whenText = t(`time.in${UNIT_KEY[unit]}`, {
    defaultValue: `{{n}} ${UNIT_FALLBACK[unit]}`,
    n: value,
  })

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-neutral-600 dark:text-neutral-400">
      {/* Tipo */}
      <div className="flex items-center gap-1">
        <TypeIcon size={14} className="text-neutral-500" />
        <span>{typeLabel}</span>
      </div>

      <span className="text-neutral-300 dark:text-neutral-700">|</span>

      {/* Permanente o expiración */}
      {pin.is_permanent ? (
        <div className="flex items-center gap-1">
          <Lock size={14} className="text-emerald-600" />
          <span className="text-emerald-700 dark:text-emerald-400">{t('pin.permanent', 'Permanente')}</span>
        </div>
      ) : expiry.remainingMs !== null && pin.expires_at ? (
        <div className="flex items-center gap-1">
          <Clock size={14} className={expiry.status === 'fading' ? 'text-amber-500' : 'text-neutral-500'} />
          <span className={expiry.status === 'fading' ? 'text-amber-600 dark:text-amber-400' : ''}>
            {t('pin.expiresIn', { defaultValue: 'Expira en {{when}}', when: whenText })}
          </span>
        </div>
      ) : null}

      <span className="text-neutral-300 dark:text-neutral-700">|</span>

      {/* Quién lo añadió */}
      {pin.is_official ? (
        <div className="flex items-center gap-1">
          <BadgeCheck size={14} className="text-blue-500" />
          <span>
            {t('pin.addedBy', 'Añadido por')}:{' '}
            <span className="text-blue-600 dark:text-blue-400">
              {t('pin.officialAdmin', 'Administración UDP')}
            </span>
          </span>
        </div>
      ) : pin.creator_name ? (
        <div className="flex items-center gap-1">
          <User size={14} className="text-neutral-500" />
          <span>
            {t('pin.addedBy', 'Añadido por')}:{' '}
            <span className="text-neutral-900 dark:text-neutral-200">{pin.creator_name}</span>
          </span>
        </div>
      ) : null}
    </div>
  )
}