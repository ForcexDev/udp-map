-- ============================================================================
-- Deshace 20261023000000_indoor_navigation.sql.
--
-- OJO: se pierde el grafo entero (nodos, puertas, núcleos y aristas). El
-- mapeo de edificios, plantas y áreas no se toca. El cliente sigue
-- funcionando: sin grafo, "Cómo llegar" vuelve a la guía de tres pasos.
-- ============================================================================

drop table if exists public.nav_edges;
drop table if exists public.nav_nodes;
drop type if exists public.nav_edge_kind;
drop type if exists public.nav_node_kind;
