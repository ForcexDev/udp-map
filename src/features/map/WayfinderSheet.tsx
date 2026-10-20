import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Accessibility, Check } from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { useMapping } from '@/features/mapping/useMapping'
import { floorName } from '@/features/mapping/areaStyles'

interface WayfinderSheetProps {
  targetPin: Pin
  allPins: Pin[]
  durationSeconds?: number
  distanceMeters?: number
}

export function WayfinderSheet({
  targetPin,
  allPins,
  durationSeconds,
}: WayfinderSheetProps) {
  const { t } = useTranslation()
  const { mapping } = useMapping()

  const accessibleRoute = useUIStore((s) => s.accessibleRoute)
  const setAccessibleRoute = useUIStore((s) => s.setAccessibleRoute)
  const setRouteTarget = useUIStore((s) => s.setRouteTarget)
  const selectPin = useUIStore((s) => s.selectPin)
  const setActiveFloor = useUIStore((s) => s.setActiveFloor)

  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1)

  const building = useMemo(
    () => mapping.buildings.find((b) => b.id === targetPin.building_id),
    [mapping.buildings, targetPin.building_id],
  )

  const area = useMemo(
    () => mapping.areas.find((a) => a.id === targetPin.area_id),
    [mapping.areas, targetPin.area_id],
  )

  // Acceso de entrada / rampa
  const entrancePin = useMemo(() => {
    const facultyPins = allPins.filter((p) => p.faculty_id === targetPin.faculty_id)
    if (accessibleRoute) {
      return (
        facultyPins.find((p) => p.building_id === targetPin.building_id && p.category_id === 'rampa') ??
        facultyPins.find((p) => p.category_id === 'rampa') ??
        null
      )
    }
    return (
      facultyPins.find((p) => p.building_id === targetPin.building_id && p.category_id === 'entrada') ??
      facultyPins.find((p) => p.category_id === 'entrada') ??
      null
    )
  }, [allPins, targetPin.faculty_id, targetPin.building_id, accessibleRoute])

  // Conector vertical en el mismo edificio (ascensor o escalera)
  const verticalConnector = useMemo(() => {
    if (!targetPin.building_id) return null
    const inBuilding = allPins.filter((p) => p.building_id === targetPin.building_id)
    if (accessibleRoute) {
      return inBuilding.find((p) => p.category_id === 'ascensor') ?? null
    }
    return (
      inBuilding.find((p) => p.category_id === 'ascensor' || p.category_id === 'escalera') ??
      null
    )
  }, [allPins, targetPin.building_id, accessibleRoute])

  const minutes = durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : 2
  const floorLabel = targetPin.floor ? floorName(targetPin.floor, null) : t('indoor.groundFloor', 'Planta baja')

  const steps = [
    {
      num: 1 as const,
      title: accessibleRoute
        ? t('wayfinder.step1Accessible', 'Entra por acceso con rampa de {{bldg}}', {
            bldg: building?.name ?? 'la facultad',
          })
        : t('wayfinder.step1Standard', 'Entra por acceso principal de {{bldg}}', {
            bldg: building?.name ?? 'la facultad',
          }),
      subtitle:
        entrancePin?.title ??
        (accessibleRoute
          ? t('wayfinder.step1SubAccessible', 'Acceso nivelado sin peldaños desde la vereda')
          : t('wayfinder.step1SubStandard', 'Ingreso peatonal desde la calle')),
      badge: t('wayfinder.streetBadge', 'Calle'),
      onSelect: () => {
        setActiveStep(1)
        setActiveFloor(1)
      },
    },
    {
      num: 2 as const,
      title:
        !targetPin.floor || targetPin.floor === 1
          ? t('wayfinder.step2Ground', 'Avanza por {{area}}', {
              area: area?.name ?? 'el hall de acceso',
            })
          : accessibleRoute
            ? verticalConnector
              ? t('wayfinder.step2Lift', 'Toma el ascensor hacia {{floor}}', { floor: floorLabel })
              : t('wayfinder.step2NoLiftWarning', 'Sin ascensor registrado hacia {{floor}}', {
                  floor: floorLabel,
                })
            : t('wayfinder.step2Vertical', 'Sube por escalera o ascensor a {{floor}}', {
                floor: floorLabel,
              }),
      subtitle:
        verticalConnector?.title ??
        t('wayfinder.step2SubDefault', 'Conector vertical dentro de {{bldg}}', {
          bldg: building?.short_name ?? building?.name ?? 'el edificio',
        }),
      badge: t('wayfinder.indoorBadge', 'Interior'),
      onSelect: () => {
        setActiveStep(2)
        if (targetPin.floor) setActiveFloor(targetPin.floor)
      },
    },
    {
      num: 3 as const,
      title: targetPin.title,
      subtitle: [
        targetPin.room_code ? `Código ${targetPin.room_code}` : null,
        area?.name,
        floorLabel,
      ]
        .filter(Boolean)
        .join(' · '),
      badge: targetPin.floor ? `Piso ${targetPin.floor}` : 'Destino',
      onSelect: () => {
        setActiveStep(3)
        if (targetPin.floor) setActiveFloor(targetPin.floor)
      },
    },
  ]

  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-30 rounded-t-[32px] border-t border-[#E5DEC9] bg-[#FAF8F5] p-5 shadow-[0_-14px_38px_rgba(28,25,23,0.10)] sm:left-auto sm:right-4 sm:bottom-4 sm:w-[410px] sm:rounded-[32px] sm:border dark:border-white/10 dark:bg-[#151820]">
      <div className="mx-auto -mt-1 mb-3 h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-700 sm:hidden" />

      {/* Cabecera holgada */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const id = targetPin.id
              setRouteTarget(null)
              selectPin(id)
            }}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#EFECE4] text-stone-700 dark:bg-white/[0.08] dark:text-stone-200"
            aria-label={t('common.back', 'Volver')}
          >
            <ArrowLeft size={16} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">
                {t('wayfinder.routeTo', 'Ruta a {{title}}', { title: targetPin.title })}
              </span>
              <span className="shrink-0 rounded-md border border-[#F2D0CE] bg-[#FBECEB] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300">
                {minutes} min
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-stone-500 dark:text-stone-400">
              {[building?.short_name || building?.name, floorLabel].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {/* Conmutador "Sin escaleras" */}
        <button
          type="button"
          onClick={() => setAccessibleRoute(!accessibleRoute)}
          aria-pressed={accessibleRoute}
          className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
            accessibleRoute
              ? 'border border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300'
              : 'border border-[#E6E0D5] bg-white text-stone-600 dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-400'
          }`}
        >
          <Accessibility size={15} />
          <span>{accessibleRoute ? 'Sin escaleras ✓' : 'Sin escaleras'}</span>
        </button>
      </div>

      {/* Lista de 3 pasos interactivos */}
      <div className="mt-4 flex flex-col gap-2.5">
        {steps.map((st) => {
          const isAct = activeStep === st.num
          return (
            <button
              key={st.num}
              type="button"
              onClick={st.onSelect}
              className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                isAct
                  ? 'border-stone-900 bg-white shadow-xs dark:border-white/40 dark:bg-white/[0.08]'
                  : 'border-[#E6E0D5] bg-white/80 opacity-85 hover:opacity-100 dark:border-white/[0.07] dark:bg-[#1E222D]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                    isAct
                      ? 'bg-stone-900 text-[#FAF8F5] dark:bg-stone-100 dark:text-stone-950'
                      : 'bg-[#EFECE4] text-stone-700 dark:bg-white/[0.08] dark:text-stone-200'
                  }`}
                >
                  {st.num}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-stone-900 dark:text-stone-100">
                    {st.title}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-stone-500 dark:text-stone-400">
                    {st.subtitle}
                  </div>
                </div>
              </div>

              <span className="shrink-0 rounded-lg bg-[#EFECE4] px-2.5 py-1 text-xs font-semibold tabular-nums text-stone-700 dark:bg-white/[0.08] dark:text-stone-200">
                {st.badge}
              </span>
            </button>
          )
        })}
      </div>

      {/* Acción de cierre */}
      <button
        type="button"
        onClick={() => setRouteTarget(null)}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#C22B38] py-3 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-95 dark:bg-[#D93846]"
      >
        <Check size={15} />
        <span>{t('wayfinder.finish', 'Finalizar recorrido')}</span>
      </button>
    </div>
  )
}
