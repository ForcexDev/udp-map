import { useState } from 'react'
import { Dialog } from '@/shared/ui/Dialog'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import type { ModerationReason, ModerationTargetType } from '@/shared/types/database'
import { useCreateContentReport } from './useModeration'

const REASONS: Array<{ value: ModerationReason; label: string }> = [
  { value: 'spam', label: 'Spam o publicidad' },
  { value: 'harassment', label: 'Acoso o ataques personales' },
  { value: 'misinformation', label: 'Información falsa' },
  { value: 'inappropriate', label: 'Contenido inapropiado' },
  { value: 'other', label: 'Otro motivo' },
]

export interface ReportTarget {
  type: ModerationTargetType
  id: string
}

export function ReportContentDialog({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const user = useAuthStore((state) => state.user)
  const showToast = useUIStore((state) => state.showToast)
  const mutation = useCreateContentReport()
  const [reason, setReason] = useState<ModerationReason>('spam')
  const [details, setDetails] = useState('')

  const submit = () => {
    if (!target || !user || mutation.isPending) return
    mutation.mutate({
      reporterId: user.id,
      targetType: target.type,
      targetId: target.id,
      reason,
      details: details.trim() || undefined,
    }, {
      onSuccess: () => {
        showToast('Reporte enviado a administración.')
        setReason('spam')
        setDetails('')
        onClose()
      },
      onError: (error) => showToast(error instanceof Error ? error.message : 'No se pudo enviar el reporte.'),
    })
  }

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(open) => !open && onClose()}
      title="Reportar contenido"
      description="El reporte será privado y quedará disponible exclusivamente para administradores."
    >
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-black uppercase tracking-wide text-neutral-500">Motivo</legend>
          {REASONS.map((item) => (
            <label key={item.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-semibold dark:border-neutral-700">
              <input type="radio" name="report-reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} className="accent-[#D41F2D]" />
              {item.label}
            </label>
          ))}
        </fieldset>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-neutral-500">Detalle opcional</span>
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} rows={4} className="mt-2 w-full resize-none rounded-xl border border-neutral-200 bg-white p-3 text-sm outline-none focus:border-[#D41F2D] dark:border-neutral-700 dark:bg-neutral-900" placeholder="Entrega contexto para facilitar la revisión…" />
          <span className="mt-1 block text-right text-[10px] text-neutral-400">{details.length}/1000</span>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-xs font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">Cancelar</button>
          <button type="button" onClick={submit} disabled={mutation.isPending} className="rounded-full bg-[#D41F2D] px-4 py-2 text-xs font-black text-white disabled:opacity-50">{mutation.isPending ? 'Enviando…' : 'Enviar reporte'}</button>
        </div>
      </div>
    </Dialog>
  )
}
