import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { FACULTIES } from '@/shared/data/campusData'
import { useAuthStore } from '@/features/auth/authStore'
import { useCreateThread } from './useForum'

interface CreateThreadModalProps {
  open: boolean
  onClose: () => void
  defaultFacultyId: string | null
}

export function CreateThreadModal({ open, onClose, defaultFacultyId }: CreateThreadModalProps) {
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
        onSuccess: () => {
          setTitle('')
          setContent('')
          setTagsInput('')
          setError('')
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
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="text-xs font-bold text-red-500 bg-red-100/50 dark:bg-red-900/20 p-2.5 rounded-xl border border-red-500/20">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            {t('forum.threadFaculty', 'Facultad / Ubicación')}
          </label>
          <select
            value={facultyId || 'general'}
            onChange={(e) => setFacultyId(e.target.value === 'general' ? null : e.target.value)}
            className="w-full bg-white/50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-[#D41F2D] transition-colors"
          >
            <option value="general">{t('forum.generalTab', 'Tablón General')}</option>
            {FACULTIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            {t('forum.threadTitle', 'Título')}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('forum.titlePlaceholder', 'Ej: Dudas con el certamen de Cálculo...')}
            className="w-full bg-white/50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-[#D41F2D] transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            {t('forum.threadContent', 'Contenido')}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('forum.contentPlaceholder', 'Escribe tu publicación aquí...')}
            rows={5}
            className="w-full bg-white/50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-[#D41F2D] transition-colors resize-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            {t('forum.threadTags', 'Etiquetas (separadas por comas)')}
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder={t('forum.tagsPlaceholder', 'Ej: calculo, certamen, ayuda')}
            className="w-full bg-white/50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-[#D41F2D] transition-colors"
          />
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel', 'Cancelar')}
          </Button>
          <Button
            type="submit"
            disabled={createThreadMutation.isPending}
            className="bg-[#D41F2D] hover:bg-[#b11a25] text-white"
          >
            {createThreadMutation.isPending
              ? t('common.saving', 'Publicando...')
              : t('forum.publish', 'Publicar Hilo')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
