-- Dos cambios de catálogo en `categories`, sin tocar el esquema.
--
-- 1) Nace la categoría de reporte `escalera`.
--
--    Había `ascensor` y `rampa` y no había escalera, y no es una categoría más
--    de la lista: es la que dice POR DÓNDE NO SE PUEDE PASAR. Sin ella, el
--    ruteo accesible no distingue "este edificio no tiene ascensor" de "nadie
--    mapeó nada todavía", que son cosas opuestas para quien va en silla de
--    ruedas.
--
--    Va como pin y no como área porque lo que importa de una escalera es "por
--    aquí se sube", que es un punto; dibujar su contorno es trabajo que no
--    devuelve nada salvo en cajas de escalera grandes, y para eso `area_kind`
--    ya tiene 'service'.
--
--    TTL de 720 h como el resto de la infraestructura fija (`sala`,
--    `ascensor`, `rampa`): un mes es la ventana para que un moderador la
--    verifique; al verificarse deja de expirar. Si nadie la verifica, caduca
--    sola y el mapa no se queda con datos que nadie respalda.
--
-- 2) `computacion` pasa a llamarse "Sala de computación".
--
--    Mismo id, mismo color, mismo svg: solo la etiqueta. "Computación" nombra
--    una materia; lo que se marca en el mapa es un recinto. El id se mantiene
--    porque lo referencian los pines ya publicados (`pins.category_id`).

insert into public.categories (id, kind, name, name_en, color, svg_path, ttl_hours)
values (
  'escalera', 'report', 'Escalera', 'Stairs', '#475569',
  'M3 21v-4h5v-4h5V9h5V5h3v16H3z', 720
)
on conflict (id) do nothing;

update public.categories
   set name    = 'Sala de computación',
       name_en = 'Computer lab'
 where id = 'computacion';
