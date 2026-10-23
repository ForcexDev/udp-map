# Migraciones históricas

**No las ejecutes para reconstruir ni actualizar una base actual.**
Se archivaron al consolidar el esquema en
[`baseline.sql`](../../schema/baseline.sql). Los comentarios conservan
antecedentes útiles; la referencia actual está en
[base de datos](../../../docs/referencia/base-de-datos.md).

## Por qué se conservaron

El registro anterior dice que ya se habían aplicado en producción. Mantener
los archivos como historia evitó reescribir
`supabase_migrations.schema_migrations` con `supabase migration repair` sobre
una base compartida: una reparación a medias podía intentar reaplicar objetos.

El baseline resolvía reconstrucción y comprensión, e incluyó políticas
registradas como creadas a mano. Los cron tienen pasos propios en
[despliegue](../../../docs/guias/despliegue.md), no se provisionan por existir
en este archivo o en una descripción del esquema.

La alternativa de un squash real quedó para un entorno de staging comprobado
o un proyecto nuevo donde el baseline pueda ser la primera migración.
Este antecedente no confirma qué lleva aplicado un servicio hoy.

## Motivo de denuncia y categoría Easter egg

`20260724084902_add_easter_eggs_report_reason.sql` y
`20260724090714_revert_easter_eggs_report_reason.sql` registran alta y reversión
del motivo de denuncia. No se conserva el intervalo de minutos anterior porque
los nombres y Git no acreditan el tiempo real de aplicación.

`20260724090638_add_easter_egg_pin_category.sql` es otra cosa: la categoría de
pin `easter-egg`, que permanece en el catálogo versionado. No confundir la
reversión del motivo con retirar la categoría.
