-- Sprint 3 pendiente: "Validación en base de datos de que un RSVP solo apunte
-- a un pin event". Un CHECK no puede consultar otra tabla, así que se valida
-- con trigger. No hay filas que limpiar: enqueue_event_reminder ya filtra por
-- type = 'event', así que un RSVP mal dirigido nunca generó notificaciones,
-- solo quedaría como fila húerfana sin efecto — este trigger cierra la puerta
-- hacia adelante.
create or replace function public.validate_rsvp_targets_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.pins where id = new.pin_id and type = 'event'
  ) then
    raise exception 'Solo se puede hacer RSVP a pines de tipo evento';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_rsvp_targets_event on public.event_rsvps;
create trigger trg_validate_rsvp_targets_event
before insert or update of pin_id on public.event_rsvps
for each row execute function public.validate_rsvp_targets_event();

revoke execute on function public.validate_rsvp_targets_event() from public;
