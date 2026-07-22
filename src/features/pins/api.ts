import { supabase, PHOTOS_BUCKET } from '@/shared/lib/supabase'
import type { Pin, PinComment, PinType } from '@/shared/types/database'
import type { Bounds } from '@/shared/utils/geo'
import { isInBounds } from '@/shared/utils/geo'
import { expiresAtFromTtl } from '@/shared/utils/expiry'
import { categoryById } from '@/shared/data/campusData'
import { facultyIdAt } from '@/shared/data/facultyPerimeters'
import type { PinFilters } from '@/shared/stores/filterStore'
import { compressImage, photoStoragePath } from './photos'
import { demoDb, demoAddPhotos, demoRemovePhotos, demoRecountVotes, demoVerifyPin, demoExtendPinTTL, demoPinCreationEvents } from './demoStore'
import { useAuthStore } from '@/features/auth/authStore'
import { can } from '@/features/auth/permissions'
import { hasReachedDailyPinLimit } from '@/shared/utils/rateLimit'

export interface CreatePinInput {
  type: PinType
  title: string
  description: string | null
  categoryId: string | null
  facultyId: string | null
  lat: number
  lng: number
  userId: string
  userName: string
  isOfficial?: boolean
  officialEntityName?: string | null
  startsAt?: string | null
  endsAt?: string | null
}

const nowIso = () => new Date().toISOString()

function isLivePin(p: Pin, now = Date.now()): boolean {
  if (p.is_permanent || !p.expires_at) return true
  return new Date(p.expires_at).getTime() > now
}

// ── Lectura paginada/filtrada por bounds (plan §7: no traer todo) ──

export async function fetchPins(bounds: Bounds | null, filters: PinFilters): Promise<Pin[]> {
  if (!supabase) {
    return demoDb.pins.filter(
      (p) =>
        isLivePin(p) &&
        filters.types.includes(p.type) &&
        (!filters.categoryId || p.category_id === filters.categoryId) &&
        (!filters.facultyId || p.faculty_id === filters.facultyId) &&
        (!bounds || isInBounds(p, bounds)),
    )
  }

  let query = supabase
    .from('pins')
    .select('*, pin_photos(*), profiles!pins_creator_id_fkey(name)')
    .in('type', filters.types)
    .or(`is_permanent.eq.true,expires_at.gt.${nowIso()}`)
    .order('created_at', { ascending: false })
    .limit(300)

  if (bounds) {
    query = query
      .gte('lat', bounds.south)
      .lte('lat', bounds.north)
      .gte('lng', bounds.west)
      .lte('lng', bounds.east)
  }
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.facultyId) query = query.eq('faculty_id', filters.facultyId)

  try {
    const { data, error } = await query
    if (error) {
      console.error('Error fetching pins from Supabase:', error)
      return []
    }
    
    type PinRow = Pin & { profiles?: { name: string | null } | null | { name: string | null }[] }
    return (data ?? []).map((row) => {
      const { profiles, ...p } = row as PinRow
      const creatorName = Array.isArray(profiles) ? profiles[0]?.name : profiles?.name
      
      return {
        ...p,
        creator_name: creatorName ?? null,
      }
    }) as Pin[]
  } catch (err) {
    console.error('Unexpected error fetching pins:', err)
    return []
  }
}

// ── Creación con N fotos (compresión + manejo de error + UUID) ──

export async function createPin(input: CreatePinInput, photos: File[]): Promise<Pin> {
  const category = input.categoryId ? categoryById(input.categoryId) : undefined
  const isPlace = input.type === 'place'
  let expires_at = isPlace ? null : expiresAtFromTtl(category?.ttl_hours ?? 24)
  if (input.type === 'event' && input.endsAt) {
    expires_at = input.endsAt
  }
  // Cluster automático por perímetro: si el usuario no eligió facultad y el
  // pin cae dentro de un perímetro trazado (hoy solo Ingeniería), se asigna solo.
  const facultyId = input.facultyId !== undefined ? input.facultyId : facultyIdAt(input.lat, input.lng)

  if (!supabase) {
    const role = useAuthStore.getState().role
    const hasDailyLimit = role !== 'moderator' && role !== 'admin'
    if (hasDailyLimit && hasReachedDailyPinLimit(demoPinCreationEvents, input.userId)) {
      throw new Error('DAILY_PIN_LIMIT_REACHED')
    }

    const pin: Pin = {
      id: crypto.randomUUID(),
      type: input.type,
      title: input.title,
      description: input.description,
      category_id: input.categoryId,
      faculty_id: facultyId,
      lat: input.lat,
      lng: input.lng,
      floor: null,
      building: null,
      creator_id: input.userId,
      votes_up: 0,
      votes_down: 0,
      reports: 0,
      is_permanent: isPlace,
      expires_at,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      is_official: input.isOfficial ?? false,
      official_entity_name: input.officialEntityName ?? (input.isOfficial ? 'Administración UDP' : null),
      created_at: nowIso(),
      pin_photos: [],
    }
    demoDb.pins.unshift(pin)
    demoPinCreationEvents.push({ creator_id: input.userId, created_at: pin.created_at })
    demoAddPhotos(pin.id, photos)
    return pin
  }

  const { data, error } = await supabase
    .rpc('create_pin_with_daily_limit', {
      p_type: input.type,
      p_title: input.title,
      p_description: input.description,
      p_category_id: input.categoryId,
      p_faculty_id: facultyId,
      p_lat: input.lat,
      p_lng: input.lng,
      p_is_official: input.isOfficial ?? false,
      p_official_entity_name: input.officialEntityName ?? null,
      p_expires_at: expires_at,
      p_starts_at: input.startsAt ?? null,
      p_ends_at: input.endsAt ?? null,
    })
    .select()
    .single()
  if (error) throw error
  const pin = data as Pin

  // Subida de N fotos; si una falla, el pin queda creado y se reporta el error
  for (const file of photos) {
    const { blob, width, height } = await compressImage(file)
    const path = photoStoragePath(input.userId)
    const { error: upErr } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg' })
    if (upErr) throw upErr
    const { data: pub } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
    const { error: photoErr } = await supabase
      .from('pin_photos')
      .insert({ pin_id: pin.id, url: pub.publicUrl, width, height })
    if (photoErr) throw photoErr
  }
  return pin
}

export async function updatePin(
  pinId: string, 
  input: Partial<CreatePinInput>,
  options?: {
    newPhotos?: File[]
    deletedPhotoIds?: string[]
  }
): Promise<void> {
  const { newPhotos = [], deletedPhotoIds = [] } = options ?? {}

  if (!supabase) {
    const pin = demoDb.pins.find((p) => p.id === pinId)
    if (pin) {
      if (input.title !== undefined) pin.title = input.title
      if (input.description !== undefined) pin.description = input.description
      
      const isModerator = can(useAuthStore.getState().role, 'pin.moderate')
      const isVerified = pin.is_permanent
      const canEditStruct = !isVerified || isModerator

      if (canEditStruct) {
        if (input.categoryId !== undefined) pin.category_id = input.categoryId
        if (input.facultyId !== undefined) pin.faculty_id = input.facultyId
      }
      
      if (input.type !== undefined) pin.type = input.type
      if (input.isOfficial !== undefined) pin.is_official = input.isOfficial
      if (input.officialEntityName !== undefined) pin.official_entity_name = input.officialEntityName
      if (input.startsAt !== undefined) pin.starts_at = input.startsAt
      if (input.endsAt !== undefined) {
        pin.ends_at = input.endsAt
        if (pin.type === 'event') pin.expires_at = input.endsAt
      }
      if (deletedPhotoIds.length > 0) demoRemovePhotos(pinId, deletedPhotoIds)
      if (newPhotos.length > 0) demoAddPhotos(pinId, newPhotos)
    }
    return
  }

  // 1. Actualizar datos base
  const { error } = await supabase
    .from('pins')
    .update({
      title: input.title,
      description: input.description,
      category_id: input.categoryId,
      faculty_id: input.facultyId,
      type: input.type,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      ...(input.type === 'event' && input.endsAt !== undefined ? { expires_at: input.endsAt } : {}),
      ...(input.isOfficial !== undefined ? { is_official: input.isOfficial } : {}),
      ...(input.officialEntityName !== undefined ? { official_entity_name: input.officialEntityName } : {})
    })
    .eq('id', pinId)
  if (error) throw error

  // 2. Eliminar fotos de Storage y tabla
  if (deletedPhotoIds.length > 0) {
    const { data: photosToDelete } = await supabase
      .from('pin_photos')
      .select('id, url')
      .in('id', deletedPhotoIds)

    if (photosToDelete && photosToDelete.length > 0) {
      const storagePaths = photosToDelete
        .map((ph) => ph.url.split(`/${PHOTOS_BUCKET}/`)[1])
        .filter((p): p is string => Boolean(p))

      if (storagePaths.length > 0) {
        await supabase.storage.from(PHOTOS_BUCKET).remove(storagePaths)
      }
      await supabase.from('pin_photos').delete().in('id', deletedPhotoIds)
    }
  }

  // 3. Subir nuevas fotos
  if (newPhotos.length > 0 && input.userId) {
    for (const file of newPhotos) {
      const { blob, width, height } = await compressImage(file)
      const path = photoStoragePath(input.userId)
      const { error: upErr } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
      const { error: photoErr } = await supabase
        .from('pin_photos')
        .insert({ pin_id: pinId, url: pub.publicUrl, width, height })
      if (photoErr) throw photoErr
    }
  }
}

// ── Borrado (dueño o mod/admin vía RLS) + limpieza de Storage ──

export async function deletePin(pin: Pin): Promise<void> {
  if (!supabase) {
    demoDb.pins = demoDb.pins.filter((p) => p.id !== pin.id)
    demoDb.comments.delete(pin.id)
    demoDb.votes.delete(pin.id)
    return
  }
  // Borrar archivos del Storage ANTES del row (evita fugas, plan §0 auditoría)
  const paths = (pin.pin_photos ?? [])
    .map((ph) => ph.url.split(`/${PHOTOS_BUCKET}/`)[1])
    .filter((p): p is string => Boolean(p))
  if (paths.length > 0) await supabase.storage.from(PHOTOS_BUCKET).remove(paths)
  const { error } = await supabase.from('pins').delete().eq('id', pin.id)
  if (error) throw error
}

// ── Votos: RPC atómico (1 voto por usuario, reemplaza localStorage v1) ──

export async function votePin(pinId: string, value: 1 | -1, userId: string): Promise<void> {
  if (!supabase) {
    const pin = demoDb.pins.find((p) => p.id === pinId)
    if (!pin) return
    const votes = demoDb.votes.get(pinId) ?? new Map<string, 1 | -1>()
    votes.set(userId, value)
    demoDb.votes.set(pinId, votes)
    demoRecountVotes(pin)
    return
  }
  const { error } = await supabase.rpc('vote_pin', { p_pin: pinId, p_value: value })
  if (error) throw error
}

// ── Permanente & Verificación (moderador/admin, RPC security definer) ──

export async function makePermanent(pinId: string, verifierName: string = 'Centro de Alumnos FIC'): Promise<void> {
  return verifyPin(pinId, verifierName)
}

export async function verifyPin(pinId: string, verifierName: string = 'Centro de Alumnos FIC'): Promise<void> {
  if (!supabase) {
    demoVerifyPin(pinId, verifierName)
    return
  }
  const { error } = await supabase.rpc('verify_and_make_permanent', { 
    p_pin: pinId, 
    p_verifier_name: verifierName 
  })
  if (error) throw error
}

export async function extendPinTTL(pinId: string, hours: number = 24): Promise<void> {
  if (!supabase) {
    demoExtendPinTTL(pinId, hours)
    return
  }
  const { error } = await supabase.rpc('extend_pin_ttl', { 
    p_pin: pinId, 
    p_hours: hours 
  })
  if (error) throw error
}

// ── Reubicación (moderador/admin) ──

export async function updatePinLocation(pinId: string, lat: number, lng: number): Promise<void> {
  const facultyId = facultyIdAt(lat, lng)
  if (!supabase) {
    const pin = demoDb.pins.find((p) => p.id === pinId)
    if (pin) {
      const isModerator = can(useAuthStore.getState().role, 'pin.moderate')
      if (pin.is_permanent && !isModerator) return // Protected fields
      pin.lat = lat
      pin.lng = lng
      pin.faculty_id = facultyId
    }
    return
  }
  const { error } = await supabase
    .from('pins')
    .update({ lat, lng, faculty_id: facultyId })
    .eq('id', pinId)
  if (error) throw error
}

// ── Favoritos ──

export async function fetchFavoriteIds(userId: string): Promise<string[]> {
  if (!supabase) {
    return [...demoDb.favorites]
      .filter((k) => k.startsWith(`${userId}:`))
      .map((k) => k.split(':')[1])
  }
  const { data, error } = await supabase.from('favorites').select('pin_id').eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((r) => r.pin_id as string)
}

export async function toggleFavorite(pinId: string, userId: string, next: boolean): Promise<void> {
  if (!supabase) {
    const key = `${userId}:${pinId}`
    if (next) demoDb.favorites.add(key)
    else demoDb.favorites.delete(key)
    return
  }
  if (next) {
    const { error } = await supabase.from('favorites').insert({ pin_id: pinId, user_id: userId })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('pin_id', pinId)
      .eq('user_id', userId)
    if (error) throw error
  }
}

// ── Comentarios paginados ──

export const COMMENTS_PAGE_SIZE = 20

export async function fetchComments(pinId: string, before?: string): Promise<PinComment[]> {
  if (!supabase) {
    const all = demoDb.comments.get(pinId) ?? []
    return [...all].sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  let query = supabase
    .from('pin_comments')
    .select('*, profiles(name)')
    .eq('pin_id', pinId)
    .order('created_at', { ascending: false })
    .limit(COMMENTS_PAGE_SIZE)
  if (before) query = query.lt('created_at', before)
  const { data, error } = await query
  if (error) throw error
  type Row = PinComment & { profiles: { name: string | null } | null }
  return ((data ?? []) as Row[])
    .map(({ profiles, ...c }) => ({ ...c, author_name: profiles?.name ?? null }))
    .reverse()
}

export async function addComment(
  pinId: string,
  body: string,
  userId: string,
  userName: string,
): Promise<PinComment> {
  if (!supabase) {
    const comment: PinComment = {
      id: crypto.randomUUID(),
      pin_id: pinId,
      author_id: userId,
      author_name: userName,
      body,
      created_at: nowIso(),
    }
    const list = demoDb.comments.get(pinId) ?? []
    demoDb.comments.set(pinId, [...list, comment])
    return comment
  }
  const { data, error } = await supabase
    .from('pin_comments')
    .insert({ pin_id: pinId, author_id: userId, body })
    .select()
    .single()
  if (error) throw error
  return { ...(data as PinComment), author_name: userName }
}

export async function deleteComment(commentId: string, pinId: string): Promise<void> {
  if (!supabase) {
    const list = demoDb.comments.get(pinId) ?? []
    demoDb.comments.set(pinId, list.filter(c => c.id !== commentId))
    return
  }
  const { error } = await supabase
    .from('pin_comments')
    .delete()
    .eq('id', commentId)
  if (error) throw error
}
