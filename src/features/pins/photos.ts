export const MAX_PHOTO_BYTES = 20 * 1024 * 1024
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_PHOTOS_PER_PIN = 5
const COMPRESS_MAX_DIM = 1200
const COMPRESS_QUALITY = 0.75

type PhotoValidationError = 'too-large' | 'bad-type' | null

export function validatePhoto(file: { type: string; size: number }): PhotoValidationError {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) return 'bad-type'
  if (file.size > MAX_PHOTO_BYTES) return 'too-large'
  return null
}

interface CompressedPhoto {
  blob: Blob
  width: number
  height: number
}

/**
 * Comprime una imagen en el cliente (canvas, lado mayor ~1200px, JPEG 0.75).
 * A diferencia de v1: la promesa SIEMPRE se resuelve o rechaza (onerror,
 * toBlob null y revocación del object URL cubiertos).
 */
export function compressImage(
  file: File,
  maxDim: number = COMPRESS_MAX_DIM,
  quality: number = COMPRESS_QUALITY,
): Promise<CompressedPhoto> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const width = Math.round(img.width * scale)
        const height = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('canvas 2d context unavailable'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) resolve({ blob, width, height })
            else reject(new Error(`toBlob failed for ${file.name}`))
          },
          'image/jpeg',
          quality,
        )
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`could not decode image ${file.name}`))
    }
    img.src = url
  })
}

/** Ruta en Storage: pins/{userId}/{uuid}.jpg (nombres únicos, sin colisiones). */
export function photoStoragePath(userId: string): string {
  return `pins/${userId}/${crypto.randomUUID()}.jpg`
}
