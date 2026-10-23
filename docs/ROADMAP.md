# Plan vivo

Pendientes y decisiones abiertas. La implementación actual se explica en las
[referencias](README.md#que-leer), los motivos en
[decisiones](decisiones/arquitectura.md) y el diagnóstico/fases anteriores en
[el original fechado](historico/2026-10/roadmap-anterior.md).

La revisión local de octubre contrastó el corte `b16bb4b`. «Existe en código»
no acredita datos cargados, migraciones aplicadas ni pruebas de dispositivo.
El commit `f49ced9` registra el despliegue del rework push; verificar el entorno
es una tarea distinta. No se conserva «Push 0–6 sin desplegar» como estado vigente.

## Orden de trabajo

Primero aclarar las discrepancias de permisos antes de ampliar el reparto de
roles. En salas, la carga y revisión humana preceden a la capa de disponibilidad;
el flujo de sugerencias depende de resolver quién puede curarlo.
Densidad mantiene el abanico como primer incremento del diseño anterior.
Las pruebas push deben preceder a cambiar mensaje, cabeceras o retirar
compatibilidad de rollback. Este orden expresa dependencias, no plazos nuevos.

## Seguridad y permisos

- [ ] Auditar y resolver las discrepancias de
  [la referencia SQL](referencia/base-de-datos.md#discrepancias-y-observaciones-abiertas):
  correo de perfiles, protección de role/karma con owner privilegiado, escritura
  directa de votos, privacidad de nota y resolución de reportes asignados.
  Verificar dueño, grants, políticas y llamadas reales antes de cerrar.
- [ ] Completar el alcance de capacidades: mapping/reports no representan todo
  lo que prometen verify/content/official ni el acceso del panel. Definir y
  comprobar interfaz, RLS y RPC por separado.
- [ ] Acotar al moderador por facultad si ese rol representará organizaciones
  estudiantiles. Las capacidades actuales acotan el qué en algunos puntos,
  no el dónde. Definir excepciones de lugares compartidos y administración.
- [ ] Resolver atribución oficial dinámica junto con ese alcance.
  El diseño registrado propone `student_org_name` en facultades y firma desde
  la facultad del moderador, sin inventar nombres si falta el dato.
  Quitar los respaldos contradictorios de FIC/UDP requiere tocar cliente, demo
  y SQL; no basta corregir un texto del panel.
- [ ] Revisar paridad INVOKER/DEFINER de `prevent_occupied_pin_location` y
  otros endurecimientos de RLS/funciones, índices FK y privilegios señalados.
  No sustituir esa revisión por un GRANT masivo.
- [ ] Comprobar en el entorno las filas interiores inválidas anteriores al
  trigger. El control nuevo no corrige retrospectivamente los datos.

## Salas y mapeo

- [ ] Cargar y verificar salas con el importador existente, edificio por edificio,
  declarando antes sus plantas. La fuente no aporta puntos fiables y la
  verificación evita que el TTL de sala borre el trabajo.
  No marcar como completado por estar construido el importador.
- [ ] Confirmar en terreno las atribuciones/accesos dudosos conservados en
  [salas](referencia/salas.md#direcciones-y-fuentes-externas), incluidos E278,
  Biblioteca Nicanor Parra y presencia docente en Ejército 219/141.
- [ ] Contactar a quien mantiene EIT: cobertura, periodicidad, uso en producción,
  formato y condiciones de reutilización. Un JSON accesible no acredita permiso
  o contrato estable.
- [ ] Implementar el [flujo acordado](decisiones/arquitectura.md#flujo-acordado-todavía-pendiente):
  confirmación antes de publicar y pin visible/social desde ese momento;
  cola sobre el plano, revisión y respuesta con motivo, sin aprobación por reloj;
  aceptación y trazo asociado que resuelva pin/geometría juntos. Concretar
  caducidad/gracia y acceso efectivo preservando la preferencia administrativa
  registrada. El área no enlaza pines por el mero dibujo.
- [ ] Completar la representación área + ficha social común: el polígono con
  código sustituye la chincheta al existir área; tocarlo abre la ficha del pin.
  Resolver asociación de salas ya existentes y trazo asistido dentro del
  alcance inicial sala/casino/computacion; mantener las exclusiones registradas. Resolver `room`/tipos de área y la propuesta
  `categories.area_kind` sin una nueva lista fija de equivalencias en UI.
  La etiqueta actual de código y el permiso servidor de mover pines **ya existen**.
- [ ] Añadir aviso no bloqueante de código de sala duplicado en el edificio,
  conservando normalización de comparación y correcciones legítimas.
- [ ] Implementar el rango `floor`/`floor_to` decidido para ascensor y escalera:
  un pin social, extremos válidos, sin cero y editable al crear/corregir.
  El límite de paradas salteadas está en la [decisión](decisiones/arquitectura.md#salas-geometria-y-horarios).
- [ ] Completar controles de solape edificio/edificio y exterior/edificio y el
  criterio de error para solapes de salas. La cobertura actual no detecta huecos
  por planta; definir y construir esa comprobación sin llamar exacta a la suma.
- [ ] Completar mensajes/recuperación del editor: distinguir validación inline
  de error remoto, vacío de planta con acciones y reintento público.
  La confirmación de borrado no enumera pines y el borrador no persiste en disco.
- [ ] Si se retoma alimentar demo desde exportación, definir importación explícita
  y fuente; descargar TypeScript no lo implementa.

## Densidad, orientación y descubrimiento

- [ ] Abanico para colisiones cercanas, con el umbral aproximado del diseño
  original como punto a calibrar. Mantener tamaño legible e IDs; no crear
  etiquetas DOM que compitan con los mismos clics. Agrupar no puede activar
  simultáneamente ficha del área y del pin.
- [ ] Detalle por zoom facultad → edificio → pin y transiciones.
  No hay clustering completo por el hecho de reducir infraestructura.
- [ ] Ruteo accesible fino: elegir acceso/rampa adecuado y continuación real
  por conectores hasta destino. La guía actual toma primeros candidatos;
  no comprueba cercanía, conectividad ni todas las paradas, y los respaldos
  OSRM/recta no heredan garantía wheelchair.
- [ ] Sidebar como índice desplegable de edificios, conservando estado útil
  para facultades sin mapeo y evitando una segunda ficha social.
- [ ] Capa pública de horarios solo después de carga/contacto/cobertura:
  ocupada, libre y sin datos. Ausencia de clase no permite pintar verde
  indiscriminadamente. La entidad sala debe sobrevivir a caída de la fuente.
- [ ] Interior como imagen de calco y capacidad de sala siguen como ideas
  fuera de fases: definir alcance cuando se retomen, sin afirmar que las
  columnas legadas o el catálogo ya resuelven el flujo.

## Onboarding, mensajes e interacción

- [ ] Orquestador general, slides y coach marks/tours en momentos distintos,
  mapa y facultad con acceso posterior desde Sidebar. El tutorial actual ya
  se difiere ante setup de perfil; no reabrir ese caso como carencia total.
  Wayfinder no es el tour propuesto.
- [ ] Explicar plazos/caducidad, beneficios de verificar y causas de restricciones
  durante creación/edición; conservar Exterior y permisos reales al concretar
  qué campos serán obligatorios.
- [ ] Educación de karma con motivo y preguntas frecuentes. Verificar ya genera
  aviso de permanencia/+25; no significa que todo cambio de karma esté explicado.
- [ ] Estado sin conexión con explicación y política de escritura/solo lectura.
  La caché de teselas no implementa por sí sola este comportamiento.
- [ ] Cerrar literales ES/EN restantes en mapping, IndoorFields, Wayfinder,
  UpdatePrompt y formularios. `check:i18n` comprueba catálogos, no cobertura JSX.
- [ ] Búsqueda de texto completo y tags en foro.
- [ ] Moderación con IA conserva la propuesta anterior: proveedor principal y
  respaldo, evaluación de falsos positivos y cola humana; necesita definición
  de alcance y verificación propia.
- [ ] Pruebas E2E y escenarios de integración real; no equivalen a la suite
  unitaria con dobles.

<a id="push-y-operacion"></a>
## Push y operación

- [ ] Verificar aplicación efectiva de migraciones, jobs, logs HTTP, preferencias,
  cola, recepción y toque en dispositivos. Registrar resultado/fecha/entorno,
  sin presentar el mensaje de commit como prueba actual.
- [ ] Configurar `VAPID_SUBJECT` con contacto propio y probar iPhone.
  El respaldo actual sigue siendo el registrado; no se cambió en este trabajo.
- [ ] Diseñar/probar TTL por tipo y `Topic` conservando el criterio de no bajar
  urgencia sin prueba de dispositivo.
- [ ] Resolver memoria de endpoints caducados y comunicación al cliente, sin
  identificar dispositivos por User-Agent.
- [ ] Tras verificación de dispositivo, evaluar pasar VAPID como cadena a
  `applicationServerKey` y simplificar conversión; comprobar primero formato
  base64url y compatibilidad, no retirar los respaldos a ciegas.
- [ ] Decidir cuándo deja de ser necesario el rollback antes de retirar
  `p_old_endpoint` heredado, mensajes legacy y tarjeta de migración ausente.
  Valorar diagnóstico con evidencia de uso y coste, no por una cifra de líneas.
- [ ] Medir CPU/volumen de difusión y la relación concurrencia/lease/cierre.
  Los presupuestos de código no son throughput medido.
- [ ] Inspeccionar el conteo de versión en el hosting real y elegir una solución
  que no dependa de un historial truncado si el problema persiste.
  No se da por activada una variable de deep clone por estar anotada.
- [ ] Revisar la espera sin timeout propio de `registration.update()` y su
  comportamiento real ante red/instalación fallida. Recargar no acredita relevo.
- [ ] Optimizar `fic.png` y comprobar impacto del build antes de decidir volver
  a precachearla. La exclusión existe; la reducción no está hecha.
- [ ] Definir/programar poda del registro de actividad si se requiere.
  `prune_activity_log` no se ejecuta automáticamente por existir.

El detalle de operación y rollback está en [despliegue](guias/despliegue.md), no
en una lista de fases cerradas. El experimento de payload puro retirado y los
diagnósticos anteriores permanecen accesibles desde [decisiones push](decisiones/notificaciones-push.md).

## Deuda local sin corrección incidental

- [ ] Revisar coherencia de datos demo `ingenieria/fic`, colores de tema HTML/
  manifiesto y declaraciones de variables de entorno, localizados en la
  [referencia](referencia/repositorio.md#desajustes-locales-conservados).
- [ ] Revisar el límite de 300 pines y la deduplicación parcial del importador
  antes de tratar sus resultados como inventario completo de una facultad.

## Criterio para cerrar

Cerrar exige implementación y comprobación del alcance declarado. Separar
pendientes de código, trabajo humano y pruebas remotas evita confundirlos.
No se reabren rótulos antiguos sin definición de terminado, como «AA final»:
si se retoman, se escribe el criterio concreto. Las decisiones cerradas y sus
motivos siguen en los destinos enlazados, no en casillas repetidas del plan vivo.
