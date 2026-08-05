import type { Polygon } from 'geojson'

// Tipos espejo del esquema Postgres. La fuente de verdad es
// supabase/schema/baseline.sql; docs/DATABASE.md explica qué hace cada tabla.
// Regenerar con `supabase gen types typescript` cuando el proyecto esté linkeado.
//
// Aquí solo están las tablas que consulta el cliente. Las internas
// (pin_creation_events, notification_push_deliveries, storage_cleanup_queue)
// no aparecen a propósito: tienen RLS sin ninguna política y solo las tocan
// funciones SECURITY DEFINER y service_role.

export type PinType = 'place' | 'event' | 'report'
export type Role = 'guest' | 'student' | 'moderator' | 'admin'
type CategoryKind = 'report' | 'event'

export interface Profile {
  id: string
  email: string
  name: string | null
  role: Role
  faculty_id: string | null
  career: string | null
  year: number | null
  karma: number
  avatar_url: string | null
  created_at: string
}

export interface Campus {
  id: string
  name: string
  lat: number
  lng: number
}

export interface Faculty {
  id: string
  name: string
  name_en: string
  campus_id: string
  lat: number
  lng: number
  polygon: Polygon | null
  image: string | null
}

export interface Category {
  id: string
  kind: CategoryKind
  name: string
  name_en: string
  emoji: string
  color: string
  /** SVG path data for the category icon (24x24 viewBox) */
  svgPath?: string
  /** TTL por defecto para pines `report` de esta categoría (null = sin TTL) */
  ttl_hours: number | null
}

export interface Pin {
  id: string
  type: PinType
  title: string
  description: string | null
  category_id: string | null
  faculty_id: string | null
  lat: number
  lng: number
  /** Lo elige quien publica: desde arriba, el piso 1 y el 3 son el mismo punto. */
  floor: number | null
  /** Se deduce del punto al crear y al mover. */
  building_id: string | null
  area_id: string | null
  /** Código de sala de la universidad. Texto libre; no decide nada. */
  room_code: string | null
  /** @deprecated columna de la v1, siempre null. La reemplaza `building_id`. */
  building: string | null
  creator_id: string | null
  creator_name?: string | null
  votes_up: number
  votes_down: number
  reports: number
  is_permanent: boolean
  expires_at: string | null
  starts_at: string | null
  ends_at: string | null
  is_official: boolean
  official_entity_name?: string | null
  verifier_entity_name?: string | null
  created_at: string
  /** join opcional */
  pin_photos?: PinPhoto[]
}

export interface PinPhoto {
  id: string
  pin_id: string
  url: string
  width: number | null
  height: number | null
  created_at: string
}

export interface PinComment {
  id: string
  pin_id: string
  author_id: string | null
  author_name: string | null
  author_avatar_url?: string | null
  body: string
  created_at: string
}

/** Bloque del programa de un evento ("14:00 · Charla con X"). Opcional. */
export interface PinScheduleItem {
  id: string
  pin_id: string
  starts_at: string
  ends_at: string | null
  title: string
  subtitle: string | null
  sort_order: number
  created_at?: string
}

/** Lo que la interfaz envía al guardar; el id y created_at los pone la base. */
export type PinScheduleDraft = Omit<PinScheduleItem, 'id' | 'pin_id' | 'created_at'>

export interface Favorite {
  user_id: string
  pin_id: string
}

// ── Mapeo interior ──────────────────────────────────────────────────────────
// Facultad → Edificio → Planta → Área. La tabla `floor_plans` sigue existiendo
// en la base, reservada para un plano de piso como imagen superpuesta
// (docs/PLAN_PISOS_Y_ONBOARDING.md §13); no se declara su tipo mientras nada la
// consuma.

export type AreaKind =
  | 'hall'
  | 'corridor'
  | 'cafeteria'
  | 'kiosk'
  | 'lab'
  | 'office'
  | 'service'
  | 'courtyard'
  | 'sports'
  | 'parking'
  | 'green'
  | 'other'

export interface Building {
  id: string
  faculty_id: string
  name: string
  short_name: string | null
  /** Nombres de pasillo ("el edificio del KAEA"), para la búsqueda. */
  aliases: string[]
  footprint: Polygon
  default_floor: number
  /** Solo para edificios que faltan en OpenStreetMap; al resto los levanta el estilo. */
  height_m: number | null
  color: string | null
  sort_order: number
}

export interface BuildingFloor {
  building_id: string
  /** 1 = planta baja, -1 = primer subterráneo. El 0 no existe. */
  level: number
  label: string | null
}

export interface Area {
  id: string
  faculty_id: string
  /** null ⇔ `floor` null: es un área exterior (patio, cancha). */
  building_id: string | null
  floor: number | null
  kind: AreaKind
  /** Nombre del tipo cuando `kind` es 'other'. La lista cerrada siempre se queda corta. */
  custom_kind: string | null
  name: string
  polygon: Polygon
  color: string | null
  sort_order: number
}

export interface EventRsvp {
  pin_id: string
  user_id: string
  status: 'going' | 'interested'
}

export interface ForumThread {
  id: string
  faculty_id: string | null
  author_id: string
  title: string
  content: string
  tags: string[]
  votes_up: number
  votes_down: number
  is_pinned: boolean
  is_official: boolean
  official_entity_name?: string | null
  created_at: string
  updated_at: string
  author_name?: string | null
  author_avatar_url?: string | null
  comment_count?: number
}

export interface ForumComment {
  id: string
  thread_id: string
  parent_comment_id: string | null
  author_id: string
  content: string
  created_at: string
  author_name?: string | null
  author_avatar_url?: string | null
}

export interface Badge {
  id: string
  name: string
  name_en: string
  description: string
  description_en: string
}

export interface UserBadge {
  user_id: string
  badge_id: string
  awarded_at: string
  badge?: Badge
}

export type NotificationCategory = 'profile' | 'forum' | 'events' | 'moderation'
type NotificationAudience = 'personal' | 'admin'
type NotificationType =
  | 'achievement'
  | 'forum_reply'
  | 'event_reminder'
  | 'moderation_report'
  | 'moderation_update'

export interface AppNotification {
  id: string
  user_id: string
  actor_id: string | null
  type: NotificationType
  category: NotificationCategory
  audience: NotificationAudience
  title: string
  body: string
  url: string
  payload: Record<string, unknown>
  dedupe_key: string
  read_at: string | null
  created_at: string
}

export type ModerationTargetType = 'pin' | 'pin_comment' | 'forum_thread' | 'forum_comment'
export type ModerationReason = 'spam' | 'harassment' | 'misinformation' | 'inappropriate' | 'other'
export type ModerationStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed'

export interface ContentReport {
  id: string
  target_type: ModerationTargetType
  target_id: string
  reporter_id: string
  reporter_name?: string | null
  reason: ModerationReason
  details: string | null
  snapshot: Record<string, unknown>
  status: ModerationStatus
  assigned_to: string | null
  resolution_action: 'dismiss' | 'delete' | null
  resolution_note: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}


