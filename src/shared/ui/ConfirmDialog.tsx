import { Dialog } from './Dialog'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  danger?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  onConfirm,
  danger = true,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      contentClassName="!bg-[#FAF8F5] dark:!bg-[#151820] border border-[#E5DEC9] dark:border-white/10 rounded-3xl premium-shadow"
    >
      <div className="mt-6 flex justify-end gap-3">
        <Button
          variant="secondary"
          className="rounded-2xl font-semibold bg-[#EFECE4] text-stone-700 hover:bg-stone-200 dark:bg-white/[0.08] dark:text-stone-200 dark:hover:bg-white/[0.12]"
          onClick={() => onOpenChange(false)}
        >
          {cancelText}
        </Button>
        <Button
          onClick={() => {
            onConfirm()
            onOpenChange(false)
          }}
          className={`rounded-2xl font-semibold shadow-xs ${
            danger
              ? 'bg-[#C22B38] hover:bg-[#A82430] dark:bg-[#D93846] dark:hover:bg-[#C22B38] text-white'
              : 'bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900'
          }`}
        >
          {confirmText}
        </Button>
      </div>
    </Dialog>
  )
}
