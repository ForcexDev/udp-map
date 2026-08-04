-- ═══ MIGRACIÓN 20260717000005: Revertir Política de Borrado ═══
-- A petición del equipo de diseño, un estudiante SIEMPRE debe poder borrar
-- un pin que le pertenezca, incluso si ya fue verificado, porque las instalaciones
-- del mundo real (ej: mesas de ping pong) pueden ser movidas o removidas,
-- y el estudiante que lo reportó debería poder darlo de baja.

DROP POLICY IF EXISTS "pins_owner_delete" ON public.pins;

CREATE POLICY "pins_owner_delete" ON public.pins FOR DELETE
  USING (
    -- El creador puede borrar su pin SIEMPRE, o si es moderador/admin
    creator_id = auth.uid() OR public.user_role() IN ('moderator', 'admin')
  );
