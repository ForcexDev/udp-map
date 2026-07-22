import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '@/shared/ui/Dialog'
import { FACULTIES } from '@/shared/data/campusData'
import { useAuthStore } from '@/features/auth/authStore'
import { useCreateThread } from './useForum'
import { CustomSelect } from '@/shared/ui/CustomSelect'
import { GraduationCap, Type, AlignLeft, Tag, Send } from 'lucide-react'

import type { ForumThread } from '@/shared/types/database'

interface CreateThreadModalProps {
  open: boolean
  onClose: () => void
  defaultFacultyId: string | null
  onCreated?: (newThread: ForumThread) => void
}

export function CreateThreadModal({ open, onClose, defaultFacultyId, onCreated }: CreateThreadModalProps) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [error, setError] = useState('')
  const createThreadMutation = useCreateThread()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [facultyId, setFacultyId] = useState<string | null>(defaultFacultyId)
  const [tagsInput, setTagsInput] = useState('')

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
      },
      {
        onSuccess: (newThread) => {
          setTitle('')
          setContent('')
          setTagsInput('')
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
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t('forum.createThreadTitle', 'Crear Nuevo Hilo')}
      description={t('forum.createThreadDesc', 'Inicia una conversación en tu facultad o en el tablón general.')}
      contentClassName="!bg-white dark:!bg-neutral-900 sm:max-w-lg shadow-2xl rounded-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
        {error && (
          <div className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-900/50">
            {error}
          </div>
        )}

        {/* Facultad / Ubicación */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10.5px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <GraduationCap size={13} className="text-[#D41F2D]" />
            {t('forum.threadFaculty', 'Facultad / Ubicación')}
          </label>
          <CustomSelect
            options={[
              { value: 'general', label: t('forum.generalTab', 'Tablón General') },
              ...FACULTIES.map((f) => ({ value: f.id, label: f.name })),
            ]}
            value={facultyId || 'general'}
            onChange={(val) => setFacultyId(val === 'general' ? null : val)}
            className="w-full"
          />
        </div>

        {/* Título */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10.5px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Type size={13} className="text-[#D41F2D]" />
            {t('forum.threadTitle', 'Título')}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('forum.titlePlaceholder', 'Ej: Dudas con el certamen de Cálculo...')}
            className="w-full bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:border-[#D41F2D] focus:bg-white dark:focus:bg-neutral-900 transition-all shadow-sm"
          />
        </div>

        {/* Contenido */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10.5px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlignLeft size={13} className="text-[#D41F2D]" />
            {t('forum.threadContent', 'Contenido')}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('forum.contentPlaceholder', 'Escribe tu publicación aquí...')}
            rows={4}
            className="w-full bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:border-[#D41F2D] focus:bg-white dark:focus:bg-neutral-900 transition-all resize-none shadow-sm"
          />
        </div>

        {/* Etiquetas */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10.5px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Tag size={13} className="text-[#D41F2D]" />
            {t('forum.threadTags', 'Etiquetas (separadas por comas)')}
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder={t('forum.tagsPlaceholder', 'Ej: calculo, certamen, ayuda')}
            className="w-full bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:border-[#D41F2D] focus:bg-white dark:focus:bg-neutral-900 transition-all shadow-sm"
          />
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-5 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
          >
            {t('common.cancel', 'Cancelar')}
          </button>
          <button
            type="submit"
            disabled={createThreadMutation.isPending}
            className="rounded-full bg-[#D41F2D] hover:bg-[#b11a25] disabled:opacity-50 text-white text-xs font-extrabold uppercase tracking-wider px-5 py-2.5 shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
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
