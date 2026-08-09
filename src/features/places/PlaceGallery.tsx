import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { Dialog } from '@/shared/ui/Dialog'
import { PhotoCarousel } from '@/shared/ui/PhotoCarousel'
import { MAX_PHOTO_BYTES, validatePhoto } from '@/features/pins/photos'
import { usePlacePhotos, usePlacePhotoActions, type PlaceOwner } from './placePhotos'

// ─────────────────────────────────────────────────────────────────────────────
// La portada de una facultad o de un edificio, con su galería.
//
// Antes era un `<img>` fijo con la única foto de la facultad. Ahora es el mismo
// carrusel que usan los pines —swipe, puntos, contador y visor a pantalla
// completa— sin escribir nada nuevo: `PhotoCarousel` salió de `PinDetail`
// justamente para esto.
//
// La galería es POR ENTIDAD: la facultad tiene la suya y cada edificio la suya.
// Al acotar la ficha con el chip de un edificio, la portada pasa a ser la de
// ese edificio. Si un edificio aún no tiene fotos no se hereda nada de la
// facultad — enseñar la fachada de la facultad como si fuera la del edificio
// sería una foto que miente sobre lo que estás mirando.
// ─────────────────────────────────────────────────────────────────────────────

interface PlaceGalleryProps {
  owner: PlaceOwner
  /** El `faculties.image` de siempre, para una facultad que aún no tiene galería. */
  fallbackImage?: string | null
  /** Plegada a cero cuando la hoja está expandida. */
  collapsed?: boolean
}

export function PlaceGallery({ owner, fallbackImage, collapsed = false }: PlaceGalleryProps) {
  const { photos, isLoading } = usePlacePhotos(owner)

  // El respaldo solo aplica a la facultad: un edificio sin fotos no tiene qué
  // enseñar y es mejor no ocupar sitio con nada.
  const items =
    photos.length > 0
      ? photos.map((p) => ({ id: p.id, url: p.url }))
      : fallbackImage
        ? [{ id: 'fallback', url: fallbackImage }]
        : []

  // El alto se RESERVA desde el primer fotograma y el hueco se pliega solo si
  // resulta que no hay nada. Antes se devolvía null mientras la consulta iba en
  // camino: la ficha abría sin portada y, al llegar las fotos, todo el contenido
  // saltaba 128px hacia abajo. Reservar primero y plegar después convierte el
  // caso malo (un lugar sin fotos) en una transición de 300ms en vez de un salto.
  const empty = !isLoading && items.length === 0

  return (
    <div
      className={`w-full shrink-0 overflow-hidden transition-[height] duration-300 ease-out ${
        collapsed || empty ? 'h-0' : 'h-32'
      }`}
    >
      {items.length > 0 ? (
        <PhotoCarousel photos={items} className="h-32 !rounded-none" />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-neutral-100 dark:bg-neutral-900">
          <Loader2 size={18} className="animate-spin text-neutral-300 dark:text-neutral-600" />
        </div>
      )}
    </div>
  )
}

/**
 * El acceso del admin a las fotos, para la cabecera de la ficha.
 *
 * Estaba dentro de la portada, y ahí se volvía inalcanzable: la portada se
 * pliega a cero al expandir la hoja —que es la animación que se quiere
 * conservar— y en escritorio la hoja abre expandida, así que el botón no
 * llegaba a dibujarse nunca. En la cabecera vive junto a compartir y cerrar, y
 * no depende del estado de la hoja.
 */
export function PlaceGalleryEditButton({ owner }: { owner: PlaceOwner }) {
  const { t } = useTranslation()
  const role = useAuthStore((s) => s.role)
  const [managing, setManaging] = useState(false)

  if (role !== 'admin') return null

  return (
    <>
      <button
        onClick={() => setManaging(true)}
        aria-label={t('place.editPhotos', 'Editar fotos')}
        title={t('place.editPhotos', 'Editar fotos')}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 backdrop-blur-sm transition-colors hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
      >
        <Camera size={16} />
      </button>
      {managing && <PhotoManager owner={owner} open={managing} onOpenChange={setManaging} />}
    </>
  )
}

/**
 * El gestor de fotos del admin: añadir, quitar, reordenar y elegir portada.
 *
 * La portada no es un campo aparte: es la primera de la lista. Un "marcar como
 * portada" que conviva con un orden manual da dos verdades sobre lo mismo —
 * cuál sale primero y cuál es la portada— y tarde o temprano discrepan.
 */
function PhotoManager({
  owner,
  open,
  onOpenChange,
}: {
  owner: PlaceOwner
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const showToast = useUIStore((s) => s.showToast)
  const { photos } = usePlacePhotos(owner)
  const { add, remove, reorder } = usePlacePhotoActions(owner)
  const fileRef = useRef<HTMLInputElement>(null)

  const busy = add.isPending || remove.isPending || reorder.isPending

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const picked = Array.from(files)

    const bad = picked.find((f) => validatePhoto(f) !== null)
    if (bad) {
      showToast(
        validatePhoto(bad) === 'too-large'
          ? t('photo.tooLarge', `La foto supera los ${MAX_PHOTO_BYTES / 1024 / 1024} MB`)
          : t('photo.badType', 'Formato no admitido. Usa JPG, PNG o WebP.'),
      )
      return
    }

    try {
      await add.mutateAsync(picked)
    } catch {
      showToast(t('place.photoFailed', 'No se pudieron subir las fotos'))
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const move = async (index: number, delta: -1 | 1) => {
    const next = index + delta
    if (next < 0 || next >= photos.length) return
    const ids = photos.map((p) => p.id)
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    try {
      await reorder.mutateAsync(ids)
    } catch {
      showToast(t('place.reorderFailed', 'No se pudo cambiar el orden'))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('place.managePhotos', 'Fotos del lugar')}
      description={t('place.managePhotosHint', 'La primera es la portada.')}
    >
      <div className="flex flex-col gap-3">
        {photos.length === 0 && (
          <div className="py-4 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('place.noPhotos', 'Todavía no hay fotos aquí.')}
            </p>
            <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
              {t('place.fallbackNotice', 'Se está mostrando una foto de respaldo por defecto. Sube fotos para reemplazarla.')}
            </p>
          </div>
        )}

        {photos.map((photo, i) => (
          <div key={photo.id} className="flex items-center gap-3">
            <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg">
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] font-black uppercase tracking-wider text-white">
                  {t('place.cover', 'Portada')}
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0 || busy}
                aria-label={t('place.moveUp', 'Mover antes')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200 disabled:opacity-30 dark:bg-neutral-800 dark:text-neutral-400"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === photos.length - 1 || busy}
                aria-label={t('place.moveDown', 'Mover después')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200 disabled:opacity-30 dark:bg-neutral-800 dark:text-neutral-400"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => remove.mutate(photo.id)}
                disabled={busy}
                aria-label={t('common.delete', 'Eliminar')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-[#D41F2D] transition-colors hover:bg-red-100 disabled:opacity-30 dark:bg-red-500/10"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => onPick(e.target.files)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy || photos.length >= 10}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 py-3 text-[11px] font-black uppercase tracking-wider text-neutral-500 transition-colors hover:border-neutral-400 disabled:opacity-40 dark:border-neutral-600 dark:text-neutral-400"
        >
          <Camera size={15} />
          {busy
            ? t('common.loading', 'Cargando…')
            : photos.length >= 10
              ? t('place.photoLimit', 'Máximo 10 fotos')
              : t('place.addPhotos', 'Agregar fotos')}
        </button>
      </div>
    </Dialog>
  )
}
