import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, PHOTOS_BUCKET } from '@/shared/lib/supabase'
import type { PlacePhoto } from '@/shared/types/database'
import { compressImage } from '@/features/pins/photos'
import { FACULTIES } from '@/shared/data/campusData'

// ─────────────────────────────────────────────────────────────────────────────
// Galerías de facultades y edificios.
//
// Un solo módulo para las dos entidades porque en la base son una sola tabla
// (`place_photos`, con `faculty_id` o `building_id`, nunca los dos). Ver el
// razonamiento en supabase/migrations/20260805110000_place_photos.sql.
//
// Igual que el resto de features: contra Supabase si hay credenciales, contra
// un almacén en memoria si no (MODO DEMO).
//
// Escribir requiere rol admin, y lo impone RLS. Este archivo no comprueba nada:
// esconder el botón en la interfaz no impide llamar al endpoint, así que la
// única comprobación que cuenta es la de la base.
// ─────────────────────────────────────────────────────────────────────────────

export type PlaceOwner =
  | { kind: 'faculty'; id: string }
  | { kind: 'building'; id: string }

export function ownerKey(owner: PlaceOwner): string {
  return `${owner.kind}:${owner.id}`
}

const columnOf = (owner: PlaceOwner) => (owner.kind === 'faculty' ? 'faculty_id' : 'building_id')

// ── Modo demo ────────────────────────────────────────────────────────────────
// Se siembra con la foto única que ya tenía cada facultad, que es exactamente
// lo que hace la migración en la base.

let demoPhotos: PlacePhoto[] | null = null

function demoDb(): PlacePhoto[] {
  if (!demoPhotos) {
    demoPhotos = FACULTIES.filter((f) => f.image).map((f, i) => ({
      id: `demo-photo-${i}`,
      faculty_id: f.id,
      building_id: null,
      url: f.image as string,
      width: null,
      height: null,
      sort_order: 0,
      created_at: new Date().toISOString(),
    }))
  }
  return demoPhotos
}

const matches = (photo: PlacePhoto, owner: PlaceOwner) =>
  owner.kind === 'faculty' ? photo.faculty_id === owner.id : photo.building_id === owner.id

export async function fetchPlacePhotos(owner: PlaceOwner): Promise<PlacePhoto[]> {
  if (!supabase) {
    return demoDb()
      .filter((p) => matches(p, owner))
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  const { data, error } = await supabase
    .from('place_photos')
    .select('*')
    .eq(columnOf(owner), owner.id)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as PlacePhoto[]
}

/** Sube los archivos y los añade al final de la galería. */
export async function addPlacePhotos(owner: PlaceOwner, files: File[]): Promise<void> {
  if (files.length === 0) return

  const existing = await fetchPlacePhotos(owner)
  const base = existing.length

  if (!supabase) {
    const db = demoDb()
    for (const [i, file] of files.entries()) {
      db.push({
        id: `demo-photo-${Date.now()}-${i}`,
        faculty_id: owner.kind === 'faculty' ? owner.id : null,
        building_id: owner.kind === 'building' ? owner.id : null,
        url: URL.createObjectURL(file),
        width: null,
        height: null,
        sort_order: base + i,
        created_at: new Date().toISOString(),
      })
    }
    return
  }

  // Mismo criterio que `uploadPinPhotos`: se sube todo, se registra en un solo
  // insert, y si algo falla se retiran los archivos recién subidos para que un
  // reintento arranque limpio y no deje huérfanos en Storage.
  const uploaded: { path: string; url: string; width: number; height: number }[] = []
  try {
    for (const file of files) {
      const { blob, width, height } = await compressImage(file)
      const path = `places/${owner.kind}/${owner.id}/${crypto.randomUUID()}.jpg`
      const { error: upErr } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
      uploaded.push({ path, url: pub.publicUrl, width, height })
    }

    const { error } = await supabase.from('place_photos').insert(
      uploaded.map(({ url, width, height }, i) => ({
        [columnOf(owner)]: owner.id,
        url,
        width,
        height,
        sort_order: base + i,
      })),
    )
    if (error) throw error
  } catch (err) {
    if (uploaded.length > 0) {
      await supabase.storage.from(PHOTOS_BUCKET).remove(uploaded.map((p) => p.path))
    }
    throw err
  }
}

export async function deletePlacePhoto(id: string): Promise<void> {
  if (!supabase) {
    demoPhotos = demoDb().filter((p) => p.id !== id)
    return
  }
  const { error } = await supabase.from('place_photos').delete().eq('id', id)
  if (error) throw error
}

/**
 * Reescribe el orden completo de una galería. Se manda el orden ENTERO y no el
 * par que se intercambió porque, si dos administradores tocan la misma galería,
 * mandar la lista completa deja un orden coherente en vez de dos posiciones
 * pisadas con huecos.
 */
export async function reorderPlacePhotos(ids: string[]): Promise<void> {
  if (!supabase) {
    const db = demoDb()
    ids.forEach((id, i) => {
      const photo = db.find((p) => p.id === id)
      if (photo) photo.sort_order = i
    })
    return
  }
  for (const [i, id] of ids.entries()) {
    const { error } = await supabase.from('place_photos').update({ sort_order: i }).eq('id', id)
    if (error) throw error
  }
}

export function usePlacePhotos(owner: PlaceOwner | null) {
  const query = useQuery({
    queryKey: ['place-photos', owner ? ownerKey(owner) : 'none'],
    queryFn: () => fetchPlacePhotos(owner as PlaceOwner),
    enabled: owner !== null,
    staleTime: 5 * 60_000,
    // La galería es decoración: si falla, la ficha tiene que seguir abriéndose.
    retry: 1,
  })

  return { photos: query.data ?? [], isLoading: query.isLoading }
}

export function usePlacePhotoActions(owner: PlaceOwner | null) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['place-photos', owner ? ownerKey(owner) : 'none'],
    })

  const add = useMutation({
    mutationFn: (files: File[]) => addPlacePhotos(owner as PlaceOwner, files),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => deletePlacePhoto(id),
    onSuccess: invalidate,
  })
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderPlacePhotos(ids),
    onSuccess: invalidate,
  })

  return { add, remove, reorder }
}
