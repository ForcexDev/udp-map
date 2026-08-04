# Migraciones

Aquí van los cambios nuevos del esquema, uno por archivo, con nombre
`<timestamp>_descripcion.sql`.

Las 33 migraciones anteriores están en
[`../_archive/migrations/`](../_archive/migrations/): ya se aplicaron en
producción y no deben ejecutarse.

## La regla

Cada cambio en la base son **dos cosas en el mismo commit**:

1. la migración nueva en esta carpeta, que es lo que se ejecuta contra la base;
2. la actualización de [`../schema/baseline.sql`](../schema/baseline.sql), que
   es lo que reconstruye la base desde cero.

Si las dos se separan, el baseline deja de describir la realidad y volvemos al
desorden que motivó todo esto.

En este proyecto las migraciones se aplican **a mano** desde el SQL Editor: no
hay `db push` ni en CI ni en los scripts de npm.

El detalle de qué hace cada pieza del esquema está en
[`docs/DATABASE.md`](../../docs/DATABASE.md).
