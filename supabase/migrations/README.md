# Migraciones incrementales

Aquí van cambios nuevos `<timestamp>_descripcion.sql`. No se aplican en CI:
el flujo del proyecto usa SQL Editor manualmente.

Cada cambio de esquema mantiene juntos migración, baseline y
[referencia de base de datos](../../docs/referencia/base-de-datos.md).
No cambies el cuerpo de una migración ya aplicada para modificar el esquema;
crea una posterior. Las migraciones que incorporan rollback llevan su
`.down.sql` con condiciones y pérdidas explícitas.

Consulta [despliegue](../../docs/guias/despliegue.md) para reconstrucción,
dependencias, cron y vuelta atrás. El baseline ya contiene resultados de
migraciones: no ejecutes toda esta carpeta sobre una base recién reconstruida
sin distinguir los pasos operativos que faltan.

Las migraciones anteriores a la consolidación están en
[`_archive/migrations`](../_archive/migrations/README.md). Se conservan como
historia, no como receta paralela de instalación. Un archivo archivado o una
nota de despliegue no acreditan el estado actual del servicio.
