# Decisiones de arquitectura

Este documento conserva elecciones, motivos, alternativas y consecuencias.
Describe también decisiones registradas aún sin implementar. El comportamiento
actual está en las [referencias](../README.md#que-leer); los pendientes, en
[ROADMAP](../ROADMAP.md).

## Procedencia y grado de certeza

Las razones generales sobre carpetas, estado, Supabase, UI y PWA provienen de
una auditoría de julio de 2026. En `0368902:docs/ARQUI.md` se presentan
expresamente como inferencias retrospectivas («intención aparente»). Se
preservan como esa reconstrucción registrada, no como actas originales de quienes
eligieron las herramientas. El código confirma la implementación, no prueba
por sí solo aquella intención.

Las decisiones específicas de mapeo/salas aparecen de forma explícita en el
ROADMAP y SALAS originales; los comentarios de código registran motivos de
restricciones concretas. Sus
[originales](../historico/2026-10/documentacion-anterior.md) y la
[hoja de ruta anterior](../historico/2026-10/roadmap-anterior.md) permiten
recuperar contexto y propuestas descartadas.

## Organización y herramientas

### Dominios y estado

La organización por features acerca UI, datos y hooks de un mismo dominio,
frente a carpetas técnicas separadas. Esa es la intención reconstruida:
trabajar en una funcionalidad sin recorrer varias capas. La consecuencia real
es parcial: existen ciclos map/pins/mapping y dependencias de shared hacia
features. No hay aislamiento completo por tener carpetas con esos nombres.

Zustand conserva estado efímero y TanStack Query domina datos remotos, caché e
invalidación, frente a un árbol único de estado. El patrón no prohíbe todo fetch
en efectos: actualización PWA, rutas y autenticación tienen ciclos distintos.
La separación ayuda a ubicar responsabilidades, pero no se acredita un resultado
de rendimiento universal ni una arquitectura ya libre de excepciones.

### Supabase directo y operaciones críticas

El cliente habla con Supabase sin una API de aplicación intermedia para cada
tabla. RPC concentra operaciones como crear con cupo y votar, para que varios
efectos y contadores formen una transacción servidor. El cliente no puede ser
el único control de rol.

El coste es mantener juntos privilegios, RLS, funciones y tipos manuales.
`EXECUTE` restringe invocación pero no sustituye controles internos de una
función DEFINER. La existencia de políticas no certifica que todas sus
combinaciones cumplan la intención. Las discrepancias conocidas tienen
[seguimiento explícito](../referencia/base-de-datos.md#discrepancias-y-observaciones-abiertas).

### UI y caché

La auditoría reconstruyó la preferencia por Radix sin estilos más Tailwind
frente a MUI/Bootstrap como búsqueda de control visual con primitivas de foco,
teclado y ARIA. Usar esas primitivas no demuestra accesibilidad integral de
cada pantalla ni del recorrido físico.

RHF/Zod se usan de forma acotada en CreatePinModal; la observación anterior
sobre coste de bundle no tiene una medida actual reproducida. Se conserva en
el histórico, no como cifra para justificar retirar una dependencia hoy.

La caché de teselas CacheFirst y su retención están configuradas en Vite.
La mala conectividad del campus fue un motivo inferido por aquella auditoría,
no un ensayo de cobertura repetido en esta reorganización. La consecuencia
comprobable es reutilizar teselas descargadas, no convertir todo dato en offline.
La detección y el relevo PWA tienen su
[contrato y límites](../referencia/pwa.md).

## Fuente única de catálogo y geometría

La lista semilla permite arrancar sin una lista vacía; al llegar la base,
`publishFaculties` conserva la referencia del array con `splice`.
Reasignarla dejaría consumidores consultando el catálogo anterior.
Las listas reactivas se suscriben con `useFaculties`.

Se descartaron un índice paralelo de perímetros y una copia geométrica activa
en el repositorio. Los registros describen desincronización de nombre/«sin trazar»
y una copia que se mantuvo desfasada. Hoy se deriva del catálogo vivo;
`polygon NULL` no se sustituye por un cuadrado alrededor del marcador.
Ese respaldo inventado llegó a atribuir facultad a pines de la calle.
La consecuencia aceptada es que una facultad sin trazo no tiene contorno,
captura geométrica ni editor interior, aunque siga en el catálogo.

El criterio también limita datos demo: interior vacío frente a planos ficticios
que el diagnóstico situó lejos del edificio real. Exportar archivos TypeScript
permite descargar una representación tipada sin una librería de ZIP; no demuestra
una integración de esos archivos al demo ni un respaldo de producción.

## Mapa, plantas y marcadores

La planta visible es contexto de facultad. Atarla al edificio bajo el centro del
mapa cambiaba el piso al panear y dejaba otros edificios mostrando plantas
superpuestas. La regla compartida en `floorVisibility` mantiene la unión de
niveles; exterior sin planta se ve a ras de suelo y áreas exteriores conservan
referencia en otras plantas. Esto no altera las precondiciones del formulario.

Los comentarios y el plan registran alternativas visuales descartadas:
atenuar permanentes confundía con caducidad; reducir demasiado marcadores los
volvía difíciles de leer/tocar; reescribir SVG por revalidación causaba parpadeo.
La infraestructura se distingue por tamaño y las salas por píldora con código;
la densidad pendiente se resuelve como densidad, no volviendo ilegible cada pin.
MapLibre conserva control de opacity/transform/clases; las protecciones actuales
están en [CLAUDE.md](../../CLAUDE.md#reglas-del-mapa-que-no-hay-que-perder).

El resize local responde al problema de desalineación cuando cambia el contenedor.
Se conserva la defensa existente sin afirmar que MapLibre solo mida en el
constructor: la dependencia actual también tiene ResizeObserver.

## Editor y validaciones

Se eligió un editor integrado sobre MapLibre con herramientas y geometría
propias, sin añadir una librería de dibujo para cada operación. Rectángulos,
ortogonalidad, ajuste, copia y división responden al trazado manual.
La estimación original de esfuerzo/tamaño pertenece al plan histórico;
no mide los componentes actuales.

La distinción error/aviso evita que una corrección de trazado legítima quede
bloqueada: incoherencias como un área fuera de su edificio impiden guardar;
solapes que pueden ser deliberados avisan. Edificios que asoman de un perímetro
también avisan. El exterior no es una excepción artificial del modelo: un
patio lleva edificio/planta nulos.

La contrapartida es un conjunto de aproximaciones geométricas y huecos de
validación. La [referencia del editor](../referencia/repositorio.md#editor-de-mapeo)
describe contención, umbrales y cobertura actuales. No se deben presentar los
huecos por planta o controles cruzados planeados como verificaciones existentes.

<a id="salas-geometria-y-horarios"></a>
## Salas, geometría y horarios

### Un objeto social, geometría opcional

La decisión registrada distingue **qué es un lugar** de **por dónde se dibuja**.
La sala conserva un pin con autor, comentarios, fotos, votos y verificación;
un área opcional puede aportar geometría. Permite empezar por edificios y plantas
sin esperar a trazar cada aula.

Hacer la sala solo un área obligaría a rehacer capacidades sociales y su
presentación. Hacerla solo un punto limita representación del recinto.
La solución acordada reutiliza ficha y motor social del pin y prevé abrirla
también desde geometría, sin duplicar conversaciones.

El estado es parcial. Crear un área no enlaza un pin retrospectivamente y la
cola completa de sugerencias/trazado aún falta. La herramienta room/importador
coloca puntos, no propone contornos automáticamente. No se afirma que todo el
flujo «área + ficha» se haga sin migración: el diseño posterior propone tipos,
relaciones y cola que aún no existen.

### Flujo acordado, todavía pendiente

Antes de publicar se explica que es una sugerencia, su duración y qué significa
que se acepte; requiere confirmación explícita. Desde la publicación es un pin
visible y social: no se esconde mientras espera revisión. Quien aporta recibe
respuesta de aceptación o rechazo con motivo.

La revisión se diseñó dentro de `/admin/mapeo` porque necesita ver el plano:
lista de pendientes del edificio/planta, corrección del punto y decisión con
motivo. Aceptar convierte el pin en permanente y concede el premio de la
verificación; después ofrece trazar un área ya asociada a ese pin.
La relación y esa acción conjunta aún deben construirse: dibujar hoy un área
no las produce automáticamente.

Cuando se trace el área, el diseño elegido **sustituye la chincheta por el
polígono con código**, y tocarlo abre exactamente la ficha social del pin.
Mientras no haya área, permanece el marcador de pin. No se crea otra ficha
parecida ni se dividen fotos, votos o conversación.

Se descartó que el estudiante dibuje el polígono: la sugerencia es un punto;
revisar trazo por trazo convertiría el aporte en trabajo de edición.
También se descartó aprobar automáticamente al vencer un reloj.
La cola espera resolución humana y el pin conserva, mientras no se implemente
otra política, el TTL de categoría. La nota de «plazo de gracia» del plan
anterior no define un contrato ya construido ni autoriza aprobación por tiempo.

El original registra preferencia por una cola de pocas manos administradoras,
pero deja por resolver su encaje con el rol moderador y el acceso al editor.
Debe conservarse esa preferencia al cerrar el diseño; la capacidad SQL de
mapear no abre por sí misma el panel actual.

`computacion` se renombró a Sala de computación y escalera ya existe.
«Sala» no obliga a tener código oficial: salas de estudio u otros recintos
pueden no tenerlo. La propuesta de vincular categoría a tipo de área desde el
catálogo evita otra lista fija en UI, pero ese vínculo sigue pendiente.

### Alcance inicial de recintos

El alcance registrado de la futura cola es deliberadamente corto por el coste
humano de trazar cada recinto. Debe ser permanente y tener superficie útil
para representar, no ser solo un punto.

| Categoría del pin | Tipo de área previsto |
|---|---|
| `sala` | `room`, todavía ausente del enum |
| `casino` | `cafeteria` |
| `computacion` | `lab` |

`bano`, `bicicletero` y `deporte` encajarían, pero quedaron aplazados.
Ascensor, rampa y escalera se modelan como puntos/conectores; una caja de escalera
grande puede ser área `service` trazada a mano. Impresora, agua, microondas,
enchufe y entrada son puntos. Food truck, feria, estudio o sala-libre son
efímeros: no entran por ese flujo de recintos permanentes.
La propuesta `categories.area_kind` permite declarar el vínculo en el catálogo,
en lugar de repartir esta lista en condicionales de UI; aún no existe.
Las salas de computación de libre acceso pueden no tener código ni horario:
su título conserva el nombre propio y la categoría no debe exigir inventar uno.

### Un conector vertical, una conversación

Está decidido pero no implementado añadir un rango con `floor` y `floor_to`
para ascensores y escaleras. Duplicar un pin por planta sería legal por punto +
planta, pero repartiría fotos, avisos y verificaciones de un mismo objeto.
Un ascensor averiado es un hecho único.

El diseño conserva un pin y lo representa en cada nivel del rango.
No incluye cero; valida ambos extremos contra plantas declaradas y permite
corregirlos al crear y editar por el camino correspondiente del autor.
Un rango no representa paradas intermedias omitidas; el plan acepta anotarlas
en la descripción frente a añadir una lista de paradas para ese caso.
Hoy solo existe un `floor`: no describas ese rango como conducta actual.

### Horario como capa externa

La sala física debe sobrevivir a una caída de EIT. La decisión registrada es
leer, cachear y derivar horarios, sin copiarlos a `pin_schedule_items`:
esa tabla sirve al programa de un evento escrito en la app, no a una segunda
copia de un horario externo. Mantener dos fuentes repetiría el problema de
perímetros duplicados.

La futura capa distingue ocupada, libre y sin datos. Ausencia de clase, de
cobertura o de un bloque fiable no equivale a disponibilidad. Los cortes y
comparaciones con `salas-vacias` se preservan con fecha; no se infiere un
backend GraphQL, republicación automática o permiso de reutilización por ver
un JSON accesible. Carga humana, verificación y contacto con el mantenedor
siguen siendo dependencias.

## Administración, avisos y datos de lugares

Las secciones del panel usan rutas frente a pestañas solo en memoria: permiten
enlaces profundos, historial del navegador y destinos de notificación.
El guard único espera rol; repetir guards que no esperan produjo rebotes al mapa.
El panel general debe ser utilizable en teléfono; trazar polígonos sigue
presentándose como trabajo de escritorio.

La bandeja personal no es la cola administrativa. Se separaron trabajo de equipo,
agrupación temporal, filtros y acciones de leer/borrar; un fallo de carga no puede
afirmar «sin avisos». La mutación optimista guarda/restaura copia porque esperar
un refetch hacía parecer que un toque no respondía.
El [contrato actual](../referencia/notificaciones.md) no implica que todos los
criterios de moderación del plan original estén protegidos por las RPC.

Las galerías de facultad, edificio y área tienen un único destino. No se heredan
automáticamente fotos de un recinto a otro: una portada de facultad no acredita
el interior de cada edificio. Se preserva selección común en FacultyDetail para
evitar una segunda ficha aislada con contenido repetido.

El registro de actividad conserva hechos aunque se borre el original, frente
a mezclar únicamente filas que todavía existen. Triggers capturan esos hechos
sin reescribir cada RPC; resumen e IDs limitan lo copiado y una avería del log
no debe abortar la acción principal. Poda de actividad y de push son mecanismos
distintos; solo la segunda tiene su job provisionado en las migraciones citadas.

## Deuda y consecuencias

Las responsabilidades siguen concentradas en MapPage, MapView, CreatePinModal,
pins/api, MappingPage/Canvas y uiStore; Sidebar cruza el límite de shared.
No se mantiene una tabla de líneas como medida de esa deuda.
`buildCommentTree` ya está en `forum/utils.ts`: no se sigue describiendo dentro
del modal.

Extraer una regla pura compartida puede evitar ampliar ciclos. Eso no autoriza
una refactorización de aplicación incidental al cambiar documentación.
La falta de alcance por facultad, los nombres oficiales fijos, las capacidades
parciales y los límites de ruta requieren decisiones o correcciones propias,
con seguimiento en el [plan](../ROADMAP.md).
