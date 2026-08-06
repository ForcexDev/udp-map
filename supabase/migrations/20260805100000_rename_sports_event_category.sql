-- La categoría de EVENTO 'deporte-evento' pasa a llamarse "Competencia".
--
-- "Deportivo" y "Deporte" (la categoría de REPORTE, que sigue igual) se leían
-- como lo mismo en la lista de categorías, y la de evento no cubre solo
-- deporte: también torneos, campeonatos y competencias académicas.
--
-- Solo cambia la etiqueta. El id se mantiene porque lo referencian los pines
-- ya publicados (pins.category_id), y el trofeo del svg_path ya era el icono
-- correcto para "competencia".

update public.categories
   set name    = 'Competencia',
       name_en = 'Competition'
 where id = 'deporte-evento';
