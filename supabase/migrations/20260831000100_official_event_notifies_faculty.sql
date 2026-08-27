-- ============================================================================
-- Avisar a la facultad cuando se publica un evento oficial.
--
-- ROADMAP §13.1: "el evento de campus no falla porque se te olvide, falla
-- porque nunca te enteraste". El recordatorio ya existe para quien marcó — pero
-- marcar exige haberse enterado, que es justo el eslabón que faltaba.
--
-- ACOTADO A EVENTOS OFICIALES, y eso es la mitad del diseño. Marcar un evento
-- como oficial es permiso de moderador, así que no puede usarlo cualquiera para
-- avisarle a media universidad. Si esto valiera para cualquier evento, en una
-- semana la gente apagaría los avisos enteros — y esa es la peor forma de
-- perder a alguien, porque también deja de enterarse de lo que sí le importa.
--
-- Solo a quien tiene ESA facultad en su perfil (`profiles.faculty_id`), y nunca
-- a quien lo publica. Respeta las preferencias: `create_notification` ya filtra
-- por categoría y canal (migración 20260831000000), así que quien apagó
-- "events" no recibe esto aunque sea oficial.
--
-- REQUIERE 20260831000000 aplicada antes.
-- APLICAR A MANO. Deshacer: 20260831000100_..._down.sql
-- ============================================================================

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'achievement', 'forum_reply', 'event_reminder',
      'moderation_report', 'moderation_update', 'announcement',
      'pin_verified', 'pin_comment', 'event_official'
    )
  );

create or replace function public.notify_faculty_official_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_persona   record;
  v_cuando    text;
  v_facultad  text;
begin
  -- Solo eventos, solo oficiales, solo con facultad a la que avisar.
  if new.type <> 'event' or not new.is_official or new.faculty_id is null then
    return new;
  end if;

  -- En UPDATE, solo cuando CRUZA a oficial. Sin esto, editarle el título a un
  -- evento ya oficial volvería a avisar a toda la facultad.
  if tg_op = 'UPDATE' and old.is_official then
    return new;
  end if;

  select name into v_facultad from public.faculties where id = new.faculty_id;

  v_cuando := case
    when new.starts_at is null then ''
    else ' · ' || to_char(new.starts_at at time zone 'America/Santiago', 'DD/MM HH24:MI')
  end;

  for v_persona in
    select id from public.profiles
     where faculty_id = new.faculty_id
       and id <> coalesce(new.creator_id, '00000000-0000-0000-0000-000000000000'::uuid)
  loop
    perform public.create_notification(
      v_persona.id,
      'event_official',
      'events',
      coalesce(v_facultad, 'Tu facultad') || ': evento oficial',
      left(new.title, 90) || v_cuando,
      '/eventos?event=' || new.id::text,
      -- Por evento y persona: si se edita, no se vuelve a avisar aunque el
      -- trigger corriera otra vez.
      'event_official:' || new.id::text,
      jsonb_build_object('pinId', new.id, 'facultyId', new.faculty_id),
      new.creator_id
    );
  end loop;

  return new;
end;
$fn$;

drop trigger if exists on_official_event_notification on public.pins;
create trigger on_official_event_notification
  after insert or update of is_official on public.pins
  for each row execute function public.notify_faculty_official_event();
