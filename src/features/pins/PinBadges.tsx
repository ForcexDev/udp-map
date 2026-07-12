import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, BadgeCheck, Clock, User, Flag, MapPin } from 'lucide-react'
import { PublicProfileModal } from '@/features/profile/PublicProfileModal'
import type { Pin } from '@/shared/types/database'
import { expiryState } from '@/shared/utils/expiry'
import { relativeTime } from '@/shared/utils/datetime'

const UNIT_KEY = { minute: 'Minutes', hour: 'Hours', day: 'Days' } as const

// Fallback en español por si falta la clave en el archivo de traducciones
// (evita mostrar literales como "time.inHours" o "pin.addedBy" en pantalla)
const UNIT_FALLBACK = { minute: 'min', hour: 'h', day: 'd' } as const

export function PinBadges({ pin }: { pin: Pin }) {
  const { t } = useTranslation()
  const [profileId, setProfileId] = useState<string | null>(null)
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

  const badges = []

  // Tipo
  badges.push(
    <div key="type" className="flex items-center gap-1">
      <TypeIcon size={14} className="text-neutral-500" />
      <span>{typeLabel}</span>
    </div>
  )

  // Permanente o expiración
  if (pin.is_permanent) {
    badges.push(
      <div key="perm" className="flex items-center gap-1">
        <Lock size={14} className="text-emerald-600" />
        <span className="text-emerald-700 dark:text-emerald-400">{t('pin.permanent', 'Permanente')}</span>
      </div>
    )
  } else if (pin.type !== 'event' && expiry.remainingMs !== null && pin.expires_at) {
    badges.push(
      <div key="exp" className="flex items-center gap-1">
        <Clock size={14} className={expiry.status === 'fading' ? 'text-amber-500' : 'text-neutral-500'} />
        <span className={expiry.status === 'fading' ? 'text-amber-600 dark:text-amber-400' : ''}>
          {t('pin.expiresIn', { defaultValue: 'Expira en {{when}}', when: whenText })}
        </span>
      </div>
    )
  }

  // Quién lo añadió
  if (pin.is_official) {
    badges.push(
      <div key="off" className="flex items-center gap-1">
        <BadgeCheck size={14} className="text-blue-500" />
        <span className="text-neutral-700 dark:text-neutral-300">
          {t('pin.addedBy', 'Añadido por:')}{' '}
          <span className="text-[#D41F2D] font-bold">Administración UDP</span>
        </span>
      </div>
    )
  } else {
    badges.push(
      <button key="user" onClick={() => pin.creator_id && setProfileId(pin.creator_id)} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
        <User size={14} className="text-neutral-400" />
        <span className="text-neutral-500 hover:underline">{pin.creator_name || 'Estudiante UDP'}</span>
      </button>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-neutral-600 dark:text-neutral-400">
        {badges.map((badge, idx) => (
          <div key={badge.key} className="flex items-center gap-2">
            {badge}
            {idx < badges.length - 1 && (
              <span className="text-neutral-300 dark:text-neutral-700">|</span>
            )}
          </div>
        ))}
      </div>
      <PublicProfileModal userId={profileId} onClose={() => setProfileId(null)} />
    </>
  )
}