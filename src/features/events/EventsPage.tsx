import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/shared/stores/uiStore'
import { usePins } from '@/features/pins/usePins'
import { useUserRSVPs, useSetRSVP } from './useEvents'
import { useGuard } from '@/features/auth/useGuard'
import { EventCalendar } from './EventCalendar'

import type { Pin } from '@/shared/types/database'

export function EventsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const startPickingLocation = useUIStore((s) => s.startPickingLocation)
  const selectPin = useUIStore((s) => s.selectPin)
  const guard = useGuard()
  
  const { pins, isLoading, error } = usePins()
  const { data: userRSVPs = [] } = useUserRSVPs()
  const rsvpMutation = useSetRSVP()

  const events = pins.filter((p) => p.type === 'event')

  const handleCreateEvent = () => {
    if (!guard('pin.create.event')) return
    // Start the map selection workflow
    startPickingLocation()
    navigate('/mapa')
  }

  const handleSelectEvent = (event: Pin) => {
    selectPin(event.id)
    navigate('/mapa')
  }

  const handleRSVPChange = (pinId: string, status: 'going' | 'interested' | null) => {
    rsvpMutation.mutate({ pinId, status })
  }

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 pb-16">
      <div className="mx-auto w-full max-w-6xl px-4 pt-safe-page">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
          <div className="pr-2">
            <h1 className="text-2xl font-black text-neutral-900 dark:text-white">
              {t('events.title', 'Eventos')}
            </h1>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Descubre y asiste a las actividades de los campus UDP
            </p>
          </div>
          <button
            onClick={handleCreateEvent}
            className="flex items-center justify-center sm:justify-start shrink-0 gap-1.5 bg-[#D41F2D] text-white hover:bg-[#b11a25] font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer w-full sm:w-auto"
          >
            <Plus size={16} />
            {t('events.createEvent', 'Crear Evento')}
          </button>
        </div>

        {/* Loading and Error States */}
        {isLoading && (
          <div className="flex h-64 items-center justify-center text-sm font-semibold text-neutral-500">
            {t('common.loading')}
          </div>
        )}

        {error && (
          <div className="flex h-64 items-center justify-center text-sm font-semibold text-red-500">
            {t('common.error')}
          </div>
        )}

        {!isLoading && !error && (
          <EventCalendar
            events={events}
            userRSVPs={userRSVPs}
            onRSVPChange={handleRSVPChange}
            onSelectEvent={handleSelectEvent}
          />
        )}
      </div>
    </div>
  )
}
