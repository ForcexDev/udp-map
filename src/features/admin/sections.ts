import {
  Activity,
  Building2,
  LayoutDashboard,
  Megaphone,
  MapPin,
  PenTool,
  Settings,
  ShieldAlert,
  Users,
  type LucideIcon,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Las secciones del panel, en un solo sitio.
//
// Son RUTAS y no pestañas en memoria, y el cambio no es cosmético: antes el
// panel guardaba la sección activa en un `useState`, así que no había enlace
// profundo, el botón "atrás" del navegador se saltaba el panel entero, y una
// notificación no podía apuntar a una sección concreta. Con rutas, las tres
// cosas salen gratis.
//
// El orden es el de la lista de navegación y está pensado como una jornada:
// primero lo que hay que mirar (Resumen), después lo que hay que atender
// (Denuncias), y al final las herramientas.
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminSection {
  /** Ruta absoluta. `end` marca la que solo casa exacta. */
  to: string
  end?: boolean
  labelKey: string
  /** Se enseña bajo el título de la sección: para qué sirve esta pantalla. */
  descriptionKey: string
  icon: LucideIcon
  /** Trazar polígonos pide ratón. La lista lo dice en vez de dejar que alguien
   *  lo descubra abriendo una pantalla vacía en el teléfono. */
  desktopOnly?: boolean
}

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    to: '/admin',
    end: true,
    labelKey: 'admin.sections.dashboard',
    descriptionKey: 'admin.sections.dashboardHint',
    icon: LayoutDashboard,
  },
  {
    to: '/admin/moderacion',
    labelKey: 'admin.sections.reports',
    descriptionKey: 'admin.sections.reportsHint',
    icon: ShieldAlert,
  },
  {
    to: '/admin/usuarios',
    labelKey: 'admin.sections.users',
    descriptionKey: 'admin.sections.usersHint',
    icon: Users,
  },
  {
    to: '/admin/contenido',
    labelKey: 'admin.sections.content',
    descriptionKey: 'admin.sections.contentHint',
    icon: MapPin,
  },
  {
    to: '/admin/facultades',
    labelKey: 'admin.sections.faculties',
    descriptionKey: 'admin.sections.facultiesHint',
    icon: Building2,
  },
  {
    to: '/admin/difusion',
    labelKey: 'admin.sections.broadcast',
    descriptionKey: 'admin.sections.broadcastHint',
    icon: Megaphone,
  },
  {
    to: '/admin/actividad',
    labelKey: 'admin.sections.activity',
    descriptionKey: 'admin.sections.activityHint',
    icon: Activity,
  },
  {
    to: '/admin/mapeo',
    labelKey: 'admin.sections.mapping',
    descriptionKey: 'admin.sections.mappingHint',
    icon: PenTool,
    desktopOnly: true,
  },
  {
    to: '/admin/ajustes',
    labelKey: 'admin.sections.settings',
    descriptionKey: 'admin.sections.settingsHint',
    icon: Settings,
  },
]

/** La sección que corresponde a una ruta, para titular la pantalla. */
export function sectionForPath(pathname: string): AdminSection | undefined {
  // De la más específica a la más general: `/admin` casa con todo por prefijo y
  // se llevaría por delante a las demás si se mirara primero.
  return (
    ADMIN_SECTIONS.filter((s) => !s.end).find(
      (s) => pathname === s.to || pathname.startsWith(`${s.to}/`),
    ) ?? ADMIN_SECTIONS.find((s) => s.end && s.to === pathname)
  )
}
