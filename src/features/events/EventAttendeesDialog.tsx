import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PublicProfileModal } from '@/features/profile/PublicProfileModal'
import { Check, Star, UserRound } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { dbErrorMessage, isUserFacingDbError } from '@/shared/utils/dbError'
import { useEventAttendees } from './useEvents'

interface EventAttendeesDialogProps {
  /** El evento del que se pide la lista, o null para no pedir nada. */
  pinId: string | null
  eventTitle: string
  onClose: () => void
}

/**
 * Quién va a un evento, para quien lo organiza.
 *
 * Hasta el 2026-08-26 esta lista no la veía nadie: `event_rsvps` era legible por
 * cualquiera —el agujero SEC-007— y aun así la aplicación no la enseñaba en
 * ninguna parte. Ahora la tabla está cerrada y la lista sale de `event_attendees`,
 * que comprueba en la base que quien pregunta sea el autor del evento. Si no lo
 * es, esto no enseña una lista vacía: enseña el porqué.
 */
export function EventAttendeesDialog({ pinId, eventTitle, onClose }: EventAttendeesDialogProps) {
  const { t } = useTranslation()
  const [profileId, setProfileId] = useState<string | null>(null)
  const { data: attendees = [], isPending, error } = useEventAttendees(pinId)

  const going = attendees.filter((a) => a.status === 'going')
  const interested = attendees.filter((a) => a.status === 'interested')

  return (
    <>
    <Dialog
      open={pinId !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t('events.attendeesTitle', 'Quién va')}
      description={eventTitle}
    >
      {error ? (
        <p className="text-sm font-medium text-red-500">
          {isUserFacingDbError(error) ? dbErrorMessage(error) : t('common.error')}
        </p>
      ) : isPending ? (
        <p className="text-sm text-neutral-500">{t('common.loading', 'Cargando…')}</p>
      ) : attendees.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {t('events.attendeesEmpty', 'Todavía no se ha apuntado nadie.')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <Group
            icon={<Check size={13} />}
            label={t('events.attendeesGoing', { count: going.length, defaultValue: `${going.length} van` })}
            people={going}
            accent="text-[#D41F2D]"
            onSelectPerson={setProfileId}
          />
          <Group
            icon={<Star size={13} />}
            label={t('events.attendeesInterested', {
              count: interested.length,
              defaultValue: `${interested.length} interesados`,
            })}
            people={interested}
            accent="text-neutral-500"
            onSelectPerson={setProfileId}
          />
        </div>
      )}
    </Dialog>

      <PublicProfileModal userId={profileId} onClose={() => setProfileId(null)} />
    </>
  )
}

interface GroupProps {
  icon: React.ReactNode
  label: string
  people: { user_id: string; name: string | null; avatar_url: string | null }[]
  accent: string
  onSelectPerson: (userId: string) => void
}

function Group({ icon, label, people, accent, onSelectPerson }: GroupProps) {
  const { t } = useTranslation()
  if (people.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className={`flex items-center gap-1.5 m-0 text-[11px] font-black uppercase tracking-[0.15em] ${accent}`}>
        {icon}
        {label}
      </h3>
      <ul className="m-0 flex flex-col gap-1.5 p-0 list-none">
        {people.map((person) => (
          <li key={person.user_id}>
            {/* La fila abre el perfil. `PublicProfileModal` ya existía —lo usa
                la tabla de líderes—, así que ver quién es alguien que va a tu
                evento no necesitaba pantalla nueva, solo enchufarla. */}
            <button
              type="button"
              onClick={() => onSelectPerson(person.user_id)}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
            {person.avatar_url ? (
              <img
                src={person.avatar_url}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
                <UserRound size={14} />
              </span>
            )}
            <span className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {person.name ?? t('common.noName', 'Sin nombre')}
            </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
