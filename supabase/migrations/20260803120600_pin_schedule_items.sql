-- =============================================================================
-- Programa (schedule) opcional por evento
-- =============================================================================
-- Un evento puede tener bloques horarios ("14:00 charla con X", "15:00
-- panel"). Es opcional: la mayoría de organizadores sigue subiendo el
-- programa como foto, esto es para quien prefiere que la interfaz pueda
-- resaltar el bloque en curso.
--
-- Sin política de update a propósito: la interfaz edita el programa
-- reemplazando el set completo (delete + insert), igual que hace con las
-- fotos del pin. Evita reconciliar ediciones parciales de filas.

create table if not exists public.pin_schedule_items (
  id          uuid         primary key default gen_random_uuid(),
  pin_id      uuid         not null references public.pins(id) on delete cascade,
  starts_at   timestamptz  not null,
  ends_at     timestamptz,
  title       text         not null check (char_length(title) between 1 and 120),
  subtitle    text         check (subtitle is null or char_length(subtitle) <= 160),
  sort_order  integer      not null default 0,
  created_at  timestamptz  not null default now()
);

create index if not exists pin_schedule_items_pin_starts_idx
  on public.pin_schedule_items (pin_id, starts_at);

alter table public.pin_schedule_items enable row level security;

drop policy if exists schedule_read on public.pin_schedule_items;
create policy schedule_read on public.pin_schedule_items for select using (true);

drop policy if exists schedule_insert on public.pin_schedule_items;
create policy schedule_insert on public.pin_schedule_items
  for insert with check (
    public.user_role() <> 'guest'
    and (
      exists (select 1 from public.pins where pins.id = pin_schedule_items.pin_id and pins.creator_id = auth.uid())
      or public.user_role() = any (array['moderator', 'admin'])
    )
  );

drop policy if exists schedule_delete on public.pin_schedule_items;
create policy schedule_delete on public.pin_schedule_items
  for delete using (
    exists (select 1 from public.pins where pins.id = pin_schedule_items.pin_id and pins.creator_id = auth.uid())
    or public.user_role() = any (array['moderator', 'admin'])
  );

grant all on public.pin_schedule_items to anon, authenticated;
