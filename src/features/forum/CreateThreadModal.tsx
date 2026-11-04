import { localizedName } from '@/shared/utils/localized'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '@/shared/ui/Dialog'
import { Switch } from '@/shared/ui/Switch'
import { FACULTIES } from '@/shared/data/campusData'
import { useAuthStore } from '@/features/auth/authStore'
import { can } from '@/features/auth/permissions'
import { useCreateThread } from './useForum'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import { BadgeCheck, GraduationCap, Type, AlignLeft, Tag, Send } from 'lucide-react'

import type { ForumThread } from '@/shared/types/database'

interface CreateThreadModalProps {
  open: boolean
  onClose: () => void
  defaultFacultyId: string | null
  onCreated?: (newThread: ForumThread) => void
}

export function CreateThreadModal({
  open,
  onClose,
  defaultFacultyId,
  onCreated,
}: CreateThreadModalProps) {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const canPostOfficial = can(role, 'forum.postOfficial')
  const [error, setError] = useState('')
  const createThreadMutation = useCreateThread()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [facultyId, setFacultyId] = useState<string | null>(defaultFacultyId)
  const [tagsInput, setTagsInput] = useState('')
  const [isOfficial, setIsOfficial] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!user) {
      setError(t('forum.errorLogin', 'Debes iniciar sesión para publicar'))
      return
    }

    if (!title.trim() || !content.trim()) {
      setError(t('forum.errorEmptyFields', 'El título y contenido son obligatorios'))
      return
    }

    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    createThreadMutation.mutate(
      {
        title: title.trim(),
        content: content.trim(),
        tags,
        facultyId: facultyId === 'general' ? null : facultyId,
        authorId: user.id,
        isOfficial: canPostOfficial && isOfficial,
        officialEntityName:
          canPostOfficial && isOfficial
            ? role === 'moderator'
              ? 'Centro de Alumnos FIC'
              : 'Administración UDP'
            : null,
      },
      {
        onSuccess: (newThread) => {
          setTitle('')
          setContent('')
          setTagsInput('')
          setIsOfficial(false)
          setError('')
          if (newThread && onCreated) {
            onCreated(newThread)
          }
          onClose()
        },
        onError: (err: unknown) => {
          const errorMsg = err instanceof Error ? err.message : 'Ocurrió un error'
          setError(errorMsg || t('common.error', 'Ocurrió un error'))
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('forum.createThreadTitle', 'Crear Nuevo Hilo')}
      description={t(
        'forum.createThreadDesc',
        'Inicia una conversación en tu facultad o en el tablón general.',
      )}
      contentClassName="!bg-white dark:!bg-[#1E222D] border border-[#E6E0D5] dark:border-white/[0.07] sm:max-w-lg shadow-2xl rounded-3xl"
    >
      <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Facultad / Ubicación */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300">
            <GraduationCap size={14} className="text-[#C22B38] dark:text-[#D93846]" />
            {t('forum.threadFaculty', 'Facultad / Ubicación')}
          </label>
          <CustomSelect
            options={[
              { value: 'general', label: t('forum.generalTab', 'Tablón General') },
              ...FACULTIES.map((f) => ({ value: f.id, label: localizedName(f, i18n.language) })),
            ]}
            value={facultyId || 'general'}
            onChange={(val) => setFacultyId(val === 'general' ? null : val)}
            className="w-full"
          />
        </div>

        {/* Título */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300">
            <Type size={14} className="text-[#C22B38] dark:text-[#D93846]" />
            {t('forum.threadTitle', 'Título')}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('forum.titlePlaceholder', 'Ej: Dudas con el certamen de Cálculo...')}
            className="w-full rounded-2xl border border-[#E6E0D5] bg-[#FAF8F5] px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 outline-none transition-all focus:border-[#C22B38] focus:bg-white dark:border-white/[0.07] dark:bg-[#151820] dark:text-stone-100 dark:focus:border-[#D93846] dark:focus:bg-[#1E222D] shadow-xs"
          />
        </div>

        {/* Contenido */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300">
            <AlignLeft size={14} className="text-[#C22B38] dark:text-[#D93846]" />
            {t('forum.threadContent', 'Contenido')}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('forum.contentPlaceholder', 'Escribe tu publicación aquí...')}
            rows={4}
            className="w-full resize-none rounded-2xl border border-[#E6E0D5] bg-[#FAF8F5] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-stone-900 placeholder:text-stone-400 outline-none transition-all focus:border-[#C22B38] focus:bg-white dark:border-white/[0.07] dark:bg-[#151820] dark:text-stone-100 dark:focus:border-[#D93846] dark:focus:bg-[#1E222D] shadow-xs"
          />
        </div>

        {/* Etiquetas */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300">
            <Tag size={14} className="text-[#C22B38] dark:text-[#D93846]" />
            {t('forum.threadTags', 'Etiquetas (separadas por comas)')}
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder={t('forum.tagsPlaceholder', 'Ej: calculo, certamen, ayuda')}
            className="w-full rounded-2xl border border-[#E6E0D5] bg-[#FAF8F5] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-stone-900 placeholder:text-stone-400 outline-none transition-all focus:border-[#C22B38] focus:bg-white dark:border-white/[0.07] dark:bg-[#151820] dark:text-stone-100 dark:focus:border-[#D93846] dark:focus:bg-[#1E222D] shadow-xs"
          />
        </div>

        {/* Botones de Acción */}
        {canPostOfficial && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-xs dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <BadgeCheck size={18} className="shrink-0 text-blue-500" strokeWidth={2.2} />
                <label
                  htmlFor="forum-official"
                  className="cursor-pointer text-xs font-bold text-blue-600 dark:text-blue-400"
                >
                  {t('forum.officialToggle', 'Publicar como Oficial')}
                </label>
              </div>
              <p className="pl-6 text-[11px] font-medium leading-snug text-stone-500 sm:text-xs dark:text-stone-400">
                {t('forum.officialDescription', 'El autor se mostrará como {{entity}}.', {
                  entity: role === 'moderator' ? 'Centro de Alumnos FIC' : 'Administración UDP',
                })}
              </p>
            </div>
            <Switch id="forum-official" checked={isOfficial} onChange={setIsOfficial} tone="blue" />
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-2 border-t border-[#E5DEC9] pt-3 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-2xl px-5 py-2 text-xs font-semibold text-stone-600 transition-all hover:bg-[#EFECE4] dark:text-stone-300 dark:hover:bg-white/[0.08]"
          >
            {t('common.cancel', 'Cancelar')}
          </button>
          <button
            type="submit"
            disabled={createThreadMutation.isPending}
            className="flex cursor-pointer items-center gap-1.5 rounded-2xl bg-[#C22B38] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#a8242f] active:scale-95 disabled:opacity-50 dark:bg-[#D93846] dark:hover:bg-[#c22b38]"
          >
            <Send size={13} />
            {createThreadMutation.isPending
              ? t('common.saving', 'Publicando...')
              : t('forum.publish', 'Publicar Hilo')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
