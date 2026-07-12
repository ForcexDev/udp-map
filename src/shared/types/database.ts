import type { Polygon, FeatureCollection } from 'geojson'

// Tipos espejo del esquema Postgres (supabase/migrations/*).
// Regenerar con `supabase gen types typescript` cuando el proyecto esté linkeado.

export type PinType = 'place' | 'event' | 'report'
export type Role = 'guest' | 'student' | 'moderator' | 'admin'
export type CategoryKind = 'report' | 'event'

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

export interface Career {
  id: number
  faculty_id: string
  name: string
  name_en: string
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
  floor: number | null
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
  body: string
  created_at: string
}

export interface PinVote {
  pin_id: string
  user_id: string
  value: 1 | -1
}

export interface Favorite {
  user_id: string
  pin_id: string
}

export interface FloorPlan {
  id: string
  place_pin_id: string | null
  faculty_id: string | null
  building: string
  floor: number
  geojson: FeatureCollection
  bounds: [[number, number], [number, number]] | null
  image_overlay: string | null
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
  created_at: string
  updated_at: string
  author_name?: string | null
}

export interface ForumComment {
  id: string
  thread_id: string
  parent_comment_id: string | null
  author_id: string
  content: string
  created_at: string
  author_name?: string | null
}

export interface ForumVote {
  thread_id: string
  user_id: string
  value: 1 | -1
}

