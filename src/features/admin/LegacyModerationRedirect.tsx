import { Navigate, useLocation } from 'react-router-dom'

/**
 * `/moderacion` → `/admin/moderacion`, conservando la query.
 *
 * La cola de denuncias se mudó al panel el 2026-08-27. La ruta vieja no se
 * puede borrar sin más: `notify_content_report` guarda `url: '/moderacion'` en
 * cada notificación que crea, así que **todas las que ya están en la base
 * apuntan aquí** — y la función SQL las sigue generando así. Mientras eso no
 * cambie, este redirect es lo que hace que el aviso de una denuncia lleve a
 * alguna parte.
 *
 * La query se pasa entera a propósito: el enlace útil es `?report=<id>`, que
 * abre la cola resaltando ese caso. Perderlo dejaría al administrador buscando
 * a mano cuál de los reportes era.
 */
export function LegacyModerationRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/admin/moderacion${search}`} replace />
}
