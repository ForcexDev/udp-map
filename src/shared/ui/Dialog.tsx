import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  hideClose?: boolean
  contentClassName?: string
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  hideClose,
  contentClassName,
}: DialogProps) {
  const { t } = useTranslation()
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        {/* z-4500 / z-4510, y no z-40 / z-50 como hasta ahora.

            Este es el diálogo MODAL de la aplicación y estaba por debajo de casi
            todo lo que flota: el Sidebar es z-2000, CreatePinModal 3000, el
            aviso emergente 3500 y el visor de fotos 4000. O sea que un diálogo
            abierto desde cualquiera de ellos existía en el DOM, respondía al
            teclado y al ratón, y NO SE VEÍA: quedaba pintado detrás.

            Se descubrió con la confirmación de "Vaciar todo" del centro de
            avisos, que se abre con el Sidebar delante. Antes no saltaba porque
            el Sidebar no abría ningún diálogo —el tutorial y "Sobre nosotros"
            se abren después de cerrarlo—, así que el fallo estaba puesto y
            esperando al primero que lo hiciera.

            Por encima de todo salvo el Toast (z-99999), que tiene que poder
            avisar de algo aunque haya un modal abierto. */}
        <RadixDialog.Overlay className="fixed inset-0 z-[4500] bg-black/50 backdrop-blur-sm" />
        <RadixDialog.Content
          className={`fixed left-1/2 top-1/2 z-[4510] max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto hide-scrollbar rounded-3xl border border-[#E5DEC9] bg-[#FAF8F5] p-6 premium-shadow animate-scale-in dark:border-white/10 dark:bg-[#151820] ${contentClassName || ''}`}
          aria-describedby={description ? undefined : ''}
          onInteractOutside={(e) => {
            if (hideClose) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            if (hideClose) e.preventDefault()
          }}
        >
          <div className="mb-3 flex items-start justify-between gap-4 shrink-0">
            <RadixDialog.Title className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {title}
            </RadixDialog.Title>
            {!hideClose && (
              <RadixDialog.Close
                aria-label={t('common.close')}
                className="rounded-full p-1 text-stone-500 hover:bg-[#EFECE4] dark:hover:bg-white/[0.08] dark:text-stone-400 cursor-pointer"
              >
                <X size={18} />
              </RadixDialog.Close>
            )}
          </div>
          {description && (
            <RadixDialog.Description className="mb-4 text-sm text-stone-600 dark:text-stone-400 shrink-0">
              {description}
            </RadixDialog.Description>
          )}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
