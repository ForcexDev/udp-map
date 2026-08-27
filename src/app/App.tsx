import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { MapPage } from '@/features/map/MapPage'
import { EventsPage } from '@/features/events/EventsPage'
import { ForumPage } from '@/features/forum/ForumPage'
import { ProfilePage } from '@/features/profile/pages/ProfilePage'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { DashboardPanel } from '@/features/admin/DashboardPanel'
import { ReportsPanel } from '@/features/admin/ReportsPanel'
import { UsersPanel } from '@/features/admin/UsersPanel'
import { ContentPanel } from '@/features/admin/ContentPanel'
import { FacultiesPanel } from '@/features/admin/FacultiesPanel'
import { BroadcastPanel } from '@/features/admin/BroadcastPanel'
import { ActivityLogPanel } from '@/features/admin/ActivityLogPanel'
import { SettingsPanel } from '@/features/admin/SettingsPanel'
import { MappingPage } from '@/features/mapping/MappingPage'
import { LegacyModerationRedirect } from '@/features/admin/LegacyModerationRedirect'

import { UpdatePrompt } from '@/shared/ui/UpdatePrompt'
import { useFacultiesSync } from '@/shared/data/useFaculties'
import { usePushForegroundSync } from '@/features/notifications/usePushSubscription'

export function App() {
  // El catálogo de facultades se rehidrata desde la base una sola vez, aquí
  // arriba: lo necesitan tanto las rutas públicas como el editor de /admin.
  useFacultiesSync()

  // Resincroniza la suscripción push al volver a primer plano, y resuelve una
  // sola vez el estado del dispositivo para todo el que lo pinte. Vive aquí y
  // no en el Sidebar porque el Sidebar se desmonta al cerrarse (if (!isOpen)
  // return null), y en iOS el endpoint rota en silencio: si nadie avisa del
  // nuevo, el servidor sigue mandando a una suscripción muerta. No pide
  // permisos ni crea suscripciones; solo reporta la que ya exista.
  usePushForegroundSync()

  return (
    <>
      <UpdatePrompt />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/mapa" replace />} />
          <Route path="/mapa" element={<MapPage />} />
          <Route path="/eventos" element={<EventsPage />} />
          <Route path="/foro" element={<ForumPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
        </Route>

        {/* La cola de denuncias vivía aquí, fuera de /admin y con la barra de
            navegación pública. Se mudó al panel, pero la ruta vieja tiene que
            seguir respondiendo: hay notificaciones ya emitidas cuyo enlace
            apunta a /moderacion, y la función SQL que las crea sigue
            generándolo. Conserva el ?report= para no romper el enlace directo
            a un caso concreto. */}
        <Route path="/moderacion" element={<LegacyModerationRedirect />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardPanel />} />
          <Route path="moderacion" element={<ReportsPanel />} />
          <Route path="usuarios" element={<UsersPanel />} />
          <Route path="contenido" element={<ContentPanel />} />
          <Route path="facultades" element={<FacultiesPanel />} />
          <Route path="difusion" element={<BroadcastPanel />} />
          <Route path="actividad" element={<ActivityLogPanel />} />
          <Route path="mapeo" element={<MappingPage />} />
          <Route path="ajustes" element={<SettingsPanel />} />
        </Route>

        <Route path="*" element={<Navigate to="/mapa" replace />} />
      </Routes>
    </>
  )
}

