# Salas, códigos y catálogo

Contrato del código de sala y del importador. La decisión de tratar la sala como
pin y añadir geometría después está en
[arquitectura](../decisiones/arquitectura.md#salas-geometria-y-horarios).
El [plan](../ROADMAP.md#salas-y-mapeo) contiene los flujos todavía pendientes.

## Código y normalización

`shared/utils/roomCode.ts` intenta sugerir una planta; no decide ubicación ni
facultad. El código se guarda como texto, sin imponer que todo recinto tenga
un formato reconocible.

El esquema posicional es `EDIFICIO.PISO.SALA`. Se separa por **los dos primeros
puntos**: la sala puede contener puntos y espacios.

| Entrada | Edificio informativo | Planta | Sala conservada |
|---|---|---|---|
| `E441.4.S401` | `E441` | 4 | `S401` |
| `V432.-1.SIM` | `V432` | −1 | `SIM` |
| `E441.4.L.D` | `E441` | 4 | `L.D` |
| `E441.5. LAB INF` | `E441` | 5 | ` LAB INF`, con espacio inicial |
| `E278B.4.S402` | `E278B` | 4 | `S402` |

`parseRoomCode` recorta los extremos del código completo, convierte el prefijo
informativo a mayúsculas y conserva el identificador de sala. Admite letras
finales en el edificio: `E278A` y `E278B` no se deben colapsar.

El respaldo `A-302` reconoce letras, guion y tres o cuatro dígitos; deduce planta
del primer dígito. Es una convención de la aplicación, no una conclusión del
horario EIT. `SMV-03` o `Sala del fondo` pueden ser textos válidos para una sala
sin que el parser deduzca planta. Un cero deja la planta en `null`; la planta
baja del modelo es 1 y los subterráneos son negativos.

`normalizeRoomCode` recorta, pone mayúsculas y colapsa espacios **al comparar**.
No reescribe el valor publicado. Tampoco convierte alias semánticos:
`LAB INF` y `Lab Informática` no se vuelven iguales solo por normalizar espacios.

## Ubicación y plantas

El edificio del pin se obtiene del punto y su huella, no del prefijo escrito.
En el formulario, si el punto cae en un edificio se ofrecen sus plantas;
fuera de una huella se usa la unión de plantas de la facultad. Se ofrece
Exterior `null`, incluso en un edificio con una sola planta. Si no hay niveles,
el campo puede no mostrarse. El código solo propone una planta y permite corregirla.

El servidor valida el resultado, también en ediciones y movimiento. En edificio
exige una planta declarada; fuera, consulta las de su facultad cuando esta tiene
edificios. Hay excepciones cuando no hay facultad o aún no tiene edificios:
no es cierto que cualquier pin sin edificio declarado sea rechazado.
Consulta [validación de plantas](base-de-datos.md#ubicacion-y-plantas).

La planta activa del mapa, en cambio, es contexto de **facultad**, compartido
por marcadores y polígonos. No copies las restricciones del formulario a
`floorVisibility`.

## Catálogo derivado e importador

`features/mapping/salasEit.ts` hace GET al `data.json` que usa la web de salas EIT.
Extrae cadenas `data.allSalasUdps.edges[].node.place` y llama a
`buildRoomCatalog`. Un bloque horario no es una sala: varias filas pueden
mencionar el mismo código.

El helper puro descarta lo que no parsea con edificio y planta, agrupa por código
recortado y cuenta bloques. Ordena por edificio, planta y sala. `missingRooms`
compara códigos normalizados contra pines existentes; `catalogFloorsOf` y
`catalogRoomsOf` ayudan a preparar la selección.
`buildingMatchesCode` exige coincidencia del prefijo con `short_name` o
`aliases` del edificio. No hay columna `buildings.code` ni deducción automática
de facultad por la calle.

El fetch devuelve `[]` ante error, JSON inesperado o cancelación. Eso mantiene
utilizable el editor, pero un catálogo vacío no prueba ausencia de salas.
React Query conserva la consulta durante la sesión con `staleTime` de una hora
y sin retry; la petición HTTP normal deja la revalidación al navegador.
No hay una segunda copia manual en `localStorage`.

En `/admin/mapeo`:

1. Traza el perímetro, edificio y sus plantas; revisa las plantas que el catálogo
   reconoce antes de colocar salas.
2. Pon el prefijo correspondiente en `short_name` o un alias y selecciona el edificio.
3. Elige una sala aún no representada; el siguiente clic coloca su pin con código
   y planta preparados.
4. Coloca el punto donde está la sala. El catálogo no contiene una coordenada
   fiable para hacerlo en lote.
5. Revisa y verifica el pin si debe permanecer.

El importador crea pines normales. `sala` tiene TTL de 720 horas: una sala
importada y no verificada puede caducar. Un alta masiva en el centroide no aporta
ubicación real y choca con la regla de punto/planta ocupado. No hay un seed
automático de salas ni un contorno propuesto para cada una.

## Representación e interacción

La categoría `sala` es distinta de `sala-libre`, un aviso humano temporal de
6 horas. `room_code` se muestra en la ficha y puede corregirse al editar.
`MapView` ya pinta una píldora con `shortRoomCode`; la etiqueta no es un
pendiente ausente. `searchRooms` encuentra códigos, números y edificios y
`roomSubtitle` da contexto al resultado.

La sala usa el motor social del pin: comentarios, fotos, votos, autoría,
verificación y reportes. El área puede describir su geometría, pero dibujarla
**no enlaza automáticamente pines anteriores** ni concede karma. `createArea`
solo crea el área; `indoorLocationAt` calcula asociaciones al crear/mover pines.
No existe la función SQL `verify_pin`: la verificación usa
`verify_and_make_permanent`.

La cola de sugerencias, su plazo de gracia, respuesta con motivo y acción única
de revisión/trazado siguen pendientes. Un estudiante puede publicar un pin
`sala`, pero eso no constituye aquel flujo acordado. El panel actual solo admite
admin, aunque SQL pueda autorizar mapeo a un moderador con capacidad.

## Direcciones y fuentes externas

La investigación anterior relacionó prefijos `E`, `V` y `M` con Ejército,
Vergara y Manuel Rodríguez Sur. Una facultad puede tener varios predios; una
sala pertenece al edificio físico, no a la facultad del ramo que la ocupa.
Los sufijos de edificio pueden distinguir cuerpos del mismo predio.

Las tablas completas de direcciones, salas, horarios, niveles de confianza y
fuentes se conservan en
[documentación anterior, SALAS.md](../historico/2026-10/documentacion-anterior.md#docssalasmd).
Pertenecen a cortes del 10 y 26 de agosto de 2026, no a un catálogo vivo verificado.
No uses sus recuentos o rankings como cifras actuales ni atribuyas a un código
una facultad distinta de la geometría del mapa.

El estudio registró como resueltos `E306`/Comercio y varias direcciones con
fuentes o terreno; dejó por confirmar `E278A/B`, accesos de Biblioteca Nicanor
Parra y presencia de salas en Ejército 219 y 141, además de la atribución
probable de `V210`. Son niveles de certeza del registro, no visitas repetidas
durante la reorganización.

La fuente externa no tiene un contrato versionado en este repositorio.
No se comprobó aquí su disponibilidad, permisos de reutilización, periodicidad,
licencia o mantenimiento actual. La forma JSON no prueba por sí sola una API
GraphQL activa ni un cron de republicación. Contactar a quien mantiene el dato
sigue siendo un requisito para ampliarlo al mapa público.

## Horarios y límites de interpretación

Hoy el dato EIT se usa en administración como catálogo. No hay una capa pública
que cruce horarios y pinte libre/ocupada.

La decisión registrada es conservar la sala como entidad estable y leer/cachear
horarios como capa externa, sin copiarlos a `pin_schedule_items`, que sirve al
programa editorial de un evento. Si la fuente falla, la ficha social y la
geometría deben seguir teniendo sentido.

Para una integración futura, «sin clase en este corte» no equivale a «libre».
Fuera de cobertura, bloque lectivo o fecha confiable, el resultado es **sin datos**.
No deduzcas capacidad, disponibilidad de toda la universidad o identidad
semántica de un laboratorio solo por el número de bloques.
El estudio comparativo con `salas-vacias`, sus fallos de parser/cobertura y
la receta de derivación permanecen en el histórico. Esa receta no filtra igual
que `buildRoomCatalog`: para el comportamiento de la aplicación, usa el helper
y sus pruebas, no el one-liner como implementación equivalente.
