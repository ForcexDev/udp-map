import { useState, useRef, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as RadixDialog from '@radix-ui/react-dialog'
import { Camera, MapPin, Sparkles, X, Trash2, ArrowRight, Loader2 } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from '@/features/auth/authStore'
import { can } from '@/features/auth/permissions'
import { CATEGORIES, FACULTIES } from '@/shared/data/campusData'
import { facultyIdAt } from '@/shared/data/facultyPerimeters'
import type { Pin, PinType } from '@/shared/types/database'
import { createPin, updatePin } from './api'
import { validatePhoto, MAX_PHOTOS_PER_PIN } from './photos'

const pinSchema = z.object({
  type: z.enum(['report', 'place']),
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  categoryId: z.string().nullable(),
  facultyId: z.string().nullable(),
  isOfficial: z.boolean().optional(),
})
export type PinFormValues = z.infer<typeof pinSchema>

export function CreatePinModal() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const open = useUIStore((s) => s.createModalOpen)
  const close = useUIStore((s) => s.closeCreateModal)
  const draftLocation = useUIStore((s) => s.draftLocation)
  const showToast = useUIStore((s) => s.showToast)
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  
  const [photos, setPhotos] = useState<File[]>([])
  const [facultyDropdownOpen, setFacultyDropdownOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pinToEdit = useUIStore((s) => s.pinToEdit)
  const pinsData = queryClient.getQueriesData<Pin[]>({ queryKey: ['pins'] })
  const editingPin = pinToEdit ? pinsData.flatMap(d => d[1] ?? []).find(p => p.id === pinToEdit) : null

  const reportCategories = CATEGORIES.filter((c) => c.kind === 'report')
  const canCreatePlace = can(role, 'pin.create.place')

  const form = useForm<PinFormValues>({
    resolver: zodResolver(pinSchema),
    defaultValues: {
      type: 'report',
      title: '',
      description: '',
      categoryId: reportCategories[0]?.id ?? null,
      facultyId: null,
      isOfficial: false,
    },
  })
  
  const type = form.watch('type')
  const title = form.watch('title')

  // Detección automática de facultad por perímetro o popular formulario si es modo edición
  useEffect(() => {
    if (open) {
      if (editingPin) {
        form.setValue('type', editingPin.type as 'report' | 'place')
        form.setValue('title', editingPin.title)
        form.setValue('description', editingPin.description ?? '')
        form.setValue('categoryId', editingPin.category_id)
        form.setValue('facultyId', editingPin.faculty_id)
        form.setValue('isOfficial', editingPin.is_official)
      } else if (draftLocation) {
        form.setValue('facultyId', facultyIdAt(draftLocation.lat, draftLocation.lng))
      }
    }
  }, [open, draftLocation, form, editingPin])

  const create = useMutation({
    mutationFn: async (values: PinFormValues) => {
      if (editingPin) {
        await updatePin(editingPin.id, {
          title: values.title,
          description: values.description ? values.description : null,
          categoryId: values.categoryId,
          facultyId: values.facultyId,
          type: values.type as PinType,
          isOfficial: values.isOfficial,
        })
        return
      }
      
      if (!user || !draftLocation) throw new Error('missing user or location')
      await createPin(
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
        },
        photos,
      )
    },
    onSuccess: () => {
      showToast(editingPin ? t('pin.updated', 'Pin actualizado') : t('pin.created'))
      form.reset()
      setPhotos([])
      close()
    },
    onError: () => showToast(t('common.error')),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['pins'] }),
  })

  const onPhotosSelected = (files: FileList | null) => {
    if (!files) return
    const next: File[] = [...photos]
    for (const file of Array.from(files)) {
      if (next.length >= MAX_PHOTOS_PER_PIN) break
      const problem = validatePhoto(file)
      if (problem === 'bad-type') {
        showToast(t('pin.photoBadType', { name: file.name }))
        continue
      }
      if (problem === 'too-large') {
        showToast(t('pin.photoTooLarge', { name: file.name }))
        continue
      }
      next.push(file)
    }
    setPhotos(next)
  }

  const removeImage = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const detectedFac = FACULTIES.find(f => f.id === form.watch('facultyId'))
  const facultyName = detectedFac ? (i18n.language === 'en' ? detectedFac.name_en : detectedFac.name) : t('pin.facultyNone')

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[3000] bg-black/40 backdrop-blur-md animate-fade-in" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[3001] w-full sm:w-[540px] h-[100dvh] sm:h-auto sm:max-h-[90dvh] bg-white dark:bg-neutral-900 sm:rounded-[32px] flex flex-col shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] animate-slide-in-bottom sm:animate-scale-in overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 sm:px-8 pt-[max(env(safe-area-inset-top,2rem),2rem)] sm:pt-10 pb-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4 sm:gap-5">
              <RadixDialog.Close asChild>
                <button
                  type="button"
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-neutral-50 dark:bg-neutral-800 rounded-xl text-neutral-900 dark:text-neutral-100 active:scale-90 transition-all border border-neutral-100 dark:border-neutral-700 shadow-sm"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </RadixDialog.Close>
              <div className="flex flex-col">
                <RadixDialog.Title className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight leading-none mb-1">
                  {editingPin ? t('pin.editTitle', 'Editar Pin') : t('pin.createTitle')}
                </RadixDialog.Title>
                <p className="text-[10px] sm:text-[11px] font-black text-[#D41F2D] uppercase tracking-[0.2em] line-clamp-1">
                  {facultyName}
                </p>
              </div>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-[#D41F2D] shrink-0">
              <MapPin size={20} strokeWidth={2.5} />
            </div>
          </div>

          {/* Body */}
          <form
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
            className="flex-1 overflow-y-auto px-6 sm:px-8 pt-8 pb-32 sm:py-10 space-y-10 sm:space-y-12 no-scrollbar"
          >
            {/* Type selector */}
            {canCreatePlace && (
              <div className="flex gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-2xl" role="radiogroup">
                {(['report', 'place'] as const).map((v) => (
                  <label
                    key={v}
                    className={`flex-1 py-2.5 rounded-[14px] text-[11px] font-black tracking-widest uppercase transition-all cursor-pointer text-center ${
                      type === v
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-400 dark:text-neutral-500'
                    }`}
                  >
                    <input type="radio" value={v} className="sr-only" {...form.register('type')} />
                    {v === 'report' ? t('pin.typeReport') : t('pin.typePlace')}
                  </label>
                ))}
              </div>
            )}

            {/* Title */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Sparkles size={18} className="text-[#D41F2D]" strokeWidth={2.5} />
                <label className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em]">{t('pin.title')}</label>
              </div>
              <div className="space-y-2">
                <input
                  {...form.register('title')}
                  placeholder={t('pin.titlePlaceholder')}
                  className="w-full text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white placeholder:text-neutral-300 dark:placeholder:text-neutral-600 bg-transparent border-none outline-none focus:ring-0 p-0 tracking-tighter"
                  autoComplete="off"
                />
                <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-[#D41F2D] transition-all duration-1000 ease-out ${title?.length > 0 ? 'w-full' : 'w-0'}`}></div>
                </div>
                {form.formState.errors.title && (
                  <p className="mt-2 text-xs font-bold text-[#D41F2D]">
                    {form.formState.errors.title.type === 'too_small'
                      ? t('common.minChars', { n: 3 })
                      : t('common.maxChars', { n: 80 })}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-6">
              <label className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">{t('pin.description')}</label>
              <textarea
                rows={3}
                {...form.register('description')}
                placeholder={t('pin.descriptionPlaceholder')}
                className="w-full bg-neutral-50/70 dark:bg-neutral-800/70 border border-neutral-100 dark:border-neutral-700 rounded-3xl px-6 py-5 text-sm font-bold text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 outline-none focus:ring-4 focus:ring-red-500/10 transition-all resize-none shadow-sm"
              />
            </div>

            {/* Photos (Only when creating) */}
            {!editingPin && (
              <div className="space-y-6">
                <label className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">{t('pin.photos')}</label>
                <div className="flex flex-col gap-4">
                  {photos.length > 0 && (
                    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 -mx-6 px-6 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden sm:[&::-webkit-scrollbar]:block sm:[&::-webkit-scrollbar]:h-2 sm:[&::-webkit-scrollbar-track]:bg-transparent sm:[&::-webkit-scrollbar-thumb]:bg-neutral-200 dark:sm:[&::-webkit-scrollbar-thumb]:bg-neutral-700 sm:[&::-webkit-scrollbar-thumb]:rounded-full hover:sm:[&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:hover:sm:[&::-webkit-scrollbar-thumb]:bg-neutral-600">
                      {photos.map((file, i) => (
                        <div 
                          key={i} 
                          className={`relative shrink-0 snap-center rounded-[24px] overflow-hidden shadow-[0_8px_24px_-12px_rgba(0,0,0,0.2)] border border-neutral-100 dark:border-neutral-800 transition-all ${
                            photos.length === 1 ? 'w-full aspect-[4/3] sm:aspect-video' : 'w-[75%] sm:w-[60%] aspect-square sm:aspect-[4/3]'
                          }`}
                        >
                          <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            className="absolute top-3 right-3 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-red-500 hover:scale-110 transition-all"
                          >
                            <Trash2 size={16} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {photos.length < MAX_PHOTOS_PER_PIN && (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-28 bg-neutral-50 dark:bg-neutral-800/50 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-3xl flex flex-col items-center justify-center gap-3 text-neutral-400 hover:border-[#D41F2D] hover:text-[#D41F2D] transition-all overflow-hidden relative"
                      >
                        <Camera size={28} strokeWidth={1.5} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{t('pin.addPhotos')}</span>
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => onPhotosSelected(e.target.files)}
                        accept="image/*"
                        capture="environment"
                        multiple
                        className="hidden"
                      />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Faculty */}
            <div className="space-y-6 relative">
              <label className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">{t('pin.faculty')}</label>
              <button
                type="button"
                onClick={() => setFacultyDropdownOpen(!facultyDropdownOpen)}
                className="w-full bg-neutral-50/70 dark:bg-neutral-800/70 border border-neutral-100 dark:border-neutral-700 rounded-2xl px-6 py-4 text-sm font-bold text-neutral-800 dark:text-neutral-200 outline-none focus:ring-4 focus:ring-red-500/10 transition-all shadow-sm flex items-center justify-between"
              >
                <span className="truncate">
                  {form.watch('facultyId')
                    ? FACULTIES.find(f => f.id === form.watch('facultyId'))?.name ?? t('pin.facultyNone')
                    : t('pin.facultyNone')}
                </span>
                <svg 
                  className={`w-5 h-5 ml-2 transition-transform text-neutral-400 ${facultyDropdownOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {facultyDropdownOpen && (
                <div className="absolute top-[88px] left-0 right-0 z-[4000] rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl overflow-hidden animate-scale-in">
                  <div className="max-h-56 overflow-y-auto p-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue('facultyId', null, { shouldValidate: true })
                        setFacultyDropdownOpen(false)
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${
                        !form.watch('facultyId')
                          ? 'bg-red-50 dark:bg-red-900/10 text-[#D41F2D] font-bold' 
                          : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
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
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${
                          form.watch('facultyId') === f.id
                            ? 'bg-red-50 dark:bg-red-900/10 text-[#D41F2D] font-bold' 
                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Category */}
            <div className="space-y-6">
                <label className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">{t('pin.category')}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Controller
                    name="categoryId"
                    control={form.control}
                    render={({ field }) => (
                      <>
                        {can(role, 'pin.moderate') && (
                          <button
                            type="button"
                            onClick={() => field.onChange(null)}
                            className={`flex flex-col items-center gap-3 p-4 rounded-[24px] border-2 transition-all ${
                              field.value === null
                                ? 'shadow-lg scale-[1.02] border-[#D41F2D] bg-[#D41F2D]/5 dark:bg-[#D41F2D]/10'
                                : 'bg-neutral-50/50 dark:bg-neutral-800/50 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700'
                            }`}
                          >
                            <div className="w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0 transition-all text-[#D41F2D] shadow-sm bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700">
                              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                              </svg>
                            </div>
                            <div className="text-center">
                              <div className="text-[12px] font-black text-neutral-900 dark:text-white leading-tight">
                                Entrada
                              </div>
                            </div>
                          </button>
                        )}
                        {reportCategories.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => field.onChange(c.id)}
                            className={`flex flex-col items-center gap-3 p-4 rounded-[24px] border-2 transition-all ${
                              field.value === c.id
                                ? 'shadow-lg scale-[1.02]'
                                : 'bg-neutral-50/50 dark:bg-neutral-800/50 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700'
                            }`}
                            style={field.value === c.id ? { 
                              borderColor: c.color, 
                              backgroundColor: `color-mix(in srgb, ${c.color} 10%, transparent)` 
                            } : {}}
                          >
                            <div
                              className={`w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0 transition-all ${
                                field.value === c.id 
                                  ? 'text-white shadow-lg' 
                                  : 'bg-white dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-neutral-100 dark:border-neutral-700'
                              }`}
                              style={field.value === c.id ? { backgroundColor: c.color } : {}}
                            >
                              {c.svgPath ? (
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                                  <path d={c.svgPath} />
                                </svg>
                              ) : (
                                <span className="text-lg">{c.emoji}</span>
                              )}
                            </div>
                            <span 
                              className={`text-[9px] font-black uppercase tracking-widest text-center leading-none ${
                                field.value !== c.id && 'text-neutral-500 dark:text-neutral-400'
                              }`}
                              style={field.value === c.id ? { color: c.color } : {}}
                            >
                              {c.name}
                            </span>
                          </button>
                        ))}
                      </>
                    )}
                  />
                </div>
              </div>

            {/* Coordinates */}
            {!editingPin && draftLocation && (
              <div className="space-y-6">
                <label className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.2em] ml-1">{t('pin.coordinates', 'Coordenadas')}</label>
                <div className="w-full bg-neutral-50/70 dark:bg-neutral-800/70 border border-neutral-100 dark:border-neutral-700 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-sm">
                  <MapPin size={18} className="text-neutral-400 shrink-0" />
                  <span className="text-sm font-mono font-bold text-neutral-600 dark:text-neutral-400">
                    {draftLocation.lat.toFixed(6)}, {draftLocation.lng.toFixed(6)}
                  </span>
                </div>
              </div>
            )}

            {/* Admin Toggle: isOfficial */}
            {can(role, 'pin.moderate') && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4 bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl px-5 py-4 shadow-sm">
                  <div className="flex-1">
                    <label className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">{t('pin.officialToggle', 'Publicar como Oficial')}</label>
                    <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 font-medium mt-1 leading-snug">
                      El autor se mostrará como Administración UDP.
                    </p>
                  </div>
                  <Controller
                    name="isOfficial"
                    control={form.control}
                    render={({ field }) => (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={field.value}
                        onClick={() => field.onChange(!field.value)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                          field.value ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-600'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            field.value ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    )}
                  />
                </div>
              </div>
            )}
            
            {/* Submit Button (Desktop inside scroll area, Mobile sticky bottom) */}
            <div className="hidden sm:block pt-4 pb-2">
              <button
                type="submit"
                disabled={!title?.trim() || create.isPending || (!editingPin && !draftLocation)}
                className="w-full h-12 bg-[#D41F2D] text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-[0_12px_24px_-8px_rgba(212,31,45,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-20 disabled:grayscale"
              >
                {create.isPending ? <Loader2 size={18} className="animate-spin" /> : editingPin ? t('pin.update', 'Guardar') : t('pin.submit')}
                {!create.isPending && <ArrowRight size={18} strokeWidth={3} />}
              </button>
            </div>
          </form>

          {/* Submit Button Sticky Bottom (Mobile only) */}
          <div className="sm:hidden px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-white dark:bg-neutral-900 border-t border-neutral-50 dark:border-neutral-800 shrink-0">
            <button
              onClick={form.handleSubmit((values) => create.mutate(values))}
              disabled={!title?.trim() || create.isPending || (!editingPin && !draftLocation)}
              className="w-full h-12 bg-[#D41F2D] text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-[0_12px_24px_-8px_rgba(212,31,45,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-20 disabled:grayscale"
            >
              {create.isPending ? <Loader2 size={18} className="animate-spin" /> : editingPin ? t('pin.update', 'Guardar') : t('pin.submit')}
              {!create.isPending && <ArrowRight size={18} strokeWidth={3} />}
            </button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
