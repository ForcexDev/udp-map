import { useAuthStore } from './authStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { can, type Action } from './permissions'

/**
 * Guard de modo invitado: devuelve una función que verifica el permiso y,
 * si el usuario no puede, abre el modal "Inicia sesión con tu correo UDP".
 */
export function useGuard() {
  const role = useAuthStore((s) => s.role)
  const openLoginModal = useUIStore((s) => s.openLoginModal)

  return (action: Action): boolean => {
    if (can(role, action)) return true
    openLoginModal()
    return false
  }
}
