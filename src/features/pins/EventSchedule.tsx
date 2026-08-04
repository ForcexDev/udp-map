import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { fetchPinSchedule } from './api'
import { useNowTick } from '@/shared/lib/useNowTick'
import type { PinScheduleItem } from '@/shared/types/database'

/** A partir de aquí el programa llega plegado: una lista larga tapa el resto. */
const COLLAPSE_THRESHOLD = 6

/**
 * 24 h siempre, como el resto de la app (ver formatEventDate en PinDetail).
 * Con el formato de 12 h, es-CL devuelve "10:30 a. m." y eso se partía en tres
 * líneas dentro de la columna de horas.
 */
function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Un bloque está en curso si ya empezó y no ha terminado. Sin `ends_at` se
 * toma el inicio del siguiente bloque; si es el último, se considera vigente
 * hasta el fin del evento (que ya limita PinDetail al mostrarlo).
 */
function currentIndex(items: PinScheduleItem[], now: number): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const start = new Date(items[i].starts_at).getTime()
    if (now < start) continue
    const end = items[i].ends_at
      ? new Date(items[i].ends_at as string).getTime()
      : items[i + 1]
        ? new Date(items[i + 1].starts_at).getTime()
        : Infinity
    return now < end ? i : -1
  }
  return -1
}

interface EventScheduleProps {
  pinId: string
  /** Solo se resalta el bloque en curso si el evento está ocurriendo. */
  isLive: boolean
}

export function EventSchedule({ pinId, isLive }: EventScheduleProps) {
  const { t } = useTranslation()
  const now = useNowTick()
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)

  const { data: items = [] } = useQuery({
    queryKey: ['pin-schedule', pinId],
    queryFn: () => fetchPinSchedule(pinId),
  })

  // Sin programa no hay sección: la mayoría de los eventos no tiene y no debe
  // pagar el espacio de un bloque vacío.
  if (items.length === 0) return null

  const open = manualOpen ?? items.length <= COLLAPSE_THRESHOLD
  const activeIndex = isLive ? currentIndex(items, now) : -1

  return (
    <div className="mt-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 p-3">
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-transparent border-none p-0 cursor-pointer text-left"
      >
        <h3 className="m-0 text-[12px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {t('pin.schedule', 'Programa')}
          <span className="ml-2 font-semibold normal-case tracking-normal text-neutral-400">
            {t('pin.scheduleBlocks', { count: items.length, defaultValue: `${items.length} bloques` })}
          </span>
        </h3>
        <ChevronDown
          size={16}
          className={`shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ol className="m-0 mt-3 list-none p-0 space-y-px">
          {items.map((item, i) => {
            const isNow = i === activeIndex
            return (
              <li
                key={item.id}
                className={`flex gap-3 rounded-lg px-2 py-2 ${
                  isNow ? 'bg-[#D41F2D]/10 dark:bg-[#D41F2D]/15' : ''
                }`}
              >
                <div className="w-[42px] shrink-0 pt-0.5 whitespace-nowrap">
                  <div
                    className={`text-[13px] font-black tabular-nums leading-none ${
                      isNow ? 'text-[#D41F2D] dark:text-red-400' : 'text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {hhmm(item.starts_at)}
                  </div>
                  {item.ends_at && (
                    <div className="mt-1 text-[11px] font-semibold tabular-nums leading-none text-neutral-400">
                      {hhmm(item.ends_at)}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="m-0 text-[14px] font-bold leading-snug text-neutral-800 dark:text-neutral-200">
                      {item.title}
                    </p>
                    {isNow && (
                      <span className="shrink-0 rounded-full bg-[#D41F2D] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                        {t('pin.scheduleNow', 'Ahora')}
                      </span>
                    )}
                  </div>
                  {item.subtitle && (
                    <p className="m-0 mt-0.5 text-[12.5px] leading-snug text-neutral-500 dark:text-neutral-400">
                      {item.subtitle}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
