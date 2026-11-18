import { useSyncExternalStore } from 'react'
import type { Role } from '@/shared/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Oferta del tutorial del mapa: si se ofrece al entrar y qué se decidió.
//
// Vive en localStorage y por usuario (la clave lleva su id): en un computador
// compartido del laboratorio, que una persona diga «no mostrar más» no debe
// quitárselo a la siguiente. Sin sesión se usa «anon».
//
// Se lee con useSyncExternalStore y no con un useState inicializado desde
// localStorage: así cualquier componente que escriba la decisión (la hoja, la
// práctica al abrirse) actualiza a los demás sin un store aparte.
// ─────────────────────────────────────────────────────────────────────────────

const PREFIJO = 'udpmap.tutorialMapa.'

/** Cuánto espera «Recordar más tarde» antes de volver a ofrecerlo. */
export const ESPERA_RECORDAR_MS = 4 * 60 * 60 * 1000

/**
 * Roles que usan la pantalla del mapa. Hoy son todos, invitado incluido; la
 * lista existe para que una pantalla nueva solo de administración no herede
 * la oferta por accidente.
 */
const ROLES_DEL_MAPA: readonly Role[] = ['guest', 'student', 'moderator', 'admin']

export type DecisionTutorial =
  { estado: 'visto' } | { estado: 'nunca' } | { estado: 'despues'; hasta: number }

const oyentes = new Set<() => void>()

function avisar() {
  for (const oyente of oyentes) oyente()
}

function clave(userId: string | null): string {
  return PREFIJO + (userId ?? 'anon')
}

export function leerDecision(userId: string | null): DecisionTutorial | null {
  try {
    const crudo = localStorage.getItem(clave(userId))
    if (!crudo) return null
    const valor = JSON.parse(crudo) as Partial<DecisionTutorial>
    if (valor.estado === 'visto' || valor.estado === 'nunca') return { estado: valor.estado }
    if (valor.estado === 'despues' && typeof valor.hasta === 'number') {
      return { estado: 'despues', hasta: valor.hasta }
    }
    return null
  } catch {
    // Modo privado o almacenamiento bloqueado: se trata como «sin decidir».
    // Lo peor que pasa es que se ofrezca otra vez.
    return null
  }
}

export function guardarDecision(userId: string | null, decision: DecisionTutorial): void {
  try {
    localStorage.setItem(clave(userId), JSON.stringify(decision))
  } catch {
    // Sin almacenamiento la decisión dura lo que la pestaña.
  }
  avisar()
}

export const marcarVisto = (userId: string | null) => guardarDecision(userId, { estado: 'visto' })
export const noMostrarMas = (userId: string | null) => guardarDecision(userId, { estado: 'nunca' })
export const recordarMasTarde = (userId: string | null, ahora = Date.now()) =>
  guardarDecision(userId, { estado: 'despues', hasta: ahora + ESPERA_RECORDAR_MS })

/** La regla, sin React: se ofrece si no hay decisión o si venció el «más tarde». */
export function debeOfrecer(decision: DecisionTutorial | null, ahora = Date.now()): boolean {
  if (!decision) return true
  return decision.estado === 'despues' && ahora >= decision.hasta
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  // Otra pestaña que decida también cuenta.
  const alAlmacenar = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PREFIJO)) oyente()
  }
  window.addEventListener('storage', alAlmacenar)
  return () => {
    oyentes.delete(oyente)
    window.removeEventListener('storage', alAlmacenar)
  }
}

/**
 * ¿Hay que ofrecer el tutorial a esta persona? El valor del servidor es
 * `false`: si algún día se prerenderiza, la hoja no aparece en el HTML y no
 * rompe la hidratación.
 */
export function useOfertaTutorial(userId: string | null, role: Role, authLoading: boolean) {
  const pendiente = useSyncExternalStore(
    suscribir,
    () => debeOfrecer(leerDecision(userId)),
    () => false,
  )
  // Mientras auth carga, el id todavía no es el definitivo: ofrecer con «anon»
  // y que luego aparezca otra vez con el id real sería ofrecerlo dos veces.
  return !authLoading && ROLES_DEL_MAPA.includes(role) && pendiente
}
