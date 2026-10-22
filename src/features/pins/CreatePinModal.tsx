import { localizedName } from '@/shared/utils/localized'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as RadixDialog from '@radix-ui/react-dialog'
import { Camera, MapPin, Sparkles, X, Trash2, ArrowRight, Loader2, BadgeCheck } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from '@/features/auth/authStore'
import { can } from '@/features/auth/permissions'
import { CATEGORIES, FACULTIES } from '@/shared/data/campusData'
import { facultyIdAt } from '@/shared/data/facultyStore'
import type { Pin, PinType } from '@/shared/types/database'
import { createPin, updatePin, fetchPinSchedule } from './api'
import { EventScheduleEditor } from './EventScheduleEditor'
import { IndoorFields } from './IndoorFields'
import { draftsFromRows, rowsFromItems, validateRows, type ScheduleRow } from './eventScheduleRows'
import { CustomDateTimePicker } from '@/shared/ui/CustomDateTimePicker'
import { Switch } from '@/shared/ui/Switch'
import { validatePhoto, MAX_PHOTOS_PER_PIN } from './photos'
import { nextDailyPinReset } from '@/shared/utils/rateLimit'
import { dbErrorMessage, isUserFacingDbError } from '@/shared/utils/dbError'
import { floorRejectionKey } from '@/shared/utils/floorValidation'

const MAX_DESCRIPTION = 1500

const pinSchema = z.object({
  type: z.enum(['report', 'place', 'event']),
  title: z.string().trim().min(3).max(80),
  // 1500 y no 500: la descripción admite enlaces y una URL de correo o de Drive
  // mide 300 caracteres sola. Tiene que coincidir con el check de la base
  // (pins_description_check), o el formulario deja pasar algo que la base rechaza.
  description: z.string().trim().max(MAX_DESCRIPTION).optional().or(z.literal('')),
  categoryId: z.string().nullable(),
  facultyId: z.string().nullable(),
  // La planta la elige la persona: no se puede deducir del punto, porque desde
  // arriba el piso 1 y el 3 son el mismo sitio.
  floor: z.number().nullable().optional(),
  roomCode: z.string().max(40).optional(),
  isOfficial: z.boolean().optional(),
  startsAt: z.string().optional().or(z.literal('')),
  endsAt: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (data.type === 'event') {
    if (!data.startsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'STARTS_AT_REQUIRED', path: ['startsAt'] })
    }
    if (!data.endsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ENDS_AT_REQUIRED', path: ['endsAt'] })
    }
    if (data.startsAt && data.endsAt) {
      const s = new Date(data.startsAt).getTime()
      const e = new Date(data.endsAt).getTime()
      if (e <= s) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ENDS_BEFORE_STARTS', path: ['endsAt'] })
      }
    }
  }
})

type PinFormValues = z.infer<typeof pinSchema>

function toLocalDatetimeString(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CreatePinModal() {
  const { t, i18n } = useTranslation()
  const open = useUIStore((s) => s.createModalOpen)
  const draftLocation = useUIStore((s) => s.draftLocation)
  const draftPinType = useUIStore((s) => s.draftPinType)
  const close = useUIStore((s) => s.closeCreateModal)
  const showToast = useUIStore((s) => s.showToast)
  const role = useAuthStore((s) => s.role)
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const [photos, setPhotos] = useState<File[]>([])
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<string[]>([])
  const [facultyDropdownOpen, setFacultyDropdownOpen] = useState(false)
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([])
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pinToEdit = useUIStore((s) => s.pinToEdit)
  const pinsData = queryClient.getQueriesData<Pin[]>({ queryKey: ['pins'] })
  const editingPin = pinToEdit ? pinsData.flatMap(d => d[1] ?? []).find(p => p.id === pinToEdit) : null

  // Al editar un evento hay que traer su programa para poder modificarlo.
  const editingSchedule = useQuery({
    queryKey: ['pin-schedule', editingPin?.id],
    queryFn: () => fetchPinSchedule(editingPin!.id),
    enabled: open && Boolean(editingPin) && editingPin?.type === 'event',
  })

  const isModerator = can(role, 'pin.moderate')
  const reportCategories = useMemo(
    () => CATEGORIES.filter((c) => c.kind === 'report' && !(c.id === 'entrada' && !isModerator)),
    [isModerator]
  )
  const eventCategories = useMemo(
    () => CATEGORIES.filter((c) => c.kind === 'event'),
    []
  )
  const canCreatePlace = can(role, 'pin.create.place')
  const isVerifiedLocked = !!editingPin?.is_permanent && !isModerator

  const form = useForm<PinFormValues>({
    resolver: zodResolver(pinSchema),
    defaultValues: {
      type: 'report',
      title: '',
      description: '',
      categoryId: reportCategories[0]?.id ?? null,
      facultyId: null,
      isOfficial: false,
      startsAt: '',
      endsAt: '',
    },
  })
  
  const type = form.watch('type')
  const title = form.watch('title')
  const description = form.watch('description')

  // Switch category list and defaults when type changes
  useEffect(() => {
    const currentCategory = CATEGORIES.find((c) => c.id === form.getValues('categoryId'))
    if (type === 'event') {
      if (!currentCategory || currentCategory.kind !== 'event') {
        form.setValue('categoryId', eventCategories[0]?.id ?? null)
      }
    } else if (type === 'report' || type === 'place') {
      if (!currentCategory || currentCategory.kind !== 'report') {
        form.setValue('categoryId', reportCategories[0]?.id ?? null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  useEffect(() => {
    if (open) {
      setPhotos([])
      setDeletedPhotoIds([])
      setScheduleRows([])
      setScheduleError(null)
      if (editingPin) {
        form.setValue('type', editingPin.type as 'report' | 'place' | 'event')
        form.setValue('title', editingPin.title)
        form.setValue('description', editingPin.description ?? '')
        form.setValue('categoryId', editingPin.category_id)
        form.setValue('facultyId', editingPin.faculty_id)
        form.setValue('isOfficial', editingPin.is_official)
        form.setValue('startsAt', editingPin.starts_at ? toLocalDatetimeString(editingPin.starts_at) : '')
        form.setValue('endsAt', editingPin.ends_at ? toLocalDatetimeString(editingPin.ends_at) : '')
        form.setValue('floor', editingPin.floor)
        form.setValue('roomCode', editingPin.room_code ?? '')
      } else {
        const initialType = draftPinType === 'event' ? 'event' : 'report'
        form.setValue('type', initialType)
        form.setValue('title', '')
        form.setValue('description', '')
        form.setValue('isOfficial', false)
        form.setValue('startsAt', '')
        form.setValue('endsAt', '')
        // Sin esto, la planta y el código del pin anterior quedaban pegados en
        // el formulario: `form.reset()` solo corre tras un guardado con éxito.
        form.setValue('floor', null)
        form.setValue('roomCode', '')
        if (initialType === 'event') {
          form.setValue('categoryId', eventCategories[0]?.id ?? null)
        } else {
          form.setValue('categoryId', reportCategories[0]?.id ?? null)
        }
        if (draftLocation) {
          form.setValue('facultyId', facultyIdAt(draftLocation.lat, draftLocation.lng))
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftLocation, draftPinType, editingPin])

  // El programa llega después que el resto del formulario (va por su propia
  // consulta), así que se vuelca cuando aterriza y no en el reset de arriba.
  useEffect(() => {
    if (open && editingSchedule.data) {
      setScheduleRows(rowsFromItems(editingSchedule.data))
    }
  }, [open, editingSchedule.data])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const existingCount = editingPin
      ? (editingPin.pin_photos ?? []).filter((ph) => !deletedPhotoIds.includes(ph.id)).length
      : 0
    const currentTotal = existingCount + photos.length
    const availableSlots = (MAX_PHOTOS_PER_PIN ?? 5) - currentTotal

    if (availableSlots <= 0) {
      showToast('Límite de fotos alcanzado')
      return
    }

    const validFiles: File[] = []
    for (const file of files.slice(0, availableSlots)) {
      const err = validatePhoto(file)
      if (err) {
        showToast(err)
      } else {
        validFiles.push(file)
      }
    }

    if (validFiles.length > 0) {
      setPhotos((prev) => [...prev, ...validFiles])
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const create = useMutation({
    mutationFn: async (values: PinFormValues) => {
      const startsAtIso = values.type === 'event' && values.startsAt ? new Date(values.startsAt).toISOString() : null
      const endsAtIso = values.type === 'event' && values.endsAt ? new Date(values.endsAt).toISOString() : null

      const officialEntityName = values.isOfficial
        ? (role === 'moderator' ? 'Centro de Alumnos FIC' : 'Administración UDP')
        : null

      // El programa solo existe para eventos. Si el pin deja de serlo, se envía
      // vacío para que no queden bloques huérfanos de un evento que ya no lo es.
      const isEvent = values.type === 'event'
      const scheduleDrafts = isEvent ? draftsFromRows(scheduleRows) : []

      if (editingPin) {
        await updatePin(
          editingPin.id, 
          {
            title: values.title,
            description: values.description ? values.description : null,
            categoryId: values.categoryId,
            facultyId: values.facultyId,
            type: values.type as PinType,
            isOfficial: values.isOfficial,
            officialEntityName,
            startsAt: startsAtIso,
            endsAt: endsAtIso,
            floor: values.floor ?? null,
            roomCode: values.roomCode?.trim() || null,
            userId: user?.id,
          },
          {
            newPhotos: photos,
            deletedPhotoIds,
            // Solo se toca el programa si el pin es (o era) un evento: para un
            // reporte no hay nada que reemplazar y sobra la consulta.
            ...(isEvent || editingPin.type === 'event' ? { schedule: scheduleDrafts } : {}),
          }
        )
        return
      }
      
      if (!user || !draftLocation) throw new Error('missing user or location')
      return createPin(
        {
          type: values.type as PinType,
          title: values.title,
          description: values.description ? values.description : null,
          categoryId: values.categoryId,
          facultyId: values.facultyId,
          lat: draftLocation.lat,
          lng: draftLocation.lng,
          userId: user.id,
          userName: user.name,
          isOfficial: values.isOfficial,
          officialEntityName,
          startsAt: startsAtIso,
          endsAt: endsAtIso,
          floor: values.floor ?? null,
          roomCode: values.roomCode?.trim() || null,
        },
        photos,
        scheduleDrafts,
      )
    },
    onSuccess: (result) => {
      // El pin se creó pero sus fotos no subieron. Se cierra igual: reabrir el
      // formulario invitaría a reintentar y eso crearía un pin duplicado. Las
      // fotos se añaden después editando el pin.
      if (result?.photosFailed) {
        showToast(t('pin.createdWithoutPhotos', 'Pin creado, pero las fotos no se pudieron subir'))
      } else if (result?.scheduleFailed) {
        showToast(t('pin.createdWithoutSchedule', 'Evento creado, pero su programa no se pudo guardar'))
      } else {
        showToast(editingPin ? t('pin.updated', 'Pin actualizado') : t('pin.created'))
      }
      void queryClient.invalidateQueries({ queryKey: ['pin-schedule'] })
      void queryClient.invalidateQueries({ queryKey: ['schedule-counts'] })
      form.reset()
      setPhotos([])
      setScheduleRows([])
      setScheduleError(null)
      close()
    },
    onError: (error) => {
      const message = dbErrorMessage(error)
      if (message.includes('DAILY_PIN_LIMIT_REACHED')) {
        const locale = i18n.language === 'en' ? 'en-US' : 'es-CL'
        const resetAt = new Intl.DateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        }).format(nextDailyPinReset())
        showToast(t('pin.dailyLimitReached', {
          name: user?.name || t('profile.user', 'usuario'),
          resetAt,
        }))
        return
      }
      if (message.includes('PIN_LOCATION_OCCUPIED')) {
        showToast(t('pin.locationOccupied'))
        return
      }
      const floorKey = floorRejectionKey(message)
      if (floorKey) {
        showToast(t(floorKey))
        return
      }
      // Las funciones de la base explican por qué rechazan algo.
      showToast(isUserFacingDbError(error) ? message : t('common.error'))
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['pins'] }),
  })

  /**
   * El programa se valida aquí y no en el schema de zod porque depende de dos
   * campos del formulario (las fechas del evento) y de un estado que vive
   * fuera de react-hook-form. Corta el envío antes de tocar la base.
   */
  const submit = form.handleSubmit((values) => {
    if (values.type === 'event') {
      const startIso = values.startsAt ? new Date(values.startsAt).toISOString() : null
      const endIso = values.endsAt ? new Date(values.endsAt).toISOString() : null
      const problem = validateRows(scheduleRows, startIso, endIso)
      if (problem) {
        setScheduleError(problem)
        return
      }
    }
    setScheduleError(null)
    create.mutate(values)
  })

  // El punto sobre el que se resuelven edificio, área y planta: el que se está
  // eligiendo al crear, o el que el pin ya tiene al editar.
  const indoorPoint = editingPin
    ? { lat: editingPin.lat, lng: editingPin.lng }
    : draftLocation

  const availableTypes: ('report' | 'place' | 'event')[] = ['report', 'event']
  if (canCreatePlace) {
    availableTypes.push('place')
  }
  const detectedFac = FACULTIES.find(f => f.id === form.watch('facultyId'))
  const facultyName = detectedFac ? (i18n.language === 'en' ? detectedFac.name_en : detectedFac.name) : t('pin.facultyNone')

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[3000] bg-black/40 backdrop-blur-md animate-fade-in" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[3001] w-full sm:w-[520px] h-[100dvh] sm:h-[85dvh] sm:max-h-[85dvh] bg-[#FAF8F5] dark:bg-[#151820] sm:rounded-[28px] border border-[#E5DEC9] dark:border-white/10 flex flex-col shadow-2xl animate-slide-in-bottom sm:animate-scale-in overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 sm:px-7 pt-4 sm:pt-6 pb-4 border-b border-[#E5DEC9] dark:border-white/10 flex items-center justify-between shrink-0">
            <div className="flex flex-col min-w-0 pr-2">
              <RadixDialog.Title className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-tight">
                {editingPin ? t('pin.editTitle', 'Editar Pin') : t('pin.createTitle')}
              </RadixDialog.Title>
              <p className="text-xs font-semibold text-[#C22B38] dark:text-[#D93846] truncate mt-0.5 flex items-center gap-1">
                <MapPin size={13} className="shrink-0" />
                <span>{facultyName}</span>
              </p>
            </div>

            <RadixDialog.Close asChild>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#EFECE4] text-stone-700 transition-colors hover:bg-stone-200 dark:bg-white/[0.08] dark:text-stone-200 dark:hover:bg-white/15"
                aria-label={t('common.close', 'Cerrar')}
              >
                <X size={18} />
              </button>
            </RadixDialog.Close>
          </div>

          {/* Body */}
          <form
            onSubmit={submit}
            className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-5 sm:space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-stone-400"
          >
            {/* Type selector (Capsule Tabs con acabado cálido) */}
            {availableTypes.length > 1 && (!editingPin || can(role, 'pin.moderate')) && (
              <div className="p-1 bg-[#EFECE4] dark:bg-white/[0.08] rounded-2xl flex gap-1" role="radiogroup">
                {availableTypes.map((v) => (
                  <label
                    key={v}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center ${
                      type === v
                        ? 'bg-stone-900 text-[#FAF8F5] shadow-xs dark:bg-stone-100 dark:text-stone-950'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                  >
                    <input type="radio" value={v} className="sr-only" {...form.register('type')} />
                    {v === 'report' ? t('pin.typeReport') : v === 'place' ? t('pin.typePlace') : t('pin.typeEvent')}
                  </label>
                ))}
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={15} className="text-[#C22B38] dark:text-[#D93846]" strokeWidth={2.2} />
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400">{t('pin.title')}</label>
              </div>
              <div className="space-y-1.5">
                <input
                  {...form.register('title')}
                  placeholder={
                    type === 'event'
                      ? t('pin.titlePlaceholderEvent', 'Ej: Feria de Ciencias, Charla FIC...')
                      : type === 'place'
                        ? t('pin.titlePlaceholderPlace', 'Ej: Sala de Estudio A-102, Microondas...')
                        : t('pin.titlePlaceholderReport', 'Ej: Baño averiado, fuga de agua...')
                  }
                  className="w-full text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 bg-transparent border-none outline-none focus:ring-0 p-0 tracking-tight truncate"
                  autoComplete="off"
                />
                <div className="h-1 w-full bg-[#E5DEC9] dark:bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full bg-[#C22B38] dark:bg-[#D93846] transition-all duration-700 ease-out ${title?.length > 0 ? 'w-full' : 'w-0'}`} />
                </div>
                {form.formState.errors.title && (
                  <p className="text-xs font-semibold text-[#C22B38] dark:text-[#D93846]">
                    {form.formState.errors.title.type === 'too_small'
                      ? t('common.minChars', { n: 3 })
                      : t('common.maxChars', { n: 80 })}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400">{t('pin.description')}</label>
              <textarea
                rows={3}
                {...form.register('description')}
                placeholder={t('pin.descriptionPlaceholder', '¿Qué está pasando? (opcional)')}
                className="w-full min-h-[84px] bg-white dark:bg-[#1E222D] border border-[#E6E0D5] dark:border-white/[0.07] rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 outline-none focus:border-[#C22B38] dark:focus:border-[#D93846] transition-all resize-y shadow-xs"
              />
              {form.formState.errors.description ? (
                <p className="text-xs font-semibold text-[#C22B38] dark:text-[#D93846]">
                  {t('common.maxChars', { n: MAX_DESCRIPTION })}
                </p>
              ) : (description?.length ?? 0) > MAX_DESCRIPTION * 0.8 ? (
                <p className="text-xs font-medium text-stone-400 dark:text-stone-500">
                  {description?.length ?? 0} / {MAX_DESCRIPTION}
                </p>
              ) : null}
            </div>

            {/* Photos */}
            {(() => {
              const existingPhotos = (editingPin?.pin_photos ?? []).filter((p) => !deletedPhotoIds.includes(p.id))
              const totalCount = existingPhotos.length + photos.length

              return (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                    {t('pin.photos')}
                  </label>
                  <div className="flex flex-col gap-3">
                    {totalCount > 0 && (
                      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 -mx-5 px-5 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden sm:[&::-webkit-scrollbar]:block sm:[&::-webkit-scrollbar]:h-1.5 sm:[&::-webkit-scrollbar-thumb]:bg-stone-300 dark:sm:[&::-webkit-scrollbar-thumb]:bg-stone-700 sm:[&::-webkit-scrollbar-thumb]:rounded-full">
                        {/* Fotos guardadas en base de datos */}
                        {existingPhotos.map((ph) => (
                          <div
                            key={ph.id}
                            className={`relative shrink-0 snap-center rounded-2xl overflow-hidden shadow-xs border border-[#E6E0D5] dark:border-white/[0.07] transition-all ${
                              totalCount === 1 ? 'w-full aspect-[4/3] sm:aspect-video' : 'w-[75%] sm:w-[60%] aspect-square sm:aspect-[4/3]'
                            }`}
                          >
                            <img src={ph.url} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setDeletedPhotoIds((prev) => [...prev, ph.id])}
                              className="absolute top-2.5 right-2.5 w-7 h-7 bg-black/50 backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-red-500 hover:scale-105 transition-all shadow-md cursor-pointer"
                              title={t('pin.removePhoto', 'Eliminar foto')}
                            >
                              <Trash2 size={14} className="text-white" />
                            </button>
                          </div>
                        ))}

                        {/* Fotos nuevas elegidas */}
                        {photos.map((file, i) => (
                          <div
                            key={`new-${i}`}
                            className={`relative shrink-0 snap-center rounded-2xl overflow-hidden shadow-xs border border-[#E6E0D5] dark:border-white/[0.07] transition-all ${
                              totalCount === 1 ? 'w-full aspect-[4/3] sm:aspect-video' : 'w-[75%] sm:w-[60%] aspect-square sm:aspect-[4/3]'
                            }`}
                          >
                            <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                              className="absolute top-2.5 right-2.5 w-7 h-7 bg-black/50 backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-red-500 hover:scale-105 transition-all shadow-md cursor-pointer"
                              title={t('pin.removePhoto', 'Eliminar foto')}
                            >
                              <Trash2 size={14} className="text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {totalCount < (MAX_PHOTOS_PER_PIN ?? 5) && (
                      <>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-14 bg-white dark:bg-[#1E222D] border border-dashed border-[#E6E0D5] dark:border-white/[0.12] hover:border-[#C22B38] rounded-2xl flex items-center justify-center gap-2 text-stone-600 dark:text-stone-400 hover:text-[#C22B38] transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                        >
                          <Camera size={18} strokeWidth={2} />
                          <span className="text-xs font-semibold">{t('pin.addPhotos')}</span>
                        </button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          accept="image/*"
                          multiple
                          className="hidden"
                        />
                      </>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Faculty */}
            <div className="space-y-2 relative">
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400">{t('pin.faculty')}</label>
              <button
                type="button"
                disabled={isVerifiedLocked}
                onClick={() => setFacultyDropdownOpen(!facultyDropdownOpen)}
                className={`w-full border border-[#E6E0D5] dark:border-white/[0.07] rounded-2xl px-5 py-3.5 text-sm font-semibold text-stone-800 dark:text-stone-200 outline-none transition-all shadow-xs flex items-center justify-between cursor-pointer ${
                  isVerifiedLocked ? 'bg-stone-100 dark:bg-stone-800/80 cursor-not-allowed opacity-70' : 'bg-white dark:bg-[#1E222D]'
                }`}
              >
                <span className="truncate">
                  {form.watch('facultyId')
                    ? localizedName(FACULTIES.find(f => f.id === form.watch('facultyId')), i18n.language) || t('pin.facultyNone')
                    : t('pin.facultyNone')}
                </span>
                <svg 
                  className={`w-5 h-5 ml-2 transition-transform text-stone-400 ${facultyDropdownOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {facultyDropdownOpen && (
                <div className="absolute top-[72px] left-0 right-0 z-[4000] rounded-2xl bg-white dark:bg-[#1E222D] border border-[#E6E0D5] dark:border-white/[0.10] shadow-xl overflow-hidden animate-scale-in">
                  <div className="max-h-56 overflow-y-auto p-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-stone-300 dark:[&::-webkit-scrollbar-thumb]:bg-stone-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue('facultyId', null, { shouldValidate: true })
                        setFacultyDropdownOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        !form.watch('facultyId')
                          ? 'border border-[#F2D0CE] bg-[#FBECEB] text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300' 
                          : 'text-stone-700 dark:text-stone-300 hover:bg-[#F4F0E8] dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      {t('pin.facultyNone')}
                    </button>
                    {FACULTIES.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          form.setValue('facultyId', f.id, { shouldValidate: true })
                          setFacultyDropdownOpen(false)
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          form.watch('facultyId') === f.id
                            ? 'border border-[#F2D0CE] bg-[#FBECEB] text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300' 
                            : 'text-stone-700 dark:text-stone-300 hover:bg-[#F4F0E8] dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        {localizedName(f, i18n.language)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400">{t('pin.category')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <Controller
                  name="categoryId"
                  control={form.control}
                  render={({ field }) => {
                    const activeCategories = CATEGORIES.filter((c) => {
                      if (c.kind !== (type === 'event' ? 'event' : 'report')) return false
                      if (c.id === 'entrada' && !isModerator) return false
                      return true
                    })
                    return (
                      <>
                        {activeCategories.map(c => {
                          const isSelected = field.value === c.id
                          return (
                            <button
                              key={c.id}
                              type="button"
                              disabled={isVerifiedLocked && !isSelected}
                              onClick={() => field.onChange(c.id)}
                              className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all cursor-pointer ${
                                isSelected
                                  ? 'shadow-xs border-current bg-white dark:bg-[#1E222D]'
                                  : 'bg-white dark:bg-[#1E222D] border-[#E6E0D5] dark:border-white/[0.07] hover:border-stone-400'
                              } ${isVerifiedLocked && !isSelected ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                              style={isSelected ? { 
                                borderColor: c.color, 
                                backgroundColor: `color-mix(in srgb, ${c.color} 8%, transparent)` 
                              } : {}}
                            >
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                                  isSelected 
                                    ? 'text-white shadow-xs' 
                                    : 'bg-[#EFECE4] dark:bg-white/[0.08] text-stone-500 dark:text-stone-400'
                                }`}
                                style={isSelected ? { backgroundColor: c.color } : {}}
                              >
                                {c.svgPath ? (
                                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d={c.svgPath} />
                                  </svg>
                                ) : (
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                                )}
                              </div>
                              <span 
                                className={`text-xs font-semibold text-center leading-tight ${
                                  !isSelected && 'text-stone-700 dark:text-stone-300'
                                }`}
                                style={isSelected ? { color: c.color } : {}}
                              >
                                {localizedName(c, i18n.language)}
                              </span>
                            </button>
                          )
                        })}
                      </>
                    )
                  }}
                />
              </div>
            </div>

            {/* Event Dates */}
            {type === 'event' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400">Fecha de Inicio</label>
                  <Controller
                    name="startsAt"
                    control={form.control}
                    render={({ field }) => (
                      <CustomDateTimePicker
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder="Seleccionar inicio..."
                        error={!!form.formState.errors.startsAt}
                        align="left"
                      />
                    )}
                  />
                  {form.formState.errors.startsAt && (
                    <p className="text-xs font-semibold text-[#C22B38] dark:text-[#D93846] mt-1">{form.formState.errors.startsAt.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400">Fecha de Término</label>
                  <Controller
                    name="endsAt"
                    control={form.control}
                    render={({ field }) => (
                      <CustomDateTimePicker
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder="Seleccionar término..."
                        error={!!form.formState.errors.endsAt}
                        align="right"
                      />
                    )}
                  />
                  {form.formState.errors.endsAt && (
                    <p className="text-xs font-semibold text-[#C22B38] dark:text-[#D93846] mt-1">{form.formState.errors.endsAt.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Programa del evento */}
            {type === 'event' && (
              <EventScheduleEditor
                rows={scheduleRows}
                onChange={(rows) => {
                  setScheduleRows(rows)
                  if (scheduleError) setScheduleError(null)
                }}
                eventStartsAt={form.watch('startsAt') ?? ''}
                eventEndsAt={form.watch('endsAt') ?? ''}
                error={scheduleError}
              />
            )}

            {/* Planta y código de sala */}
            {indoorPoint && (
              <IndoorFields
                lat={indoorPoint.lat}
                lng={indoorPoint.lng}
                floor={form.watch('floor') ?? null}
                roomCode={form.watch('roomCode') ?? ''}
                isRoom={form.watch('categoryId') === 'sala'}
                autoSelectFloor={!editingPin}
                onFloorChange={(value) => form.setValue('floor', value)}
                onRoomCodeChange={(value) => form.setValue('roomCode', value)}
              />
            )}

            {/* Coordinates */}
            {!editingPin && draftLocation && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400">{t('pin.coordinates', 'Coordenadas')}</label>
                <div className="w-full bg-white dark:bg-[#1E222D] border border-[#E6E0D5] dark:border-white/[0.07] rounded-2xl px-5 py-3 flex items-center gap-2.5 shadow-xs">
                  <MapPin size={16} className="text-stone-400 shrink-0" />
                  <span className="text-xs font-mono font-semibold tabular-nums text-stone-600 dark:text-stone-400">
                    {draftLocation.lat.toFixed(6)}, {draftLocation.lng.toFixed(6)}
                  </span>
                </div>
              </div>
            )}

            {/* Admin Toggle: isOfficial */}
            {can(role, 'pin.moderate') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4 bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/20 dark:border-sky-500/30 rounded-2xl p-4 shadow-xs transition-all">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <BadgeCheck size={18} className="text-sky-600 dark:text-sky-400 shrink-0" strokeWidth={2.2} />
                      <label htmlFor="pin-official" className="text-xs font-semibold text-sky-700 dark:text-sky-300 cursor-pointer">
                        {t('pin.officialToggle', 'Publicar como Oficial')}
                      </label>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400 font-normal leading-snug pl-6">
                      El autor se mostrará como <span className="font-semibold text-[#C22B38] dark:text-[#D93846]">{role === 'moderator' ? 'Centro de Alumnos FIC' : 'Administración UDP'}</span>.
                    </p>
                  </div>
                  <Controller
                    name="isOfficial"
                    control={form.control}
                    render={({ field }) => (
                      <Switch id="pin-official" checked={field.value ?? false} onChange={field.onChange} tone="sky" />
                    )}
                  />
                </div>
              </div>
            )}
            
            {/* Submit Button (Desktop inside scroll area) */}
            <div className="hidden sm:block pt-2 pb-2">
              <button
                type="submit"
                disabled={!title?.trim() || create.isPending || (!editingPin && !draftLocation)}
                className="w-full h-11 bg-[#C22B38] hover:bg-[#9E1F2A] dark:bg-[#D93846] dark:hover:bg-[#B82532] text-white rounded-2xl font-semibold text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-30 disabled:grayscale cursor-pointer"
              >
                {create.isPending ? <Loader2 size={16} className="animate-spin" /> : editingPin ? t('pin.update', 'Guardar') : t('pin.submit')}
                {!create.isPending && <ArrowRight size={16} strokeWidth={2.5} />}
              </button>
            </div>
          </form>

          {/* Submit Button Sticky Bottom (Mobile only) */}
          <div className="sm:hidden px-5 pt-3 pb-[max(1.2rem,env(safe-area-inset-bottom))] bg-[#FAF8F5] dark:bg-[#151820] border-t border-[#E5DEC9] dark:border-white/10 shrink-0">
            <button
              onClick={submit}
              disabled={!title?.trim() || create.isPending || (!editingPin && !draftLocation)}
              className="w-full h-11 bg-[#C22B38] hover:bg-[#9E1F2A] dark:bg-[#D93846] dark:hover:bg-[#B82532] text-white rounded-2xl font-semibold text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-30 disabled:grayscale cursor-pointer"
            >
              {create.isPending ? <Loader2 size={16} className="animate-spin" /> : editingPin ? t('pin.update', 'Guardar') : t('pin.submit')}
              {!create.isPending && <ArrowRight size={16} strokeWidth={2.5} />}
            </button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
