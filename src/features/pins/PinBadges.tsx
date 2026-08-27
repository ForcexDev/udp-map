import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, Clock, User, Flag, MapPin } from 'lucide-react'
import { PublicProfileModal } from '@/features/profile/PublicProfileModal'
import type { Pin } from '@/shared/types/database'
import { expiryState } from '@/shared/utils/expiry'
import { eventPhase } from '@/shared/utils/eventState'
import { useNowTick } from '@/shared/lib/useNowTick'
import { relativeTime, relativeTimeKey } from '@/shared/utils/datetime'

// Fallback en español por si falta la clave en el archivo de traducciones
// (evita mostrar literales como "time.inHours" o "pin.addedBy" en pantalla)
const UNIT_FALLBACK = { minute: 'min', hour: 'h', day: 'd' } as const

export function PinBadges({ pin }: { pin: Pin }) {
  const { t } = useTranslation()
  const [profileId, setProfileId] = useState<string | null>(null)
  const now = useNowTick()
  const expiry = expiryState(pin.expires_at, pin.is_permanent, now)
  const when = relativeTime(pin.expires_at ?? '')
  const { unit, value } = when
  const phase = pin.type === 'event' ? eventPhase(pin.starts_at, pin.ends_at, now) : null

  const TypeIcon = pin.type === 'place' ? MapPin : pin.type === 'event' ? Clock : Flag
  const typeLabel =
    pin.type === 'place'
      ? t('pin.typePlace', 'Lugar')
      : pin.type === 'event'
        ? t('pin.typeEvent', 'Evento')
        : t('pin.typeReport', 'Reporte')

  const whenText = t(relativeTimeKey(when), {
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

  // En vivo: va en la línea de identidad, pegado al tipo, porque es lo primero
  // que hay que saber del evento. Mismo punto latiendo que el marcador del mapa.
  if (phase === 'live') {
    badges.push(
      <div
        key="live"
        className="flex items-center gap-1.5 rounded-full bg-[#D41F2D] px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
        {t('events.live', 'En vivo')}
      </div>
    )
  }

  // Expiración (solo si no es permanente y no es evento)
  if (!pin.is_permanent && pin.type !== 'event' && expiry.remainingMs !== null && pin.expires_at) {
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
    const entityName = pin.official_entity_name || 'Administración UDP'
    badges.push(
      <div key="off" className="flex items-center gap-1">
        <BadgeCheck size={14} className="text-blue-500" />
        <span className="text-neutral-700 dark:text-neutral-300">
          {t('pin.addedBy', 'Añadido por:')}{' '}
          <span className="text-[#D41F2D] font-bold">{entityName}</span>
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

    if (pin.verifier_entity_name || (pin.is_permanent && !pin.is_official)) {
      const verifierName = pin.verifier_entity_name || 'Centro de Alumnos UDP'
      badges.push(
        <div key="verified" className="flex items-center gap-1">
          <BadgeCheck size={14} className="text-blue-500" />
          <span className="text-neutral-700 dark:text-neutral-300">
            {t('pin.verifiedByLabel', 'Verificado por:')}{' '}
            <span className="text-[#D41F2D] font-bold">{verifierName}</span>
          </span>
        </div>
      )
    }
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