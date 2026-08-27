import type { ReactNode } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// La anatomía de una pantalla del panel.
//
// Existe porque el panel no la tenía: ninguna de sus secciones decía qué era.
// El resto de la aplicación abre siempre igual —título, una línea que explica
// para qué sirve la pantalla, y una regla debajo— y es lo que hace que Eventos,
// Foro y Perfil se lean como la misma app. Ver `features/events/EventsPage.tsx`.
//
// Las medidas tampoco son libres: el scroll lo tiene la PÁGINA y no el `main`
// del layout, porque el editor de mapeo necesita quedarse sin scroll y a
// pantalla completa. Por eso esto no vive en `AdminLayout`.
// ─────────────────────────────────────────────────────────────────────────────

interface AdminScreenProps {
  title: string
  description: string
  /** A la derecha del título. En móvil baja debajo, a ancho completo. */
  action?: ReactNode
  /** `max-w-3xl` es el de las páginas de lista; las rejillas piden más aire. */
  width?: 'narrow' | 'wide'
  children: ReactNode
}

export function AdminScreen({
  title,
  description,
  action,
  width = 'wide',
  children,
}: AdminScreenProps) {
  return (
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 pb-16">
      <div
        className={`mx-auto w-full px-4 pt-5 sm:px-6 ${
          width === 'narrow' ? 'max-w-3xl' : 'max-w-6xl'
        }`}
      >
        <div className="mb-5 flex flex-col gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
              {title}
            </h1>
            <p className="mt-1 text-xs font-medium text-neutral-400 dark:text-neutral-500">
              {description}
            </p>
          </div>
          {action}
        </div>

        {children}
      </div>
    </div>
  )
}

/**
 * El estado vacío canónico de la aplicación: tarjeta redonda, mucho aire, y un
 * icono grande de trazo fino que es lo más pálido de la pantalla. Copiado de
 * `EventsPage.tsx` a propósito — es el que ya reconoce quien usa la app.
 */
export function AdminEmpty({
  icon,
  title,
  hint,
}: {
  icon: ReactNode
  title: string
  hint?: string
}) {
  return (
    <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-2 rounded-3xl border border-neutral-100 bg-white p-12 text-center shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/50">
      {icon}
      <h3 className="mt-2 font-bold text-neutral-700 dark:text-neutral-300">{title}</h3>
      {hint && <p className="text-xs font-medium text-neutral-400">{hint}</p>}
    </div>
  )
}

/** Carga y error, con el mismo aspecto que las páginas públicas. */
export function AdminLoading() {
  return (
    <div className="flex h-64 items-center justify-center text-sm font-semibold text-neutral-500">
      Cargando…
    </div>
  )
}

export function AdminError({ message }: { message?: string }) {
  return (
    <div className="flex h-64 items-center justify-center px-6 text-center text-sm font-semibold text-red-500">
      {message ?? 'No se pudo cargar. Vuelve a intentarlo.'}
    </div>
  )
}
