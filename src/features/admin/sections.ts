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
  label: string
  /** Se enseña bajo el título de la sección: para qué sirve esta pantalla. */
  description: string
  icon: LucideIcon
  /** Trazar polígonos pide ratón. La lista lo dice en vez de dejar que alguien
   *  lo descubra abriendo una pantalla vacía en el teléfono. */
  desktopOnly?: boolean
}

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    to: '/admin',
    end: true,
    label: 'Resumen',
    description: 'Cómo va la comunidad y qué necesita atención ahora mismo.',
    icon: LayoutDashboard,
  },
  {
    to: '/admin/moderacion',
    label: 'Denuncias',
    description: 'Reportes de la comunidad: tomar el caso, descartar o eliminar.',
    icon: ShieldAlert,
  },
  {
    to: '/admin/usuarios',
    label: 'Usuarios',
    description: 'Quién está registrado y qué rol tiene cada uno.',
    icon: Users,
  },
  {
    to: '/admin/contenido',
    label: 'Contenido',
    description: 'Todo lo publicado en el mapa, para revisarlo o retirarlo.',
    icon: MapPin,
  },
  {
    to: '/admin/facultades',
    label: 'Facultades',
    description: 'Nombre, campus e imagen. El perímetro se traza en el editor.',
    icon: Building2,
  },
  {
    to: '/admin/difusion',
    label: 'Difusión',
    description: 'Enviar un aviso a todos los dispositivos suscritos.',
    icon: Megaphone,
  },
  {
    to: '/admin/actividad',
    label: 'Actividad',
    description: 'Lo último que ha pasado en la aplicación.',
    icon: Activity,
  },
  {
    to: '/admin/mapeo',
    label: 'Mapeo',
    description: 'Edificios, plantas y áreas del campus.',
    icon: PenTool,
    desktopOnly: true,
  },
  {
    to: '/admin/ajustes',
    label: 'Ajustes',
    description: 'Este dispositivo y las herramientas que cambian cómo se ve el mapa.',
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
