import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Megaphone, UserX, AlertTriangle, EyeOff, HelpCircle, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import type { ModerationReason, ModerationTargetType } from '@/shared/types/database'
import { useCreateContentReport } from './useModeration'

const REASONS: Array<{ value: ModerationReason; label: string; icon: typeof Megaphone }> = [
  { value: 'spam', label: 'Spam o publicidad', icon: Megaphone },
  { value: 'harassment', label: 'Acoso o ataques personales', icon: UserX },
  { value: 'misinformation', label: 'Información falsa', icon: AlertTriangle },
  { value: 'inappropriate', label: 'Contenido inapropiado', icon: EyeOff },
  { value: 'other', label: 'Otro motivo', icon: HelpCircle },
]

export interface ReportTarget {
  type: ModerationTargetType
  id: string
}

export function ReportContentDialog({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const { t } = useTranslation()
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
      contentClassName="!bg-white dark:!bg-neutral-900 shadow-2xl rounded-[28px] border border-neutral-100 dark:border-neutral-800"
    >
      <div className="space-y-5 pt-1">
        {/* Motivo Selector (Interactive Cards) */}
        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-[#D41F2D]" />
            Motivo del reporte
          </label>
          <div className="grid gap-2">
            {REASONS.map((item) => {
              const Icon = item.icon
              const isSelected = reason === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setReason(item.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#D41F2D] bg-red-50/60 dark:bg-red-950/30 text-neutral-900 dark:text-white shadow-sm ring-1 ring-[#D41F2D]/30'
                      : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${isSelected ? 'bg-[#D41F2D] text-white' : 'bg-neutral-200/60 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'}`}>
                      <Icon size={14} strokeWidth={2.2} />
                    </div>
                    <span className="text-xs font-bold">{item.label}</span>
                  </div>
                  {isSelected && <CheckCircle2 size={16} className="text-[#D41F2D] shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Detalle opcional */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-black uppercase tracking-wider text-neutral-400">Detalle opcional</label>
            <span className="text-[10px] font-bold text-neutral-400">{details.length}/1000</span>
          </div>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={1000}
            rows={3}
            className="w-full resize-none rounded-2xl border border-neutral-200 dark:border-neutral-700/80 bg-neutral-50 dark:bg-neutral-800/60 px-4 py-3 text-xs font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:border-[#D41F2D] focus:bg-white dark:focus:bg-neutral-900 transition-all shadow-sm"
            placeholder={t('moderation.detailsPlaceholder', 'Entrega contexto para facilitar la revisión…')}
          />
        </div>

        {/* Acciones (Capsule Buttons) */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-5 py-2.5 text-xs font-extrabold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={mutation.isPending}
            className="rounded-full bg-[#D41F2D] hover:bg-[#b11a25] text-white px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {mutation.isPending ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
