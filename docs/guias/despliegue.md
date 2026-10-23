# Despliegue y operación

Procedimientos para un proyecto Supabase identificado y un frontend configurado.
Los comandos de esta guía **cambian servicios** cuando se ejecutan: no son parte
del build ni de la verificación local. Preparar un archivo, registrar un
despliegue y comprobar el estado remoto son evidencias distintas.

El [modelo SQL](../referencia/base-de-datos.md), el
[contrato push](../referencia/notificaciones.md) y
[validación](validacion.md) completan esta guía.

<a id="configuracion-por-entorno"></a>
## Configuración por entorno

No guardes valores de secretos en documentos, scripts o variables `VITE_*`.

| Entorno | Configuración |
|---|---|
| Frontend | `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` o alias `VITE_SUPABASE_PUBLISHABLE_KEY`; Google, ORS y VAPID público según función |
| Supabase Auth / Google | Proveedor y credenciales OAuth; cliente y orígenes reales del botón Google; restricción de correo también validada en código/SQL |
| Edge compartido | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` |
| `send-push` | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; opcionales `APP_ORIGIN` y `ALLOWED_ORIGINS` |
| Vault para cron HTTP | `udp_map_project_url` y `udp_map_send_push_cron_secret` |

Las variables Supabase del entorno Edge pueden ser provistas por la plataforma;
comprueba su disponibilidad en el proyecto, no las copies al frontend.
`_shared/auth.ts` falla al cargar si faltan URL o service role. Sin
`CRON_SECRET` solo puede autorizar la sesión admin, no el cron por cabecera.

El valor de `udp_map_send_push_cron_secret` debe coincidir con `CRON_SECRET`
en ambas funciones. `udp_map_project_url` es `https://<ref>.supabase.co`.
Vault alimenta los jobs; los secretos Edge alimentan las funciones. Son
superficies distintas y no se provisionan por desplegar código.

`APP_ORIGIN` determina el origen absoluto del push y participa en CORS.
Su respaldo es `https://udp-map.vercel.app`. Los orígenes locales admitidos son
`http://localhost:5173`, `:4173` y `:3000`; `ALLOWED_ORIGINS` agrega coincidencias
exactas separadas por coma. OAuth tiene su propia configuración externa:
que CORS admita un puerto no prueba que Google lo admita.

El VAPID público debe coincidir entre frontend, par privado/público Edge y
suscripciones. `push-sw.js` contiene una clave pública de respaldo para
`pushsubscriptionchange`: revisa también esa superficie al rotar el par.
Cambiar claves puede requerir volver a suscribir dispositivos; no elimines una
suscripción sana sin haber definido recuperación y probado la nueva.

Un `VAPID_SUBJECT` que comienza por `mailto:` se usa tal cual. Otro valor o
ausencia usa el respaldo institucional del código y deja warning. El pendiente
es configurar un contacto propio del proyecto y probarlo en iPhone, no asumir
afiliación institucional ni que la cadena actual ya cambió.

## Reconstruir un proyecto nuevo

Este procedimiento parte de una base **nueva y vacía**, no es una actualización
sobre datos existentes.

1. Comprueba proyecto, acceso SQL y extensiones `pg_cron`/`pg_net`. Si las líneas
   de extensión del baseline fallan por el esquema requerido, actívalas desde
   Database → Extensions y retoma con ese contexto.
2. Ejecuta `supabase/schema/baseline.sql`.
3. Ejecuta `supabase/seed/badges.sql` y después `supabase/seed/seed.sql`.
4. Configura Auth/Google y las variables y secretos de la sección anterior.
5. Despliega las funciones y programa los trabajos descritos más abajo.
6. Provisiona administradores, verifica permisos, catálogo, bucket, publicación
   realtime, jobs y respuestas HTTP. Prueba el cliente antes de darlo por operativo.

No ejecutes las migraciones archivadas junto al baseline: ya incorpora su
resultado versionado. Tampoco reapliques indiscriminadamente los forward
posteriores que el baseline incluye. Los archivos de cron indicados son pasos
operativos concretos para los trabajos ausentes.

El seed no conserva perímetros ni trazado interior de producción. Tras reset,
restaura geometrías desde un respaldo verificado o vuelve a trazarlas;
no sustituyas el perímetro por cuadrados de las chinchetas. `fic_dummy_50_pins.sql`
es material de desarrollo, no parte de la reconstrucción de producción.
Los IDs seriales de carreras no se conservan por regenerar el seed.

La configuración externa, secretos, suscripciones y datos de usuarios no están
provisionados por el esquema. La reorganización documental no inspeccionó ni
exportó los valores remotos.

### Primer administrador

Inserta el correo en `admin_emails` **antes del alta** para que
`handle_new_user` cree el perfil con rol adecuado:

~~~sql
insert into public.admin_emails (email) values ('persona@mail.udp.cl');
~~~

Si ya existe el perfil, la primera promoción requiere sesión SQL administrativa
y comprobación del resultado. `admin_set_user_role` necesita un admin existente:
no es un mecanismo de bootstrap. Usa el UUID correcto del perfil, no un ID
supuesto, y revisa las
[limitaciones del trigger](../referencia/base-de-datos.md#discrepancias-y-observaciones-abiertas).
No afirmes que todo UPDATE administrativo es rechazado ni que un cambio de
`admin_emails` modifica retroactivamente perfiles ya creados.

## Aplicar un cambio de base

Mantén en el mismo cambio migración `<timestamp>_descripcion.sql`, baseline y
referencia DB, con los tipos cliente que cambien. El hook avisa de la referencia,
no valida equivalencia de esquemas.

Para cada función `SECURITY DEFINER` nueva o modificada, fija un `search_path`
seguro, valida identidad/rol y objeto dentro de la función, revoca `EXECUTE`
a `PUBLIC` y concédelo solo a los roles necesarios. Revisa también privilegios
de columnas y la combinación OR de políticas permisivas. Es una regla de
contribución; las excepciones del SQL heredado se auditan como tales.

No cambies el cuerpo de una migración ya aplicada en un entorno compartido:
prepara otra. El flujo desde las migraciones de agosto que incorporaron rollback
incluye `.down.sql`; documenta pérdidas y condiciones de vuelta atrás, no solo
cómo deshacer DDL.

Antes de aplicar, confirma proyecto, dependencias y respaldo adecuado. Ejecuta
desde SQL Editor, inspecciona resultado/catálogos y registra entorno, fecha,
commit y pruebas. No cierres el pendiente por existir el archivo o por el
nombre de su timestamp. No hay `db push` en CI o scripts npm.

Registra hallazgos y cierre sin borrar su historia: problema, alcance, evidencia
y resolución. Para cerrar un hallazgo de base, contrasta funciones y políticas
con el catálogo real del entorno (`pg_proc`, `pg_policy` y ACL correspondientes);
la afirmación de otra persona o herramienta no sustituye esa comprobación.
Si solo verificaste el SQL local, registra ese alcance y deja pendiente lo remoto.

Para cambios de catálogo, actualiza su fuente y el seed cuando corresponda.
El generador no crea administradores, perímetros ni salas posicionadas.
No ejecutes una regeneración de datos incidental para actualizar solo un
comentario documental.

## Funciones y cron

Desde un checkout del código que deseas desplegar y una CLI autenticada al
proyecto correcto:

~~~bash
npm run deploy:push
npx --yes supabase functions deploy storage-gc
~~~

`supabase/config.toml` declara ambas con `verify_jwt = false`. El cron HTTP usa
`x-cron-secret` sin Authorization; si el gateway exige JWT, devuelve 401 antes
de ejecutar la función. Desactivar esa verificación no deja la función sin
control: `_shared/auth.ts` comprueba cron o sesión admin.
Tras desplegar, inspecciona la configuración efectiva, por ejemplo con
`npx supabase functions list` y la consola del proyecto.

| Job | Frecuencia versionada / procedimiento | Dependencia |
|---|---|---|
| `expire-pins` | Cada 30 minutos, bloque siguiente | Esquema de pines |
| `udp-map-storage-gc` | Cada 10 minutos, `20260803120500_schedule_storage_gc.sql` | Cola, función y Vault |
| `udp-map-send-push-every-minute` | Cada minuto, `20261021000200_push_cron_jobs.sql` | Función y Vault |
| `udp-map-event-reminders` | Cada minuto, mismo archivo | `enqueue_upcoming_event_notifications` |
| `udp-map-prune-push-history` | Diario 04:17 UTC, mismo archivo | `prune_push_history` |

Sobre un proyecto reconstruido, una vez desplegadas las funciones y disponibles
los secretos, programa Storage con su archivo específico y los jobs de push con
`20261021000200`. Estos usan nombre estable; `cron.schedule` reemplaza el job
de ese nombre y evita duplicarlo. El de send-push fija timeout HTTP de 10 s.
Crear el job guarda su comando: que la creación termine no prueba que los
secretos o la función respondan.

El job de expiración que no provisiona el baseline:

~~~sql
select cron.schedule(
  'expire-pins',
  '*/30 * * * *',
  $$ delete from public.pins where is_permanent = false and expires_at < now() $$
);
~~~

Los jobs HTTP leen exclusivamente URL y secreto cron de Vault; nunca service role.
Los jobs de recordatorios/purga ejecutan SQL sin JWT. No sustituyas las
comparaciones de rol que permiten ese NULL por otras más estrictas sin revisar
el contrato. `prune_activity_log` no queda programado por estos jobs.

### Orden del rework de octubre sobre una base existente

Primero comprueba qué existe y qué se aplicó. El commit `f49ced9` registra que
se aplicaron las migraciones siguientes y se desplegaron las funciones, pero
eso no inspecciona el proyecto hoy.

El orden de dependencias es:

1. `20261021000000_push_queue_lease.sql`: lease, fencing, rastro y RPC de cola.
2. `20261021000100_push_subscriptions_reminders.sql`: suscripciones, preferencias,
   marca de recordatorio, difusión, autotest y estadísticas.
3. `20261021000200_push_cron_jobs.sql`: recordatorios separados, purga y cron.
4. Desplegar el sender actual y el cliente/worker correspondientes.
5. Verificar jobs, HTTP, recepción y toque en dispositivos.

`000100` comprueba que existe `push_host` de `000000` antes de continuar.
Crear funciones PL/pgSQL no valida necesariamente todas sus columnas hasta
ejecutarlas; la guarda evita aceptar una instalación incompleta.

El despliegue escalonado original protegía primero el sender `4eae308`
(Push 0/1, sin dependencias nuevas) y lo probaba en iPhone; después seguían SQL
y sender nuevo. Si necesitas reproducir ese ensayo, usa un checkout separado
del commit correcto: desplegar `main` ya no reproduce aquella versión.
No cambies cifrado/payload/sub/urgencia por pasar pruebas unitarias.

El sender actual ya no ejecuta el **barrido periódico** de recordatorios.
El trigger `notify_event_rsvp_in_window` todavía puede crearlos al insertar o
actualizar una asistencia que ya está en la ventana. Sin el job de `000200`
falta el barrido de asistencias previas que entran en los 20 días; no desaparecen
todos los productores por el mero hecho de faltar cron.
Un sender anterior como `4eae308` o `20eee7e` puede coexistir con el esquema
nuevo y el cron de recordatorios gracias a `reminded_at`. Esto es compatibilidad
de código registrada, no una invitación a saltarse la comprobación del entorno.

## Inspección operativa

Estas consultas de lectura no muestran claves de suscripción ni secretos:

~~~sql
select jobname, schedule, active, left(command, 80)
from cron.job order by jobname;

select j.jobname, d.status, d.start_time
from cron.job_run_details d join cron.job j on j.jobid = d.jobid
order by d.start_time desc limit 10;

select status_code, left(content, 120), created
from net._http_response order by created desc limit 10;

select coalesce(push_host, '(sin host)') as host,
       count(*) filter (where status = 'sent') as sent,
       count(*) filter (where status = 'failed') as failed,
       count(*) filter (where status = 'expired') as expired,
       count(*) filter (where status = 'pending') as pending
from public.notification_push_deliveries
where created_at >= now() - interval '7 days'
group by 1 order by 3 desc, 1;
~~~

`cron.job_run_details` puede decir succeeded porque `pg_net` encoló HTTP aunque
el destino conteste 401/500. El cron push con `EdgeRuntime` devuelve 202 y el
resumen queda en logs; el panel espera 200. Aceptación del servicio push tampoco
prueba notificación visible.

El SQL Editor suele ejecutar como postgres sin JWT. `claim/finish` exigen
`service_role` y rechazan NULL; `admin_push_delivery_stats` exige una sesión
admin y tampoco convierte service role en admin. La consulta por host anterior
permite inspección equivalente sin fingir identidad de usuario.

`select public.prune_push_history()` y
`select public.enqueue_upcoming_event_notifications()` **no son inspecciones**:
borran o crean avisos. La marca de recordatorio evita repeticiones, pero no
vuelve esas llamadas de solo lectura.

### Ensayo transaccional de lease y fencing

Solo en un entorno controlado. El bloque reclama/cierra provisionalmente y
termina con excepción para deshacer la transacción. No envía push ni deja
marcadas como sent entregas que nunca salieron:

~~~sql
do $prueba$
declare
  v_lote jsonb;
  v_cerradas integer;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', delivery_id, 'attempts', attempts, 'status', 'sent')), '[]'::jsonb)
  into v_lote
  from public.claim_push_deliveries(5, 60);

  select count(*) into v_cerradas
  from public.finish_push_deliveries(v_lote);

  raise exception 'Prueba deshecha: % reclamadas, % cerradas, % al repetir el cierre',
    jsonb_array_length(v_lote), v_cerradas,
    (select count(*) from public.finish_push_deliveries(v_lote));
end;
$prueba$;
~~~

Se espera N reclamadas, N cerradas y cero al repetir el cierre, mostrado como
error deliberado. No elimines la excepción dejando un ensayo que consuma intentos.
La prueba completa requiere además lease vencido, competencia de dos sesiones,
fallos y permisos con roles reales; este bloque no los sustituye.

<a id="vuelta-atras"></a>
## Vuelta atrás

Si falla la función actual, el procedimiento registrado permite redesplegar
`4eae308` manteniendo el esquema nuevo. Usa el checkout correcto y prueba
recepción/toque, no solo un POST exitoso.

Si debes deshacer también esquema, primero despliega un sender compatible y
aplica down en orden inverso: `000200` → `000100` → `000000`.

| Down | Condición y pérdida que hay que conservar |
|---|---|
| `000200` | Antes despliega un sender que encole recordatorios, como `4eae308`/`20eee7e`. Quita cron de recordatorios/purga y restaura el cron HTTP anterior; datos ya purgados no vuelven |
| `000100` | Quita `reminded_at`: vuelve el riesgo de reaviso al borrar notificación. No restaura endpoints retirados ni movimientos ya hechos. Restituye exposición de `wants_notification` a authenticated según el esquema anterior |
| `000000` | Antes retira el sender que usa claim/finish. Borra entregas NULL o expired para volver a NOT NULL/CASCADE/CHECK antiguo: se pierde ese rastro |

Los fallback de cliente de octubre todavía sirven a esta compatibilidad,
incluidos reintento sin `p_old_endpoint` y mensajes heredados. No los confundas
con los respaldos de agosto retirados del cliente ni con archivos down:
los down de agosto siguen en el repositorio. Retirarlos requiere decidir que
ese rollback dejó de ser una opción.

<a id="storage-y-recuperacion"></a>
## Storage y recuperación

Al borrar filas confirmadas, los triggers encolan archivos y `storage-gc` los
quita por API de Storage, hasta 200 por pasada. No borres solo filas de
`storage.objects` como sustituto de eliminar el binario.

Inspecciona pendientes y errores sin ocultar filas cerradas por agotamiento:

~~~sql
select bucket_id, attempts, processed_at, last_error, count(*)
from public.storage_cleanup_queue
group by bucket_id, attempts, processed_at, last_error
order by processed_at nulls first, attempts;
~~~

Si un archivo ya se borró y falló marcar la cola, reprocesar es idempotente.
Tras cinco intentos el worker cierra con error: investiga la causa antes de
reabrir manualmente una fila; no borres la evidencia para aparentar cola vacía.
La compensación de subidas sin fila es responsabilidad separada de
`uploadPinPhotos` en el cliente.

## Cambios manuales que requieren cuidado

No uses `GRANT ALL ON ALL TABLES` para resolver un permission denied:
deshace privilegios de columnas y tablas internas. No escribas contadores de
voto por fuera de las RPC. No supongas que la protección del perfil siempre
rechaza UPDATE privilegiados; su discrepancia está documentada.

No sustituyas fechas/estados remotos por una marca «hecho» en el plan. Registra
el entorno y las comprobaciones. La [guía de validación](validacion.md) cubre
recepción, cierres de sesión, permisos, worker y actualización PWA.

Para frontend, `npm run build` produce `dist` y `npm run preview` lo sirve
localmente. `vercel.json` configura la reescritura SPA y `wrangler.toml` otra
configuración de assets; ninguno acredita un despliegue real por existir.
Proporciona `VERCEL_GIT_COMMIT_SHA` coherente si necesitas detección de
actualización fuera del flujo que lo suministra, y comprueba que el historial
Git usado para la etiqueta visible sea el esperado.
