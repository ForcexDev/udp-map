import { useTranslation } from 'react-i18next'
import { X, Share2 } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { FACULTIES } from '@/shared/data/campusData'
import { usePins } from '@/features/pins/usePins'
import { DraggableBottomSheet } from '@/shared/ui/DraggableBottomSheet'

export function FacultyDetail() {
  const { t } = useTranslation()
  const selectedFacultyId = useUIStore((s) => s.selectedFacultyId)
  const selectFaculty = useUIStore((s) => s.selectFaculty)
  const selectPin = useUIStore((s) => s.selectPin)
  const showToast = useUIStore((s) => s.showToast)
  const { pins } = usePins()

  if (!selectedFacultyId) return null

  const faculty = FACULTIES.find((f) => f.id === selectedFacultyId)
  if (!faculty) return null

  const facultyPins = pins.filter((p) => p.faculty_id === selectedFacultyId && p.type !== 'place')

  const handleShare = async () => {
    const url = `${window.location.origin}/mapa?faculty=${faculty.id}`
    const text = `${faculty.name} — UDP Map`
    try {
      if (navigator.share) {
        await navigator.share({ title: faculty.name, text, url })
      } else {
        await navigator.clipboard.writeText(url)
        showToast(t('common.copied', 'Enlace copiado al portapapeles'))
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        navigator.clipboard.writeText(url)
        showToast(t('common.copied', 'Enlace copiado al portapapeles'))
      }
    }
  }

  return (
    <DraggableBottomSheet
      isOpen={true}
      onClose={() => selectFaculty(null)}
      ariaLabel={faculty.name}
      className="!p-0"
    >
      <div className="flex flex-col h-full w-full">
      {/* Cover Image */}
      {faculty.image && (
        <div className="relative h-32 w-full shrink-0">
          <img src={faculty.image} alt={faculty.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      {/* Header Info */}
      <div className="relative flex shrink-0 items-start justify-between p-5 pb-3">
        <div className="flex flex-col gap-1 pr-16">
          <h2 className="text-xl font-bold leading-tight drop-shadow-sm">
            {faculty.name}
          </h2>
          <p className="text-sm opacity-80">
            {facultyPins.length} {facultyPins.length === 1 ? 'post' : 'posts'}
          </p>
        </div>
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <button
            onClick={handleShare}
            aria-label={t('common.share', 'Compartir')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors backdrop-blur-sm"
          >
            <Share2 size={16} />
          </button>
          <button
            onClick={() => selectFaculty(null)}
            aria-label={t('common.close')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors backdrop-blur-sm"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Grid de Pines */}
      <div className="flex-1 overflow-y-auto p-5 pt-2">
        {facultyPins.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-center opacity-60">
            <p>No hay publicaciones activas aquí.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facultyPins.map((pin) => {
              const photo = pin.pin_photos?.[0]
              
              return (
                <button
                  key={pin.id}
                  onClick={() => selectPin(pin.id)}
                  className="group relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-white/10 hover:bg-white/20 dark:bg-black/10 dark:hover:bg-black/20 transition-all border border-black/5 dark:border-white/5"
                >
                  {photo ? (
                    <>
                      <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-udp-300)] to-[var(--color-udp-500)] opacity-20" />
                  )}

                  {/* Título en la parte inferior */}
                  <div className="absolute bottom-0 inset-x-0 p-2 pt-4">
                    <p className="line-clamp-2 text-xs font-medium leading-tight text-white drop-shadow-md">
                      {pin.title}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
      </div>
    </DraggableBottomSheet>
  )
}
