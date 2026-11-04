# Decisiones de notificaciones push

Problemas, elecciones y alternativas del rework de octubre. El contrato vigente
está en [notificaciones](../referencia/notificaciones.md); SQL en
[base de datos](../referencia/base-de-datos.md#avisos-y-cola-push);
procedimientos en [despliegue](../guias/despliegue.md).

## Qué acredita el registro

La [bitácora](../historico/2026-10/bitacora-push.md) relata que el iPhone pasó a
recibir tras cambiar varias condiciones: cifrado propio, payload híbrido,
urgencia, asunto VAPID y reinstalación/registro del WebClip. **No se aisló cuál
fue decisiva.** Un 201 de Apple no distinguía allí aceptación de descifrado/entrega.
No se concluye que `npm:web-push` corrompiera el cifrado.

La [revisión](../historico/2026-10/auditoria-push.md) matiza aquel diagnóstico
y descarta propuestas. Sus simulaciones, revisores, pruebas PGlite y observaciones
de dispositivo son registros atribuidos; los arneses temporales no forman una
suite reproducible de este repositorio.

| Registro Git         | Alcance                                                                                |
| -------------------- | -------------------------------------------------------------------------------------- |
| `eba61ee`            | Web Crypto e híbrido descritos en la bitácora                                          |
| `4eae308`            | Protección criptográfica y endurecimiento Push 0/1                                     |
| `20eee7e`            | Cola con lease y fencing                                                               |
| `6a50dc3`, `fc32c71` | SQL y sender del rework, incluido experimento puro                                     |
| `7480ced`, `0c26c42` | Cliente/sesión y diagnóstico del panel                                                 |
| `d298270`, `d6ade1f` | Orden de despliegue y balance anterior al recorte                                      |
| `f49ced9`            | Retirada del experimento, autenticación compartida y registro de aplicación/despliegue |

`f49ced9` tiene fecha Git del 22 de octubre y agrega textos con fecha declarada
23 de octubre. Se conservan ambas procedencias. Su mensaje registra migraciones
aplicadas y funciones desplegadas; no inspecciona el estado remoto actual ni
acredita todas las pruebas en iPhone.

## Preservar el mensaje que funcionó

Se mantuvo el cifrado Web Crypto para RFC 8291/8188 y VAPID ES256, las cabeceras,
el asunto de respaldo y la forma híbrida mientras se arreglaba lo que lo rodea.
La elección reduce cambios simultáneos en un camino que ya había tenido un
diagnóstico con causas confundidas.

Sustituirlo por una librería puede reducir código, pero no elimina el contrato
de payload, claves, worker, cola o compatibilidad. El registro no demuestra que
la librería anterior fuera defectuosa: no se usa esa explicación para justificar
retrospectivamente el cifrado propio.

Los vectores y pruebas de `_shared/webpush` contrastan primitivas. `golden.test`
protege la construcción del texto del mensaje con normalización/hash frente a
la versión de referencia; no prueba bytes cifrados aleatorios idénticos ni
recepción en dispositivos. Cifrado, cabeceras, `sub`, TTL/urgencia y formato
siguen requiriendo ensayo iPhone cuando se cambian.

El respaldo `mailto:soporte@udp.cl` es un antecedente que el código conserva.
La bitácora declara al proyecto estudiantil independiente; por eso propone
un contacto propio, no inventar afiliación. Se resuelve configurando un
`mailto:` propio y probándolo, no afirmando que ya se cambió.

## Cola recuperable y rastro

Un SELECT de pending seguido de envío y UPDATE permite carreras entre cron,
panel y ejecuciones lentas. Se eligió **lease en next_attempt_at** y reclamo
atómico con `SKIP LOCKED`. Un estado processing sin recuperación dejaría filas
atascadas si muere la ejecución. Al vencer lease se recupera con intento contado;
por eso un fallo repetido puede agotar intentos sin girar eternamente.

El cierre usa id + número de intento como fencing: no pisa otro reclamo ni la
expiración por un borrado. Cerrar en bloque y reintentar ese cierre es compatible
con la idempotencia. El lease debe superar peor lote, cifrado y cierre;
subir concurrencia sin revisar esa relación reabre la carrera.

Se eligió `ON DELETE SET NULL` para no perder fallos al quitar un endpoint.
**No bastaba solo:** las pending sin suscripción no son reclamables.
El BEFORE DELETE definer las expira antes de que la FK quite el ID y cubre
todos los caminos de baja, no solo 410 del sender.

Se conserva `push_host` en lugar del endpoint completo. El host permite
diagnosticar qué servicio rechaza y evita conservar innecesariamente una URL
de capacidad del dispositivo. La poda acota retención, pero hace irreversible
parte de un rollback; los procedimientos mantienen esa pérdida explícita.

## Identidad, sesión y suscripción

No se deduce identidad de dispositivo por origen + `user_agent`: varios equipos
pueden compartirlos y borrar por esa pareja elimina suscripciones válidas.
Se eligió trasladar pending usando el último endpoint que el servidor confirmó,
acotado a usuario/avisos de quien llama, y dejar estados cerrados como rastro.

Tampoco se desuscribe una suscripción sana al activar para forzar otra: si la
nueva falla, se pierde la que funcionaba. La baja explícita tiene una sola
implementación, navegador antes de fila remota y antes del cierre de sesión.
El registro remoto se comunica aparte del estado local.

La hipótesis original de que `getSession` devolviera «sin sesión» solo por
hidratación no explica todo el problema: el SDK espera su inicialización.
Sí faltaba distinguir servidor/navegador y reaccionar a cambios de usuario.
No se conserva la hipótesis descartada como causa probada.

`pushsubscriptionchange` no es una solución universal. El worker no dispone de
la misma sesión de RPC que la página y el registro iOS indicó ausencia del
evento. La reconciliación en primer plano cubre otro camino; no debe requerir
que el Sidebar esté montado.

## Recordatorios, preferencias y diagnóstico

El dedupe de recordatorio no puede depender solo de un aviso que su dueño puede
borrar. Se eligió `event_rsvps.reminded_at`; preferencias apagadas no marcan
para permitir recibirlo si se reactivan a tiempo. El barrido pasó a cron SQL
separado. Sin ese job faltan los recordatorios periódicos de asistencias previas
que entran en la ventana; el trigger de alta/cambio de asistencia todavía
puede producir el suyo dentro de los 20 días. Esa dependencia del barrido
se conserva en despliegue y rollback.

Las preferencias tienen dos ejes para permitir bandeja sin sonido. Ausencia
de fila permite por defecto; la función central evita reglas diferentes al crear
y encolar. Cerrar su EXECUTE evita consultar preferencias ajenas a través de
una función DEFINER sin identidad interna.

El diagnóstico del panel se centra en el aviso de autotest, no en lo que justo
procesó una invocación que compite con cron. Los conteos por estado sobreviven
a que otro proceso reclamara primero. La agrupación por servicio se hace en SQL;
un conteo fallido no convierte una pasada ya hecha en un supuesto cero ni en
un fallo de envío.

Compartir `_shared/auth.ts` evita divergencias entre funciones y fija la versión
del cliente Edge; el entorno se comprueba al cargar. Esto no convierte la
validación de tamaño/formato VAPID en prueba criptográfica de que el par concuerda.

## Worker y formato alternativo

Se descartó `data.notification || data` como reemplazo de objeto entero.
Un bloque incompleto perdía campos planos necesarios para tag, URL o marcado leído.
La precedencia es campo a campo. Si falla la presentación, se intenta un aviso
mínimo para no aceptar silenciosamente el push; no garantiza que el segundo
intento de mostrar funcione.

El experimento Push 6 ofrecía declarativo puro detrás de `PUSH_PAYLOAD_FORMAT`.
Se retiró sin activarse: el ahorro registrado no aportaba ventaja con los
topes de título/cuerpo y el híbrido cabía en el límite. Mantener dos formatos
añadía estado, ensayos y riesgo de compatibilidad. El código se puede recuperar
de `fc32c71` si cambia el problema; no es una opción vigente de configuración.

La retirada eliminó el generador alternativo, **no** el bloque declarativo del
híbrido ni su lector en el worker. Los tests pueden conservar tolerancia de
lectura de un payload puro sin volver a convertirlo en formato emitido.

## Costes y preguntas abiertas

El rework añade RPC, estados y dependencia operativa de cron/migraciones.
Los tiempos de CPU y la capacidad real de una difusión no están medidos por
pasar tests. Los recuentos de líneas, archivos y simulaciones del balance
pertenecen al corte histórico, no son métricas vivas.

Quedan preguntas sobre camino declarativo frente a worker, toque en iOS,
rotación silenciosa, TTL por tipo/Topic y memoria de endpoints vencidos.
Se preservan en el [plan](../ROADMAP.md#push-y-operacion), con las pruebas
manuales de [validación](../guias/validacion.md#push-y-moderacion).
No se cierra el riesgo de dispositivo con aceptación HTTP, mocks o un mensaje
de commit.
