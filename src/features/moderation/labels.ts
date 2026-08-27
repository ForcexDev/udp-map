import type { ContentReport } from '@/shared/types/database'

// Los motivos y los tipos de contenido denunciado, en castellano. Viven aquí y
// no dentro de la pantalla de denuncias porque el registro de actividad también
// los necesita, y tener dos copias es tener dos verdades.

export const REASON_LABELS: Record<ContentReport['reason'], string> = {
  spam: 'Spam o publicidad',
  harassment: 'Acoso o ataques personales',
  misinformation: 'Información falsa',
  inappropriate: 'Contenido inapropiado',
  other: 'Otro motivo',
}

export const TARGET_LABELS: Record<ContentReport['target_type'], string> = {
  pin: 'Pin del mapa',
  pin_comment: 'Comentario de pin',
  forum_thread: 'Hilo del foro',
  forum_comment: 'Respuesta del foro',
}
