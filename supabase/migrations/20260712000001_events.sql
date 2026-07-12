-- ═══════════════════════════════════════════════════════════════
-- Sprint 3 — Modulo de Eventos: Tabla event_rsvps y RLS
-- ═══════════════════════════════════════════════════════════════

create table event_rsvps (
  pin_id  uuid not null references pins on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  status  text not null check (status in ('going', 'interested')),
  primary key (pin_id, user_id)
);

alter table event_rsvps enable row level security;

create policy "event_rsvps_read" on event_rsvps for select using (true);

create policy "event_rsvps_all_own" on event_rsvps for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.user_role() <> 'guest');
