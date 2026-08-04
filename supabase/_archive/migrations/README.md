# Migraciones históricas

**Estas 33 migraciones ya están aplicadas en producción. No las ejecutes.**

Se conservan como historia: sirven para entender por qué el esquema llegó a ser
lo que es, y a veces el comentario de cabecera de una de ellas explica una
decisión que hoy parece arbitraria.

Se movieron fuera de `supabase/migrations/` para que quede claro cuál es la
fuente de verdad, que ahora es [`supabase/schema/baseline.sql`](../../schema/baseline.sql).

## Por qué no se hizo un squash de verdad

Supabase lleva el registro de qué migraciones se aplicaron en la tabla
`supabase_migrations.schema_migrations`. Reemplazar estos archivos por un único
baseline "de verdad" obligaría a reescribir esa tabla con
`supabase migration repair`, sobre la base de producción y con usuarios reales
encima. Si queda a medias, el CLI intenta reaplicar cosas que ya existen.

A cambio de ese riesgo se ganaría una carpeta ordenada, nada más. El problema
real —poder reconstruir la base y saber qué hay dentro— lo resuelve el baseline,
que además se construyó leyendo la base viva y por eso captura cosas que estos
archivos nunca tuvieron (la política `profiles_admin_update` y el cron job de
notificaciones push, ambos creados a mano en el dashboard).

El squash tendrá sentido el día que exista un proyecto de staging donde probarlo,
o cuando se cree un proyecto Supabase nuevo desde cero: ahí el baseline pasa a
ser la migración número uno sin necesidad de reparar nada.

## Nota sobre dos de ellas

`20260724090638_add_easter_eggs_report_reason.sql` y
`20260724090714_revert_easter_eggs_report_reason.sql` se anulan entre sí: se
añadió un motivo de denuncia y se revirtió 36 minutos después. La base concuerda
con el revert. La categoría de pin `easter-egg`, que es otra cosa, sí sigue viva.
