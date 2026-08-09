import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { MapPage } from '@/features/map/MapPage'
import { EventsPage } from '@/features/events/EventsPage'
import { ForumPage } from '@/features/forum/ForumPage'
import { ProfilePage } from '@/features/profile/pages/ProfilePage'
import { ModerationPage } from '@/features/moderation/ModerationPage'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { AdminPage } from '@/features/admin/AdminPage'
import { MappingPage } from '@/features/mapping/MappingPage'

import { UpdatePrompt } from '@/shared/ui/UpdatePrompt'
import { useFacultiesSync } from '@/shared/data/useFaculties'

export function App() {
  // El catálogo de facultades se rehidrata desde la base una sola vez, aquí
  // arriba: lo necesitan tanto las rutas públicas como el editor de /admin.
  useFacultiesSync()

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
          <Route path="/moderacion" element={<ModerationPage />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminPage />} />
          <Route path="mapeo" element={<MappingPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/mapa" replace />} />
      </Routes>
    </>
  )
}

