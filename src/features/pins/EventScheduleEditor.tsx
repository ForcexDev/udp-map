import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import { CustomTimePicker } from '@/shared/ui/CustomTimePicker'
import { daysBetween, emptyRow, MAX_SCHEDULE_ITEMS, type ScheduleRow } from './eventScheduleRows'

const FIELD =
  'w-full bg-neutral-50/70 dark:bg-neutral-800/70 border border-neutral-100 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm font-semibold text-neutral-800 dark:text-neutral-200 outline-none focus:ring-4 focus:ring-red-500/10 transition-all'

interface EventScheduleEditorProps {
  rows: ScheduleRow[]
  onChange: (rows: ScheduleRow[]) => void
  /** Valores del formulario ('YYYY-MM-DDTHH:mm'), no ISO. */
  eventStartsAt: string
  eventEndsAt: string
  error?: string | null
}

export function EventScheduleEditor({ rows, onChange, eventStartsAt, eventEndsAt, error }: EventScheduleEditorProps) {
  const { t, i18n } = useTranslation()

  const days = useMemo(() => daysBetween(eventStartsAt, eventEndsAt), [eventStartsAt, eventEndsAt])
  const defaultDay = days[0] ?? ''
  const isMultiDay = days.length > 1

  const update = (key: string, patch: Partial<ScheduleRow>) => {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const dayLabel = (day: string) =>
    new Date(`${day}T00:00`).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-CL', {
      day: 'numeric',
      month: 'short',
    })

  return (
    <div className="space-y-3">
      <div className="ml-1 flex items-baseline justify-between gap-3">
        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">
          {t('pin.schedule', 'Programa')}
          <span className="ml-1.5 font-bold normal-case tracking-normal text-neutral-300 dark:text-neutral-600">
            {t('common.optional', 'opcional')}
          </span>
        </label>
        {rows.length > 0 && (
          <span className="text-[11px] font-bold text-neutral-400">
            {rows.length}/{MAX_SCHEDULE_ITEMS}
          </span>
        )}
      </div>

      {!eventStartsAt ? (
        <p className="ml-1 text-xs font-semibold text-neutral-400">
          {t('pin.scheduleNeedsDates', 'Elige primero la fecha del evento para armar su programa.')}
        </p>
      ) : (
        <>
          {rows.length === 0 && (
            <p className="ml-1 text-xs font-medium leading-relaxed text-neutral-400">
              {t(
                'pin.scheduleHint',
                'Agrega los bloques del evento (“10:00 · Apertura”, “11:00 · Charla con…”). Si no pones ninguno, el evento se muestra igual.',
              )}
            </p>
          )}

          {rows.map((row) => (
            <div
              key={row.key}
              className="space-y-2.5 rounded-2xl border border-neutral-100 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900/40"
            >
              <div className="flex items-start gap-2">
                {/* El día va en su propia línea: en un móvil, tres controles en
                    fila dejan las horas sin espacio. */}
                <div className="min-w-0 flex-1 space-y-2">
                  {isMultiDay && (
                    <CustomSelect
                      options={days.map((d) => ({ value: d, label: dayLabel(d) }))}
                      value={row.day || defaultDay}
                      onChange={(day) => update(row.key, { day })}
                      buttonClassName="!rounded-xl !px-3 !py-2.5 text-sm font-semibold"
                    />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <CustomTimePicker
                      value={row.start}
                      onChange={(start) => update(row.key, { start })}
                      label={t('pin.scheduleStart', 'Hora de inicio')}
                    />
                    <CustomTimePicker
                      value={row.end}
                      onChange={(end) => update(row.key, { end })}
                      label={t('pin.scheduleEnd', 'Hora de término (opcional)')}
                      placeholder={t('pin.scheduleNoEnd', 'Sin fin')}
                      align="right"
                      clearable
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                  aria-label={t('pin.scheduleRemove', 'Quitar bloque')}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-red-50 hover:text-[#D41F2D] dark:hover:bg-red-950/30"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <input
                type="text"
                value={row.title}
                maxLength={120}
                onChange={(e) => update(row.key, { title: e.target.value })}
                placeholder={t('pin.scheduleTitlePlaceholder', 'Qué pasa en ese bloque')}
                className={FIELD}
              />
              <input
                type="text"
                value={row.subtitle}
                maxLength={160}
                onChange={(e) => update(row.key, { subtitle: e.target.value })}
                placeholder={t('pin.scheduleSubtitlePlaceholder', 'Quién lo hace o dónde (opcional)')}
                className={FIELD}
              />
            </div>
          ))}

          {error && <p className="ml-1 text-xs font-bold text-[#D41F2D]">{error}</p>}

          {rows.length < MAX_SCHEDULE_ITEMS && (
            <button
              type="button"
              onClick={() => onChange([...rows, emptyRow(defaultDay)])}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-200 py-3 text-xs font-bold text-neutral-500 transition-colors hover:border-[#D41F2D] hover:text-[#D41F2D] dark:border-neutral-700 dark:text-neutral-400"
            >
              {rows.length === 0 ? <CalendarClock size={15} /> : <Plus size={15} />}
              {rows.length === 0
                ? t('pin.scheduleAddFirst', 'Agregar programa')
                : t('pin.scheduleAdd', 'Agregar bloque')}
            </button>
          )}
        </>
      )}
    </div>
  )
}
