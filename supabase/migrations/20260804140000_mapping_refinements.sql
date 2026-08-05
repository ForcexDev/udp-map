-- =============================================================================
-- Mapeo interior: tipo libre y edificios sin salas
-- =============================================================================
-- Dos huecos que aparecieron al mapear la FIC de verdad.
--
-- 1. `areas.custom_kind`. La lista de tipos es cerrada (hall, pasillo, casino,
--    quiosco…) y siempre va a quedarse corta: en un edificio real aparece una
--    sala de máquinas, una bodega o un auditorio que no encaja en ninguno.
--    Antes solo quedaba 'other', que en el mapa se lee como "algo". Ahora
--    'other' admite escribir el nombre del tipo, y ese texto es el que se
--    muestra. Los tipos cerrados siguen existiendo porque son los que dan el
--    color por defecto; esto es la válvula de escape, no el reemplazo.
--
-- 2. `buildings.has_rooms`. El código de edificio (E441, V432) es el prefijo
--    del código de sala, y viene de la calle: Ejército 441, Vergara 432. Pero
--    hay edificios que no tienen ninguna sala de clases —solo oficinas— y por
--    lo tanto no tienen código asociado a nada. Marcarlos evita que el editor
--    y, más adelante, el formulario de pines pidan un código de sala donde no
--    lo hay.
--
-- `code` ya era opcional desde la migración anterior: no se toca.
-- =============================================================================

alter table public.areas
  add column if not exists custom_kind text
    check (custom_kind is null or char_length(custom_kind) between 1 and 40);

alter table public.buildings
  add column if not exists has_rooms boolean not null default true;

comment on column public.areas.custom_kind is
  'Nombre del tipo cuando kind = ''other''. Null en el resto de los casos.';

comment on column public.buildings.has_rooms is
  'false para edificios sin salas de clases (solo oficinas): no se les pide código de sala.';
