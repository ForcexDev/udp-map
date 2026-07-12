-- Permite a los administradores modificar perfiles (ej. cambiar roles)
create policy "profiles_admin_update" on profiles for update
  using (public.user_role() = 'admin');
