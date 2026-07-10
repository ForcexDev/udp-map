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
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {cancelText}
        </Button>
        <Button
          onClick={() => {
            onConfirm()
            onOpenChange(false)
          }}
          className={danger ? 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700 dark:text-white' : ''}
        >
          {confirmText}
        </Button>
      </div>
    </Dialog>
  )
}
