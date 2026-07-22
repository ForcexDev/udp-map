import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { MapPage } from '@/features/map/MapPage'
import { EventsPage } from '@/features/events/EventsPage'
import { ForumPage } from '@/features/forum/ForumPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { ModerationPage } from '@/features/moderation/ModerationPage'

import { UpdatePrompt } from '@/shared/ui/UpdatePrompt'

export function App() {
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
          <Route path="*" element={<Navigate to="/mapa" replace />} />
        </Route>
      </Routes>
    </>
  )
}
