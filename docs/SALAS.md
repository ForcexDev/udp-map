# Salas y direcciones del campus

Este documento es el **estudio previo** del módulo de salas: qué fuente existe,
qué formato tiene el código de sala de verdad —no el que suponíamos—, qué
edificio corresponde a qué dirección y a qué facultad, y qué haría falta para
que una sala acabe siendo un pin en el mapa.

**Aquí no se implementa nada.** Es deliberado: la parte cara de esto no es el
código, es acordar el vocabulario. Mientras no esté claro que `E441.4.L.D` no se
parte en tres, que el prefijo del código **es** la dirección postal y que una
facultad puede tener cuatro direcciones, cualquier implementación va a nacer
torcida. Cuando se implemente, este archivo es el contrato.

Fecha del levantamiento: **2026-08-10**. Los datos de horario son un corte del
segundo semestre 2026.

Relacionado: `docs/ROADMAP.md` §3.4 (el código de sala), §13.3 (buscar dentro de
una facultad) y §14 ("Salas libres" — el bloqueo que este documento levanta).

---

## 1. La fuente existe y es pública

`docs/ROADMAP.md` §14 decía que a "Salas libres" le **faltaba el acceso a la
fuente**. Ya no falta:

```
GET https://salas.docencia-eit.cl/data.json
```

- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *` → **se puede consultar desde el navegador**,
  sin proxy y sin Edge Function.
- Trae `Last-Modified` y `ETag`, así que se puede revalidar barato.
- En el corte del **2026-08-26**: **1304 registros, 82 salas distintas, 11
  edificios**. El corte anterior (2026-08-10) traía 799 registros y 61 salas: el
  archivo se republica, así que **cualquier número de este documento es una
  foto, no una constante**. La receta para rehacerlo está en la §7.

Es el `data.json` que consume `salas.docencia-eit.cl`, la web de "salas vacías"
de la FIC. La forma del JSON delata que aguas arriba hay una API GraphQL:

```jsonc
{ "data": { "allSalasUdps": { "edges": [
  { "node": {
      "code":    "CBE2000",                    // sigla del ramo
      "section": 1,                            // sección
      "course":  "PROBABILIDADES Y ESTADÍSTICA",
      "place":   "E441.4.S401",                // ← el código de sala
      "start":   "8:30:00",
      "finish":  "9:50:00",
      "day":     1,                            // 1 = lunes … 5 = viernes
      "teacher": "GUERRERO MIGUEL ANGEL"
  } }
] } } }
```

### Lo que hay que saber antes de apoyarse en ella

- **No es una API oficial de la universidad.** Es el archivo estático de una web
  de la Facultad de Ingeniería y Ciencias, servida en Vercel. No tiene versión,
  ni contrato, ni licencia publicada. Puede cambiar de forma o desaparecer sin
  aviso, y una implementación que la lea tiene que **degradar a "sin datos"**,
  nunca romper el mapa.
- **Solo cubre la FIC.** Son los ramos de la FIC, no todos los del campus. Los
  ramos de la FIC ocupan salas de otras facultades (§4), pero de esas facultades
  solo vemos las salas que la FIC usa, no su horario completo.
- **Las filas incompletas cambian de un corte a otro, y mucho.** El 2026-08-10
  eran 30 sin `course` y 38 sin `teacher` (~4 %). El 2026-08-26 no falta
  **ningún** `course` y faltan **360** `teacher` — el 28 %. O sea que la
  completitud del archivo no es una propiedad estable en la que apoyarse: sirven
  para "ocupada", no para "quién la dicta".
- **Diez filas no dicen en qué sala están.** Siete traen `LOC` y tres el campo
  vacío. `LOC` no es basura: es una sala real del subterráneo de `V432` que
  aparece en el listado estático de la §5.2, escrita sin el prefijo de edificio
  y planta. Se descartan al derivar el catálogo, porque sin planta no se puede
  colocar el pin, pero conviene saber que esa sala existe.
- **Antes de depender de esto en producción, hay que hablar con quien la
  mantiene** (Facultad de Ingeniería y Ciencias / los estudiantes de
  `open-source-udp`). Que un archivo sea accesible no lo hace un permiso, y aquí
  interesa la relación más que el archivo: una fuente acordada dura, una
  raspada no.

### De dónde salen esos datos

Averiguado el 2026-08-10, desde fuera. **Nada de esto lo cargan los estudiantes
de `salas-vacias`: se lo dan hecho.** La cadena es esta:

1. **`docencia-eit.udp.cl` es —era— la plataforma de docencia de la Escuela de
   Informática y Telecomunicaciones.** El Archive conserva de ella un
   `/oauth2/login?client_id=…` y una app Next.js en `/app`. O sea: una
   plataforma **con sesión**, de la escuela, no un sitio de alumnos. Hoy
   responde **521** (Cloudflare: el origen está caído), y ahí está la pista de
   por qué el servicio se mudó a un dominio propio.
2. **`salas.docencia-eit.cl` es esa mudanza.** Es un Next.js en Vercel, con
   Material UI, y su bundle pide **`/data.json` en ruta relativa** — el archivo
   es suyo, de su propio origen. Es el eslabón que publica el dato.
3. **`salas-vacias` (tus amigos) solo consume ese archivo.** Su
   `app/axios/getSalas.ts` tiene la URL absoluta
   `https://salas.docencia-eit.cl/data.json` clavada. En el repositorio hay un
   `data.json` propio, pero se subió **una sola vez, en octubre de 2024**, y en
   marzo de 2026 el commit *"fix: corrección en la ruta del json"* cambió a leer
   el de la facultad. Traducido: su copia se les quedó vieja y pasaron a tirar
   de la fuente.

**Y el dato no lo escribe nadie a mano.** La prueba está en la forma del
archivo:

```jsonc
{ "data": { "allSalasUdps": { "edges": [ { "node": { … } } ] } } }
```

Eso es **la respuesta de una consulta GraphQL volcada a disco tal cual**, con
sobre y todo (`data` → `edges` → `node`, que es paginación estilo Relay). Nadie
diseña un archivo estático así, y menos escribe 799 registros envueltos uno por
uno. Alguien corre una consulta contra el sistema académico de la escuela y
guarda la salida entera en `public/data.json`. El nombre de la colección,
`allSalasUdps`, es de estilo Gatsby/Relay y no existe en ninguna parte pública.

Lo que **sí** apunta a que se republica sola: el archivo trae
`Last-Modified: 2026-08-11`, o sea de esta semana, mientras el repositorio de
tus amigos lleva sin tocar el suyo desde 2024. El archivo se refresca; el
repositorio no.

Lo que **no** se puede saber desde fuera: si ese volcado lo dispara un cron o
una persona que aprieta un botón y redespliega. Para eso hay que preguntar, y es
fácil: tus amigos consumen el archivo, así que saben quién en la EIT lo
mantiene. **Esa pregunta vale más que cualquier deducción de aquí**, porque de
la respuesta depende si podemos leerlo en producción o si conviene pedir algo
más estable.

### Sobre `open-source-udp/salas-vacias`

Es el proyecto del que sale esa web. Se revisó **solo para localizar la fuente**,
y de ahí no hay que copiar nada más: es un Next.js con Material UI que resuelve
un problema distinto (una grilla de salas por piso) al nuestro (pines en un mapa
georreferenciado). Su valor para nosotros es concreto y ya está extraído:

1. La URL del `data.json`.
2. `app/utils/buildings.json` y `allRooms.json`: **un listado de salas de otro
   semestre**, que contiene salas que hoy no tienen clase. Es lo que permite
   distinguir "sala que existe" de "sala con clase esta semana" (§5).

---

## 2. El código de sala, tal como es de verdad

`docs/ROADMAP.md` §3.4 lo daba por "formato UDP confirmado: `E441.1.S101`", que
se parte en tres por los puntos. **Contra los datos reales eso falla.** El
formato de verdad es:

```
<EDIFICIO> . <PISO> . <SALA>
```

…donde **`<SALA>` puede contener puntos y espacios**, así que hay que partir por
los **dos primeros** puntos y dejar el resto entero:

```
E441.4.S401     → { edificio: 'E441', piso:  4, sala: 'S401'     }
V432.-1.SIM     → { edificio: 'V432', piso: -1, sala: 'SIM'      }
E441.4.L.D      → { edificio: 'E441', piso:  4, sala: 'L.D'      }   ← 4 trozos
E441.5. LAB INF → { edificio: 'E441', piso:  5, sala: 'LAB INF'  }   ← espacio inicial
E278B.4.S402    → { edificio: 'E278B', piso: 4, sala: 'S402'     }   ← edificio con letra
```

Reglas que hay que respetar sí o sí:

- **Partir por los dos primeros puntos, no por todos.** `place.split('.')` da
  cuatro trozos en `E441.4.L.D` y tira el laboratorio a la basura. Son 33
  registros del corte actual.
- **Recortar espacios en la sala.** `E441.5. LAB INF` viene con un espacio
  después del punto, y `Lab  Informática` del listado estático viene con dos
  espacios en medio. Cualquier comparación tiene que normalizar espacios y
  mayúsculas antes de cruzar.
- **El piso puede ser negativo, y nunca es 0.** Coincide con la regla de la base
  (`check (level <> 0)` en `building_floors`, ver `docs/DATABASE.md` §4): la
  planta baja es el `1`. En los datos hay `-1`, `-2` y `-3`.
- **El edificio no es solo letra + número.** Hay sufijos de cuerpo:
  `E278A`, `E278B`, `M253A`, `M253B`, `M253C`. La letra final distingue
  **cuerpos distintos de un mismo predio**, y eso importa en el mapa: son
  edificios separados con entradas separadas.

### Los prefijos de sala

| Prefijo | Qué es | Ejemplos |
|---|---|---|
| `S` | Sala de clases común | `S401`, `S312`, `S101` |
| `L` | Laboratorio | `L601`, `L202`, `L.D`, `L.O`, `L.U` |
| `LAB …` | Laboratorio con nombre propio | `LAB INF` (Informática), `LAB TEL` (Telemática) |
| `AU` | **Auditorio** | `E441.-1.AU`, `V432.3.AU` |
| `SIM` | Laboratorio de simulación / computadores | `V432.-1.SIM` |
| `LOC` | Sin identificar. Aparece en el listado viejo, sin clases hoy | `V432.-1.LOC` |
| `E50` | Sin identificar. Listado viejo, `E441` piso 5 | — |

Dos de esos merecen explicación, porque el nombre no lo dice:

- **`AU` es "auditorio", no "aula".** `E441.-1.AU` es el auditorio subterráneo de
  la FIC —el de ~150 personas que describe la propia facultad—, y ahí se dictan
  los ramos masivos de Industrial (Contabilidad y Costos, Ingeniería Económica,
  Estática). `V432.3.AU` es el otro, en el edificio de Vergara.
- **`SIM` es una sala de computadores, no una sala de simulación clínica.** Lo
  que se dicta ahí lo delata: Econometría, Simulación, Análisis de la
  Información Empresarial, Desarrollo Web y Móvil. Es el laboratorio del
  subterráneo de Vergara 432.

### Los tres laboratorios `L.D` / `L.O` / `L.U`, piso 4 de E441

Confirmado: **`L` es "laboratorio" y la letra es el nombre del laboratorio.**
`E441.4.L.D` se lee "**Laboratorio D, piso 4 de la FIC**". Son tres laboratorios
de computación contiguos donde se dictan Bases de Datos, Estructuras de Datos,
Desarrollo Web, Talleres de Redes y Data Science. En el listado viejo del
repositorio aparecen como `"L D"`, `"L O"`, `"L U"` y también como `"LAB D"`,
`"LAB O"`, `"LAB U"` — tres grafías para las mismas tres salas, que es
exactamente por qué hay que normalizar antes de cruzar.

Y en el **piso 5** están los dos laboratorios con nombre: `LAB INF` es
literalmente el **Laboratorio de Informática** y `LAB TEL` el **Laboratorio de
Telemática** (`Lab  Informática` / `Lab  Telemática` en el listado viejo, con dos
espacios en medio).

### Bloques horarios

Siete bloques fijos, de lunes (`day: 1`) a viernes (`day: 5`):

| Bloque | Inicio | Término |
|---|---|---|
| 1 | 8:30 | 9:50 |
| 2 | 10:00 | 11:20 |
| 3 | 11:30 | 12:50 |
| 4 | 13:00 | 14:20 |
| 5 | 14:30 | 15:50 |
| 6 | 16:00 | 17:20 |
| 7 | 17:25 | 18:45 |

Ojo con `"8:30:00"`: viene **sin cero a la izquierda**, así que no es un `HH:MM:SS`
ordenable como texto. Hay que parsearlo.

---

## 3. El prefijo del edificio **es** la dirección postal

Esto es lo que faltaba tener escrito, y es la pieza que hace útil todo lo demás:
el código de sala no lleva el nombre de la facultad, lleva **la calle y el
número**. `E` = Av. Ejército Libertador, `V` = Vergara, `M` = Av. Manuel
Rodríguez Sur. El número es el número de la calle.

Por eso "¿de qué facultad es esta sala?" no se responde con el catálogo de
facultades: se responde con **un mapa de direcciones**. Y por eso hasta ahora se
resolvía a ojo ("ah, Ejército 441 es la FIC").

| Prefijo | Dirección | Qué hay ahí | `faculty_id` | Confianza |
|---|---|---|---|---|
| `E441` | Av. Ejército Libertador 441 | Facultad de Ingeniería y Ciencias | `ingenieria` | **Confirmado** (udp.cl) |
| `V432` | Vergara 432 | Facultad de Ingeniería y Ciencias — **la otra entrada del mismo recinto** | `ingenieria` | **Confirmado** (udp.cl) |
| `E326` | Av. Ejército Libertador 326 | **Aulario UDP** — edificio de salas comunes a todas las facultades del eje Ejército | `aulario` | **Confirmado** (udp.cl) |
| `E333` | Av. Ejército Libertador 333 | Facultad de Ciencias Sociales e Historia | `ciencias-sociales` | **Confirmado** (udp.cl) |
| `E260` | Av. Ejército Libertador 260 | Instituto de Filosofía | `filosofia` | **Confirmado** (udp.cl) |
| `E233` | Av. Ejército Libertador 233 | Facultad de Salud y Odontología / Medicina | `salud` | **Confirmado** (udp.cl) |
| `M253A/B/C` | Av. Manuel Rodríguez Sur 253, **edificios A, B y C** | Facultad de Salud y Odontología (decanato y direcciones de escuela) | `salud` | **Confirmado** (udp.cl + terreno) |
| `V275` | Vergara 275 | Facultad de Psicología | `psicologia` | **Confirmado** (udp.cl) |
| `E306` | Av. Ejército Libertador 306 | **Facultad de Comercio**, justo al lado del Aulario | `comercio` | **Confirmado** (terreno) |
| `E278A` / `E278B` | Av. Ejército Libertador 278, edificios A y B | Salas "ED"/"EC"; el ICSO ocupa el edificio B, piso 2 | `ciencias-sociales` | **Probable** — hay que verlo en terreno |
| `V210` | Vergara 210 | Facultad de Educación (su "Sala de Ciencias" está aquí) | `educacion` | **Probable** |

Dos cosas que la tabla dice de pasada y conviene no perder:

- **La letra final del edificio es literal.** `M253A`, `M253B` y `M253C` son los
  edificios **A**, **B** y **C** de Salud y Odontología: así se llaman en la
  facultad, no es una invención del sistema de salas. Lo mismo para `E278A` y
  `E278B`. Son edificios distintos, con entradas distintas, y en el mapa van
  como edificios separados.
- **`E306` era el único hueco y ya está cerrado:** es la Facultad de Comercio,
  vecina del Aulario. Es además el edificio con **más salas de todo el
  conjunto** (17), lo que encaja: ahí se dictan los ramos de plan común que la
  FIC no alcanza a meter en sus dos edificios.

---

## 4. Una facultad tiene varias direcciones. Ese es el punto.

De lo anterior se sigue la regla que hay que grabarse:

> **La relación entre facultad y dirección es uno-a-muchos, y la FIC ni siquiera
> ocupa solo sus propias direcciones.**

Dos cosas distintas se cruzan aquí y conviene no confundirlas:

1. **Una facultad ocupa varios predios y tiene varias entradas.** La FIC es un
   solo recinto con acceso por Av. Ejército 441 **y** por Vergara 432 — no son
   dos facultades, son dos puertas. Salud y Odontología ocupa cuatro
   direcciones. La Biblioteca Nicanor Parra tiene puerta por Vergara y puerta
   por Ejército.
2. **Los ramos de una facultad se dictan en edificios de otras.** Es exactamente
   lo que se ve en los datos: ramos de la FIC en `E278A` (Ciencias Sociales), en
   `E326` (Aulario), en `M253A` (Salud y Odontología), en `E306`. **Un pin de
   sala pertenece al edificio donde está, no a la facultad que la usa esa hora.**
   La facultad del pin es la del predio; el ramo es un dato del horario.

Confundir las dos hace que la sala aparezca en el sitio equivocado del mapa, que
es justo lo que el módulo tiene que evitar.

### Direcciones y entradas por facultad

Fuentes: udp.cl (oficial) y OpenStreetMap (marcado como tal). Lo que dice OSM
**no es oficial** y hay que confirmarlo en terreno antes de usarlo para trazar un
perímetro.

| `faculty_id` | Facultad / recinto | Direcciones y entradas | Fuente |
|---|---|---|---|
| `ingenieria` | Ingeniería y Ciencias (FIC) | **Av. Ejército Libertador 441** (principal) · **Vergara 432** | udp.cl |
| `salud` | Salud y Odontología | **Av. Manuel Rodríguez Sur 253** (decanato) · **Av. Ejército 233** · **Av. Ejército 219** (clínica odontológica) · **Av. Ejército 141** | udp.cl |
| `medicina` | Medicina | **Av. Ejército 233** (comparte predio con Odontología) | udp.cl / OSM |
| `psicologia` | Psicología | **Vergara 275** | udp.cl |
| `ciencias-sociales` | Ciencias Sociales e Historia | **Av. Ejército 333** · **Av. Ejército 278** edificios A y B (ICSO en el B, piso 2) | udp.cl |
| `filosofia` | Instituto de Filosofía | **Av. Ejército 260** | udp.cl |
| `educacion` | Educación | **Vergara 210** | udp.cl (infraestructura) |
| `comunicacion` | Comunicación y Letras | **Vergara 240** | OSM |
| `biblioteca` | Biblioteca Nicanor Parra | **Vergara 324** (oficial) · **una segunda entrada por Av. Ejército, número por confirmar** | udp.cl + terreno |
| `aulario` | Aulario UDP | **Av. Ejército 326** | udp.cl |
| `comercio` | Comercio | **Av. Ejército Libertador 306** | terreno |
| `derecho` | Derecho | **Av. República 105** | udp.cl |
| `arquitectura` | Arquitectura, Arte y Diseño | **Av. República 180** · Salvador Sanfuentes 2221 | OSM |
| `economia` | Economía y Empresa | **Av. Santa Clara 797**, Ciudad Empresarial, Huechuraba | udp.cl |
| — | Casa Central | **Av. Ejército Libertador 412** | OSM |

**Lo que falta por confirmar en terreno**, en orden de lo que más estorba:

1. El número por Ejército de la Biblioteca Nicanor Parra.
2. Si `E278A`/`E278B` son de Ciencias Sociales o son salas comunes como el
   Aulario. Que en `E278A` se dicten Cálculo, Álgebra Lineal e Introducción a la
   Ingeniería —ramos de plan común de la FIC— hace sospechar lo segundo.
3. Los números de Ejército 219 y 141 de Salud y Odontología: udp.cl los lista,
   pero en los datos de salas no aparece ninguno.

### Las 8 facultades que hacen falta ya existen

Comprobado contra `src/shared/data/campusData.ts` el 2026-08-10: los 12
edificios del catálogo caen sobre **ocho** facultades, y **las ocho están en el
catálogo**. No hay que crear ninguna.

| Facultad | `faculty_id` | Sus edificios |
|---|---|---|
| Ingeniería y Ciencias | `ingenieria` | `E441`, `V432` |
| Comercio | `comercio` | `E306` |
| Aulario UDP | `aulario` | `E326` |
| Ciencias Sociales e Historia | `ciencias-sociales` | `E333`, `E278A`, `E278B` |
| Salud y Odontología | `salud` | `M253A`, `M253B`, `M253C`, `E233` |
| Instituto de Filosofía | `filosofia` | `E260` |
| Psicología | `psicologia` | `V275` |
| Educación | `educacion` | `V210` |

Lo que sí falta es lo de abajo: **los edificios y sus plantas**, que no salen del
catálogo de facultades sino de `buildings` / `building_floors`, y se trazan a
mano en `/admin/mapeo`.

---

## 5. El catálogo de salas

### 5.1 Salas con clase en el corte del 2026-08-26

**82 salas en 11 edificios.** Entre paréntesis, cuántos bloques semanales ocupa.
Un número alto es señal de sala grande y muy usada; un `1` es señal de sala que
casi no se usa —o de un dato mal cargado.

Este listado **no se mantiene a mano**: sale de correr la receta de la §7. Si
alguna vez discrepa del archivo, manda el archivo.

| Edificio | Piso | Salas |
|---|---|---|
| E278A | 4 | S402 (25), S403 (22), S404 (2) |
| E278B | 4 | S402 (6), S403 (1) |
| E306 | 1 | S101 (18), S102 (3), S103 (5), S104 (4), S107 (24), S108 (5) |
| E306 | 2 | L201 (1), L202 (7), L203 (5), S204 (23), S205 (4), S206 (3), S207 (2), S208 (24), S210 (2), S212 (5) |
| E306 | 3 | S307 (7), S310 (1) |
| E326 | 2 | S202 (1), S203 (1), S204 (1) |
| E326 | 3 | S303 (1), S304 (2) |
| E333 | −3 | S301 (3) |
| E333 | 2 | L201 (1) |
| E333 | 3 | L301 (1) |
| E333 | 5 | S502 (1) |
| E333 | 6 | S601 (2) |
| E441 | −1 | **AU** (14) — auditorio |
| E441 | 1 | S101 (30), S102 (10), S105 (15), S106 (34) |
| E441 | 2 | S201 (31), S203 (7), S204 (25), S205 (29), S206 (32), S207 (29) |
| E441 | 3 | S302 (28), S303 (30), S304 (29) |
| E441 | 4 | L.D (21), L.O (11), L.U (22), S401 (24), S402 (27), S403 (31) |
| E441 | 5 | EE50 (3), LAB INF (15), LAB TEL (20) |
| M253A | 3 | S308 (1) |
| M253A | 5 | S503 (4) |
| M253A | 6 | L601 (27), L602 (27), L603 (25) |
| M253B | 4 | S402 (1) |
| V210 | 2 | L201 (7) |
| V275 | 1 | S107 (1) |
| V275 | 2 | S202 (1) |
| V275 | 3 | L301 (1) |
| V432 | −1 | ERP (3), **FIS** (147) — ver abajo, **SIM** (23) — laboratorio de computadores |
| V432 | 3 | **AU** (19) — auditorio, S312 (34), S313 (32), S314 (14), S315 (21) |
| V432 | 4 | S412 (30), S413 (29), S414 (19), S415 (20) |
| V432 | 5 | S512 (1), S513 (29), S514 (22), S515 (26) |

**Tres cosas de este corte que no estaban en el anterior:**

- **`V432.-1.FIS` con 147 bloques** es un valor atípico enorme: la siguiente
  más ocupada tiene 34. Con siete bloques al día y cinco días, el techo de una
  sala son 35. **147 no cabe en una semana**, así que o son secciones apiladas
  en el mismo bloque —un laboratorio con varios grupos a la vez— o es un dato
  cargado mal. No se puede usar para decir "esta sala está ocupada" sin
  entenderlo primero.
- **`E333.-3.S301`**: una sala numerada como del piso 3 declarada en el −3. El
  número de sala y la planta del código **no tienen por qué coincidir**, y aquí
  se contradicen. Antes de mapearla hay que ir a mirar.
- **Aparecen `E333`, `V210`, `V275` y `M253B`**, que en el corte anterior solo
  estaban en el listado estático de la §5.2. Su presencia aquí confirma que
  existen; no dice cuántas salas más tienen.

### 5.2 Salas que existen pero hoy no tienen clase de la FIC

Salen del listado estático del repositorio `salas-vacias` (`allRooms.json`), que
es de un semestre anterior. **Que no aparezcan arriba no significa que no
existan**: significa que este semestre la FIC no las ocupa. Son útiles para dos
cosas: saber que la sala existe antes de ir a mapearla, y saber que el edificio
tiene ese piso.

| Edificio | Piso | Salas |
|---|---|---|
| E233 | −2 | S200 |
| E260 | 1 | S101 |
| E326 | 2, 4 | S204, S403 |
| E333 | −3 | S302 |
| E441 | 2, 4, 5 | S202, LAB D / LAB O / LAB U *(los mismos `L.D`/`L.O`/`L.U`)*, E50 |
| M253A | 5, 6 | S502, L604 |
| M253B | 4 | S401, S402, S403, S404 |
| M253C | 2 | S202 |
| V210 | 2 | S202, L201 |
| V275 | −1, 2, 3 | L10, S203, L301 |
| V432 | −1 | LOC |

### 5.3 Qué NO se puede inferir de aquí

- **La numeración no es densa.** En `E441` piso 1 hay S101, S102, S105 y S106;
  no hay S103 ni S104. En `E306` piso 2 hay S204…S212 salteadas. **No se
  autocompleta el hueco**: puede ser una oficina, un baño o una bodega. Inventar
  una S103 mete un pin en un lugar que no es una sala.
- **La capacidad no está en ningún lado.** El conteo de bloques la insinúa
  (`E441.4.S403` con 25 bloques es claramente grande) pero no la dice. El
  ROADMAP §14 ya anota "capacidad de sala" como campo futuro; se llenará a mano.
- **Los pisos que aparecen aquí no son todos los pisos del edificio.** Son los
  pisos que tienen sala docente. `E441` tiene planta 1 a 5 y un −1, pero eso no
  dice si hay un −2.

### 5.4 Qué cubre el horario, y qué no

Sí: **están los cinco días, de lunes a viernes**, con los siete bloques. Pero la
cobertura no es pareja, y las dos rarezas hay que conocerlas antes de escribir
"esta sala está libre".

**El miércoles está casi vacío, y es de verdad.**

| Día | Bloques ocupados |
|---|---|
| Lunes | 222 |
| Martes | 194 |
| **Miércoles** | **18** |
| Jueves | 227 |
| Viernes | 138 |

No es un dato perdido: es cómo está armada la malla. Las secciones se dictan
emparejadas **lunes–jueves** (151 secciones) o **martes–viernes** (114), y el
miércoles queda reservado. Los 18 registros que sí hay son casi todos secciones
de laboratorio de `LAB INF` y `LAB TEL`.

Anotado el 2026-08-10: **el miércoles se va a llenar cuando partan las
ayudantías y los laboratorios**, que a esta altura del semestre todavía no
empiezan. O sea que este corte es un piso, no un techo — cuando llegue el corte
con ayudantías hay que rehacer la §5.1, y las salas que hoy figuran con pocos
bloques pueden subir bastante.

**Y solo se ven los ramos de la FIC.** Esto es lo que de verdad limita "sala
libre":

- **25 de las 61 salas (41 %) están en edificios que no son de la FIC** —
  `E306` (17), `M253A` (4), `E278A` (2), `E278B` (1), `E326` (1).
- El **27 % de los bloques semanales** de la FIC se dictan fuera de sus dos
  edificios.

En `E441` y `V432` "no aparece en el horario" ≈ "está libre", porque son de la
FIC y casi todo lo que pasa ahí es de la FIC. **En las otras 25 salas esa
inferencia es falsa**: una sala de Comercio en `E306` puede estar ocupada por un
ramo de Comercio que este archivo no ve, y la marcaríamos verde con gente
dentro. Para esas salas el archivo sirve para decir "**ocupada**", nunca para
decir "libre".

---

## 6. Cómo lo resolvieron en `salas-vacias`

Leído el código el 2026-08-10, porque la pregunta era si la idea sirve. **La
idea sirve y es la correcta; la implementación tiene fugas que nosotros no
podemos heredar.**

La idea, en una línea: **"vacías = todas las salas menos las que el horario dice
que están ocupadas ahora"**. Se parte de una lista estática de todas las salas
del edificio (`app/utils/buildings.json`), se filtra el horario al día y bloque
actuales, y cada sala ocupada se **borra** de la lista. Lo que queda, se pinta.

```ts
// app/utils/filters.ts, resumido
const buildingRooms = clonar(allRoomsJSON[buildingKey])   // todas las salas
rooms = filterByBlock(block, rooms)                       // las ocupadas ahora
rooms.forEach(c => buildingRooms[c.room.floor].splice(idx, 1))  // resta
return buildingRooms                                      // las libres
```

Es simple y es honesto: no inventa salas, parte de un listado real. **Ese
listado es justamente lo que le sacamos al repositorio** (§5.2).

### Dónde se rompe

Todo lo de abajo es consecuencia de una sola decisión: **que "libre" sea el
valor por defecto**. Si algo no calza, la sala queda en la lista y se pinta como
libre. El error siempre cae del lado peligroso.

1. **Los laboratorios del piso 5 nunca se marcan ocupados.** El horario trae
   `E441.5. LAB INF` (con espacio) y el listado estático dice
   `"Lab  Informática"` (con dos espacios). No calzan, no se restan: `LAB INF` y
   `LAB TEL` salen **siempre verdes**, tengan clase o no. Y `Lab  Telemática` ni
   siquiera está en `buildings.json` para el piso 5 de `E441`.
2. **El listado estático es de otro semestre y está clavado en el repositorio.**
   Sala que se inaugure o se cierre, no se entera. Es el mismo problema que
   tuvimos con `facultyPerimeters.ts`: dos contenedores que hay que mantener a
   la par, y uno se queda atrás sin que nadie lo vea.
3. **El parseo del código adivina.** `convertToRoomType` hace `split(".")` y
   decide por la cantidad de trozos: si son 2, **asume** `E441` piso 5; si es 1,
   asume `V32` piso −1 — y `V32` es un typo de `V432`, así que ese caso no calza
   con nada nunca.
4. **Fuera de horario dice cualquier cosa.** `convertHourToBlock` hace
   `return 1` cuando la hora no cae en ningún bloque, así que a las 22:00 la app
   contesta con la ocupación del bloque de las 8:30. Y `filterByBlock` usa
   `new Date().getDay()`, que el fin de semana vale 6 o 0: no coincide con
   ningún día del horario, no se resta nada, **todo el edificio sale libre**.
5. **Solo funciona para `E441` y `V432`.** Lo dice su propio comentario. Con
   cualquier otro edificio, `allRooms[buildingKey]` es `undefined` y revienta.

### Qué nos llevamos y qué no

**Nos llevamos la idea**: restar lo ocupado de un listado completo. Y nos
llevamos su `buildings.json`, ya extraído en la §5.2.

**No nos llevamos el mecanismo**, y no por prolijidad: es que nuestro caso es
más exigente que el suyo. Ellos pintan una grilla de dos edificios de la FIC;
nosotros pintamos pines georreferenciados en doce edificios de ocho facultades,
donde —por la §5.4— "no aparece en el horario" **no** significa libre. Con
nuestro modelo, además, el listado completo de salas no es un JSON clavado: son
los pines `sala` de la base, que es justo el contenedor que no se queda atrás.

Tres reglas para cuando toque implementarlo:

- **El valor por defecto es "no sé", no "libre".** Tres estados —ocupada, libre,
  sin datos— y las 25 salas fuera de la FIC viven en "sin datos" mientras no
  haya una fuente que las cubra.
- **Normalizar antes de cruzar**: `trim()`, colapsar espacios, mayúsculas. Es lo
  que se les escapó con `LAB INF`.
- **Fuera de bloque y fin de semana no se responde "libre"**, se responde "sin
  clases programadas", que es distinto y es lo que de verdad se sabe.

---

## 7. Cómo volver a derivar todo esto

El corte de arriba es del 2026-08-10 y **caduca cada semestre**. Para rehacerlo
sin depender de que alguien lo haga a mano:

```bash
curl -s https://salas.docencia-eit.cl/data.json -o salas.json
```

Y para el catálogo por edificio y piso:

```bash
node -e 'const r=require("./salas.json").data.allSalasUdps.edges.map(e=>e.node),m={};for(const x of r){const i=x.place.indexOf("."),b=x.place.slice(0,i),t=x.place.slice(i+1),j=t.indexOf("."),f=t.slice(0,j),s=t.slice(j+1).trim();((m[b]??={})[f]??={})[s]=(m[b][f][s]||0)+1}console.log(JSON.stringify(m,null,1))'
```

Fíjate en el `indexOf(".")` doble y el `.trim()`: es la regla de la §2, y es todo
lo que separa un catálogo correcto de uno que pierde los tres laboratorios.

**Desde el 2026-08-26 esa regla vive en el repositorio y no solo en esta línea
de shell:** `shared/utils/roomCatalog.ts` (`buildRoomCatalog`) hace lo mismo con
pruebas, y `features/mapping/salasEit.ts` es quien descarga el archivo. Si hay
que tocar la regla, se toca ahí; el comando de arriba queda para mirar el
catálogo desde la terminal sin abrir la aplicación.

Y un aviso que costó encontrar: `parseRoomCode` exigía que el prefijo del
edificio terminara en dígito, así que **`E278A`, `E278B`, `M253A` y `M253B` no
parseaban** y sus once salas se quedaban sin planta. Son direcciones con dos
entradas en el mismo número (§3), no erratas.

---

## 8. Cómo esto se convierte en pines

El modelo ya lo soporta entero, sin migración. Un pin de sala usa:

| Columna de `pins` | Qué va |
|---|---|
| `category_id` | `'sala'` — la sala como **lugar**. No confundir con `'sala-libre'`, que es el aviso efímero de que hay una libre ahora |
| `room_code` | El código completo, tal cual: `'E441.4.S403'` |
| `floor` | El piso del código: `4` |
| `faculty_id` | La facultad **del predio** (§4), no la del ramo |
| `lat` / `lng` | A mano, sobre el mapa |
| `is_permanent` | Ver abajo |

Y hay dos cosas del ciclo de vida que hay que tener presentes antes de cargar
nada (`docs/DATABASE.md` §3 y §4):

- **La categoría `sala` nace con TTL de 720 horas (30 días)** y deja de expirar
  al verificarse. Un pin de sala cargado a mano y no verificado **se borra solo
  en un mes**.
- **`trg_validate_pin_floor` rechaza pisos que no existan** en
  `building_floors` de la facultad. Si vas a cargar salas del piso 6 de `M253A`,
  ese piso tiene que estar declarado antes en el editor de mapeo, o el `INSERT`
  falla. Falla a propósito: un pin en una planta que nadie declaró es un pin
  **invisible** (ROADMAP §15).

### El orden de carga

Ya no hay nada bloqueando: las ocho facultades existen (§4) y los doce edificios
tienen dirección. Lo que queda es trabajo, y el orden importa porque cada paso
depende del anterior.

1. **Declarar el edificio y sus plantas en `/admin/mapeo`.** Sin esto el
   `INSERT` de sus salas **falla**, por `trg_validate_pin_floor`. No es un
   estorbo, es la red: un pin en una planta que nadie declaró es un pin
   invisible (ROADMAP §15). Las plantas de cada edificio salen de la §5.1 y la
   §5.2 — para `E441`, por ejemplo, son −1, 1, 2, 3, 4 y 5.
2. **Cargar las salas de ese edificio**, con las coordenadas puestas encima del
   plano.
3. **Pasar al siguiente edificio.**

Por dónde empezar, por lo que más rinde:

| Orden | Edificio | Salas | Por qué |
|---|---|---|---|
| 1.º | `E441` | 22 | El más grande, ya trazado en el mapa, y es "tu" facultad |
| 2.º | `V432` | 14 | Ya trazado, completa la FIC — con los dos, 36 de 61 |
| 3.º | `E306` | 17 | El segundo con más salas, y con él quedan 53 de 61 |
| 4.º | `M253A`, `E278A/B`, `E326` | 8 | La cola, edificio por edificio |

### Por qué no hay un seed generado

Se podría escribir el `INSERT` de las 61 salas ahora mismo. **No conviene**, y la
razón es una sola pero decisiva: **las coordenadas serían inventadas**. Las 61
caerían apiladas en el centroide de su edificio, y después habría que arrastrar
una por una — más trabajo que crearlas donde van, y con el riesgo de que alguna
se quede sin mover y apunte a un sitio falso. El mapeo interior existe
justamente para no hacer eso.

Lo que sí se puede generar sin mentir es el **esqueleto**: código, piso,
facultad y título, con las coordenadas en blanco, para ir rellenando. Eso es una
tarea de carga, no de documentación, y sale de las tablas de la §5.1 con el
comando de la §7.

Cuando toque cargar, el `INSERT` va con `creator_id =
'9ea3f0ad-f7ed-4d42-bdd0-ce3284453112'`, igual que
`supabase/seed/fic_dummy_50_pins.sql`.

---

## 9. Lo que este documento deja decidido

- El código de sala se parte por **los dos primeros puntos**, y la sala se
  recorta de espacios. `E441.4.L.D` ("Laboratorio D, piso 4") y
  `E441.5. LAB INF` son los casos que rompen cualquier otra regla, y existen.
- El prefijo del edificio **es una dirección postal**, no un nombre de facultad.
  La tabla de la §3 es la traducción, y vive aquí — no repartida por el código.
  La letra final (`M253A`, `E278B`) es el nombre real del edificio.
- **Una facultad tiene varias direcciones**, y **una sala pertenece al edificio,
  no al ramo que la ocupa**. Los ramos de la FIC se dictan en cinco edificios que
  no son de la FIC.
- **Las ocho facultades que hacen falta ya existen** en el catálogo. Lo que falta
  son los edificios y sus plantas, y eso se traza a mano.
- El horario lo publica la **facultad**, no los estudiantes: es el volcado de una
  consulta GraphQL a `public/data.json`. Lo que falta no es acceso técnico —CORS
  está abierto— sino hablar con quien lo mantiene.
- **"No aparece en el horario" no significa "libre"** en 25 de las 61 salas. El
  valor por defecto de una sala sin datos es "no sé", nunca verde.

---

## 10. Qué lógica de sala existe HOY

Comprobado contra el código el 2026-08-10, porque la pregunta salió y la
respuesta honesta es **casi ninguna**. Lo que hay:

| Qué | Dónde |
|---|---|
| La categoría `sala`, con `ttl_hours: 720` — distinta de `sala-libre`, que son 6 h | `campusData.ts:173` |
| El campo de código de sala, que **solo aparece si la categoría es `sala`** (`isRoom`) | `IndoorFields.tsx:144`, `CreatePinModal.tsx:771` |
| `pins.room_code`, que el autor puede editar con un `UPDATE` directo | `api.ts:419-434` |
| El chip con el código en la ficha del pin | `PinDetail.tsx:220` |
| La validación de planta en servidor | `trg_validate_pin_floor` (ROADMAP §15) |

**Lo que se añadió el 2026-08-26** y que esta sección daba por inexistente:

| Qué | Dónde |
|---|---|
| `parseRoomCode`: `E441.4.S403` → edificio, planta y sala | `shared/utils/roomCode.ts` |
| El catálogo derivado del horario, con sus pruebas | `shared/utils/roomCatalog.ts` |
| La descarga del `data.json`, que nunca lanza | `features/mapping/salasEit.ts` |
| El importador de `/admin/mapeo` (§12.7 punto 3) | `features/mapping/RoomImportPanel.tsx` |
| Las salas se dibujan más pequeñas que los avisos (22 px contra 26) | `isFixedInfraCategory`, `styles/index.css` |

**Lo que sigue sin existir:**

- **La etiqueta con el código al lado del marcador** a zoom alto (ROADMAP §9.2).
  El tamaño ya distingue; el código todavía hay que abrir el pin para verlo.
- **Nada cruza con horarios en el mapa del estudiante.** El `data.json` se lee
  **solo** en el editor de administración. La capa de "libre / ocupada" es la
  §11.4 punto 4 y no está.
- **No hay flujo de sugerencia de sala** (§12.5): un estudiante puede crear un
  pin `sala`, pero no entra a ninguna cola ni recibe respuesta.

**Y la trampa sigue en pie, ahora con más salas:** la categoría `sala` nace con
**TTL de 30 días**. Una sala cargada y no verificada por un moderador **se borra
sola** — y eso incluye las que coloque el importador, que crea pines normales,
no permanentes. Si se cargan las 82 y no se verifican, en un mes no queda
ninguna.

---

## 11. Recomendación: la sala es el lugar, el horario es una capa

Anotado el 2026-08-10 a partir de la conversación sobre a dónde llevar esto.

**La idea de fondo es correcta y conviene decirla en una línea:** salas EIT
contesta *"¿está ocupada?"*; UDP Map puede contestar *"¿qué es esta sala, cómo
llego, cómo es por dentro y qué dice la gente de ella?"*. Son preguntas
distintas, y la segunda no la responde nadie hoy.

De ahí salen tres decisiones que conviene tomar ahora, porque condicionan el
modelo:

### 11.1 No competir con salas EIT: colgarse

Ellos tienen el dato; nosotros tenemos el mapa, la ubicación exacta, las fotos y
la gente que comenta. **El pin `sala` es la entidad estable** —existe con o sin
horario— y el horario es una **capa encima**. Si el `data.json` cambia de forma o
muere, la sala sigue en el mapa con su foto y sus comentarios; solo se apaga el
chip de "ocupada". Es la única forma de que una dependencia externa no se lleve
por delante lo que construimos.

### 11.2 El horario NO se guarda en la base

Tentación evidente: meter los bloques en `pin_schedule_items` y listo. **No.**

Esa tabla es para el **programa de un evento**, que alguien escribe a mano y no
existe en ningún otro sitio. El horario académico es lo contrario: dato
**derivado** de una fuente externa que se republica sola. Copiarlo a la base
crea dos contenedores que hay que mantener a la par — que es exactamente el error
de `facultyPerimeters.ts`, y allí la copia mala estuvo mala meses sin que nadie
lo notara (`docs/DATABASE.md` §4).

Lo que sí: **leer, cachear y derivar**. El archivo trae `ETag` y
`Last-Modified`, así que revalidar es barato, y con los 799 registros en memoria
se calcula todo lo que hace falta:

- si la sala está ocupada **ahora**,
- **hasta qué hora** y qué ramo,
- y la **tira de los 7 bloques del día**, que es justo lo que pedías: "esta sala
  está ocupada en el bloque 1, 3 y 5". No hay que guardarlo — se infiere de la
  misma data, y de la data fresca, no de una copia de hace un mes.

### 11.3 Tres estados, y "no sé" es uno de ellos

Es la conclusión de la §5.4 y de los errores de la §6, y hay que grabarla en el
modelo desde el principio:

| Estado | Cuándo | Cómo se ve |
|---|---|---|
| **Ocupada** | El horario dice que hay clase ahora | Chip con el ramo y hasta qué hora |
| **Libre** | Es sala de `E441` o `V432`, dentro de horario, y no aparece | Verde |
| **Sin datos** | Las otras 25 salas, o fin de semana, o fuera de bloque | Sin chip. **No verde** |

Un verde falso es peor que no decir nada: alguien camina hasta el quinto piso
para encontrar una clase dentro. `sala-libre` (el aviso humano, TTL 6 h) sigue
teniendo sentido justo ahí — en las salas donde no hay datos, una persona sí
puede avisar.

### 11.4 Lo que hay que construir, en orden

1. - [x] **`parseRoomCode`** con la regla de la §2. Función pura en
     `shared/utils/`, testeable y sin dependencias. Hecha, y corregida el
     2026-08-26 para los prefijos con sufijo de letra (§7).
2. - [ ] **Cargar las salas** (§8). Sin pines no hay nada contra qué cruzar. **Y
     verificarlas**, o el TTL de 30 días se las lleva. **El importador del
     editor ya está** (§12.7 punto 3): pone el código y la planta, y quien mapea
     pone el punto. Lo que falta es pasar por los edificios.
3. - [x] **Dibujarlas distinto** (ROADMAP §9.2, Fase 4). Hecho el 2026-08-26: la
     infraestructura fija se dibuja a 22 px y los avisos a 26. Solo el tamaño,
     nunca el tono.
4. **La capa de horario**, con los tres estados de arriba.
5. **Recién ahí, hablar con la universidad.** Con las salas cargadas y la capa
   funcionando, la conversación deja de ser "¿nos dan datos?" y pasa a ser "esto
   ya funciona, ¿lo hacemos oficial?". Es una posición mucho mejor, y de paso
   para entonces ya sabremos —por la §1— quién mantiene el archivo.

---

## 12. ¿La sala es un área o un pin? — resuelto

Planteado y **cerrado el 2026-08-10**. Se deja el razonamiento entero porque la
decisión no es obvia y el que la lea en un año va a querer saber por qué.

> **La decisión, en una línea: la sala se guarda y se usa como un pin —la misma
> ficha, sin excepciones—, y se DIBUJA como área en cuanto alguien le trace el
> polígono. Tocar el área abre el front del pin.**

El detalle del flujo está en la §12.5. Lo de arriba es cómo se llegó ahí.

### El dilema, en dos frases

**Una sala es un área, no un punto.** Dibujarla como polígono con su código
encima es lo correcto: es su forma real, se lee como un plano, y una chincheta
en mitad de una sala de 60 m² dice algo que no es cierto.

**Pero las áreas las dibuja solo un moderador** (`areas_write`,
`baseline.sql:2589`). Y lo que se quería de UDP Map desde el principio es que
cualquiera llegue y diga *"oye, aquí falta una sala"*. Si la sala es un área, esa
persona no puede aportar nada, en ninguna facultad.

O sea: **lo que se ve mejor es lo que cierra la puerta a la comunidad.**

### Lo que cada camino cuesta de verdad

Medido contra el esquema, no contra la intuición.

| | **A. Solo área** | **B. Solo pin** (hoy) | **C. Área + ficha** |
|---|---|---|---|
| Forma real en el plano | ✅ | ❌ chincheta | ✅ |
| Etiqueta con el código en el mapa | ✅ | ⚠️ solo al lado del marcador | ✅ |
| Cualquiera puede aportar una sala | ❌ **nunca** | ✅ | ✅ donde no hay polígono |
| Fotos | ✅ `place_photos.area_id` ya existe | ✅ | ✅ |
| **Comentarios** | ❌ **hay que construirlos** | ✅ | ✅ |
| **Votos, favoritos, karma, denuncias** | ❌ **hay que construirlos** | ✅ | ✅ |
| Autor y verificación | ❌ un área no tiene autor | ✅ | ✅ |
| Migración necesaria | **grande** | ninguna | ninguna |

El costo escondido del camino A es el que decide: **un área no tiene autor.** No
es que le falten comentarios y ya — le falta toda la capa social, que en los
pines existe entera y probada: `pin_comments`, `pin_votes`, `favorites`,
`content_reports`, `adjust_karma`, las notificaciones. Rehacer eso para áreas es
duplicar media aplicación, y deja dos sistemas de moderación que hay que
mantener a la par. Es exactamente la clase de error que este repositorio ya
cometió con `facultyPerimeters.ts`.

### La salida (esto es lo que se decidió)

El dilema se disuelve si se separa **qué se guarda** de **qué se dibuja**, que
son dos preguntas distintas que estábamos contestando juntas.

- **El área es la forma.** La dibuja un moderador, lleva el nombre y el color.
- **El pin es la ficha.** Foto, comentarios, votos, autor. Y `pins.area_id`
  **ya se deduce solo** del punto (`baseline.sql:241`), así que se enlazan sin
  que nadie escriba nada.
- **Y una vez trazada el área, el área sustituye a la chincheta.** Se pinta el
  polígono con su código encima; se toca el polígono y **se abre exactamente la
  misma ficha del pin**: cómo llegar, favorito, comentarios, votos, fotos. No es
  una vista nueva ni una ficha parecida — es la misma.

Ahí está la clave de todo el asunto, y por eso costó decirla: **"que la sala se
vea como un pin" no significa que se dibuje como una chincheta, significa que se
comporte como un pin.** Lo que se dibuja es el área, que es su forma real; lo que
se abre es el front del pin, que es donde vive todo lo que la gente hace con
ella.

Hasta que alguien trace el área, la sala se dibuja como chincheta — porque es lo
único que hay. El polígono no cambia el objeto, cambia cómo se pinta.

Y la comunidad no queda fuera, porque el mismo mecanismo cubre los dos casos:

| Situación | Qué ve el estudiante | Qué puede hacer |
|---|---|---|
| Sala ya mapeada | El polígono con su código | Comentar, votar, subir foto |
| Sala que falta | Nada ahí | **Crear un pin `sala`** → queda de chincheta |
| Un moderador la dibuja después | El polígono | El `area_id` se enlaza solo, y quien la reportó gana **+25 de karma** |

Eso no es un flujo nuevo: es el ciclo **reporte → verificado** que la aplicación
ya tiene (`verify_pin`), aplicado a la geometría. **El pin es la propuesta; el
área es la forma verificada.** Y degrada bien: una facultad sin mapear igual
acumula salas de la comunidad como chinchetas, hasta que alguien las dibuje.

### Lo que falta para que ese camino funcione

Ninguna migración de datos, pero sí tres cosas:

1. **La regla de dibujo:** pin con `area_id` → se pinta el polígono con su
   código y **no** la chincheta; tocarlo abre la ficha del pin. Es lo que hoy no
   existe, y es lo que hace que 61 salas no se vean como 61 chinchetas
   amontonadas. Va con Fase 4 (§9.2), y para las salas **sin** área trazada
   sigue valiendo la regla de ahí: marcador más pequeño, **solo tamaño, nunca
   tono** — el desvanecido ya significa "por vencer".
2. **La etiqueta con el código** sobre el polígono, y al lado del marcador
   mientras no haya polígono. `pins.room_code` ya guarda el texto; falta
   pintarlo.
3. **La cola de sugerencias en administración**, que es lo único de verdad
   nuevo. ROADMAP §13.2.
4. **Cerrar "mover un pin" en el servidor**, que hoy es solo una comprobación de
   interfaz. Ver §12.5.

### La objeción del trabajo, que es la real

"Modelarlo como administrador lleva trabajo" es cierto, y no se arregla con
argumentos: 61 salas son 61 polígonos.

Lo que sí lo arregla es **que el editor proponga las salas**. `/admin/mapeo` lee
el `data.json` (§1), y para el edificio abierto ofrece las salas que faltan con
**código y planta ya rellenos** — el moderador solo dibuja el contorno. Ahí el
trabajo deja de ser "inventar 61 fichas" y pasa a ser "trazar 61 rectángulos
sobre un plano", que es otra cosa.

Y es también lo que hace defendible pedirle a la universidad —o a quien mantiene
`salas.docencia-eit.cl`— que esto se mantenga aquí: si mantenerlo significa
cargar salas a mano, es más pega que la que tienen hoy y nadie va a querer. Si
significa apretar "importar" y dibujar lo que falta, es una conversación
distinta.

### 12.5 El flujo acordado, de punta a punta

**Las dos reglas que mandan sobre el resto:**

1. **La ficha es siempre la del pin.** No hay una vista especial de sala, ni un
   componente aparte. Si alguien propone "una ficha propia para salas", la
   respuesta es no: es la misma, con sus comentarios, sus votos, su favorito y
   su "cómo llegar".
2. **Lo que se dibuja depende de si hay área.** Sin área trazada, chincheta. Con
   área trazada, **polígono con el código encima, y la chincheta desaparece**.
   Tocar el polígono abre la ficha del pin. El objeto no cambia; cambia cómo se
   pinta.

#### Del lado del estudiante

1. **Antes de publicar se le dice qué va a pasar.** Del tenor de: *"Esto se
   enviará a administración como sugerencia de sala. Quedarás como quien la
   añadió y ganarás karma si se acepta."* Más lo que la §10.5 del ROADMAP pide
   para toda la aplicación: cuánto dura, qué significa que la verifiquen.
2. **Confirma** — es una acción con consecuencias (entra a una cola, la va a
   revisar una persona), así que lleva confirmación explícita, no se publica de
   corrido.
3. **La sala vive desde el primer momento**: se ve en el mapa, se comenta, se
   vota. No nace escondida esperando aprobación. Es un pin normal que además
   está en una cola.
4. **Recibe respuesta.** Aceptada o rechazada, **con motivo**. Un rechazo mudo
   es la forma más rápida de que alguien no vuelva a aportar nunca.

#### Del lado de administración

Todo esto ocurre **dentro de `/admin/mapeo`**, no en una pantalla aparte: la
decisión necesita ver el plano.

1. **Una lista de "salas sugeridas pendientes"**, con las que caen en el
   edificio y la planta abiertos.
2. **Acomodar el pin** si está mal puesto. Es lo primero que se necesita: el
   estudiante marca de memoria y rara vez cae exacto.
3. **Aceptar o rechazar, con motivo**, que le llega a quien la sugirió.
4. **Al aceptar**: pasa a permanente (`verify_and_make_permanent` ya lo hace:
   `type='place'`, `expires_at = null`, **+25 de karma** al autor).
5. **Y entonces aparece "trazar el área"**, en el mismo sitio y en el mismo
   gesto. El área se crea ya asociada a la sala —su código, su nombre— y
   `pins.area_id` queda enlazado.
6. **Desde ese momento la sala se dibuja como polígono** con su código, y se
   abre como pin.

**Un hueco de seguridad que este flujo destapa:** *"mover un pin de sitio"*
**hoy solo se comprueba en la interfaz, no en la base** (`docs/DATABASE.md` §2,
es el único permiso en esa situación). El paso 2 lo convierte en una acción
central del flujo, así que hay que cerrarlo en el servidor antes de construirlo,
o cualquiera con la clave pública podrá reubicar pines ajenos.

**Lo que se descartó:** que el estudiante dibuje el polígono él mismo. Trazar
geometría sobre un plano es una herramienta de edición, no un gesto de aporte, y
abrirla a cualquiera convierte cada sugerencia en algo que hay que revisar trazo
a trazo. **La sugerencia es un punto; el trazo es curaduría.**

#### El plazo de la sugerencia

**No hay plazo fijo: la sugerencia espera hasta que alguien la resuelva.** Se
descartó el "24 horas y se decide sola" — una sala que se aprueba por
vencimiento del reloj es una sala que nadie miró, y el punto de la cola es justo
que alguien la mire.

Lo que sí caduca mientras tanto es el pin, por su TTL de categoría (30 días para
`sala`). O sea: hay un tope natural de un mes, y ese tope es el que obliga a que
la cola se atienda. Si una sugerencia se pierde ahí, es señal de que la cola no
funciona, no de que la sala no valía.

#### ¿Moderador o solo administrador?

Hoy los roles están partidos de una forma que **no encaja** con este flujo
(`docs/DATABASE.md` §2):

| Paso | Quién puede hoy |
|---|---|
| Verificar la sala | moderador y admin |
| Dibujar el área | moderador y admin (`areas_write`) |
| **Entrar al panel de administración** | **solo admin** |
| Resolver denuncias | solo admin |

O sea: un moderador puede verificar la sala y trazar su área, pero **no puede
entrar al sitio donde estaría la cola**. Hay que resolverlo en una de dos
direcciones, y conviene decidirlo antes de construir la pantalla:

- **La cola vive en `/admin/mapeo`** y la ve quien ya puede mapear —moderador y
  admin—, coherente con que las dos acciones que la resuelven ya son suyas.
- **O la cola es de admin**, y entonces el moderador queda como una figura que
  puede trazar pero no decidir qué se traza, que es una división rara.

La primera es la que encaja con los permisos que ya existen. La segunda es la que
dijiste preferir, y es defendible si la idea es que las salas las curen pocas
manos — pero entonces conviene revisar para qué queda el rol `moderator`, porque
sus poderes actuales apuntan al otro lado.

### 12.6 Esto no es solo para salas

Anotado el 2026-08-10. La sala fue el caso que obligó a diseñar el flujo, pero
**no es el único que lo necesita**. Un casino es un área. Un laboratorio es un
área. Un bicicletero y una cancha también. Todos ellos son hoy pines, y todos
podrían acabar con su polígono trazado.

Lo que separa a los que sí de los que no son **dos preguntas**, y hay que
hacerlas las dos:

1. **¿Es permanente?** Un food truck no merece curaduría: mañana no está.
2. **¿Tiene superficie, o es un punto?** Un casino ocupa media planta. Una
   impresora es un punto, y dibujar su contorno no le dice nada a nadie.

Solo cuando las dos respuestas son que sí tiene sentido pasar por la cola y
acabar en un polígono:

**Decidido el 2026-08-10: solo tres**, y se deja corto a propósito. Cada
categoría que se marque como área es trabajo de trazado para alguien; ampliar la
lista se puede hacer cuando estas tres estén cubiertas y se eche de menos una
cuarta.

| Categoría | ¿Área? | `area_kind` que le tocaría |
|---|---|---|
| `sala` | ✅ | `room` (aún no existe, §12.7) |
| `casino` | ✅ | `cafeteria` |
| `computacion` | ✅ | `lab` |
| `bano`, `bicicletero`, `deporte` | ⏸️ | Tienen superficie y son permanentes, así que **encajarían**. Quedan fuera por ahora: no urgen |
| `ascensor`, `rampa`, `escalera` | ❌ | son **puntos** |
| `impresora`, `agua`, `microondas`, `enchufe`, `entrada` | ❌ | son puntos |
| `food-truck`, `feria`, `estudio`, `sala-libre`… | ❌ | son efímeros |

#### `computacion` pasa a llamarse "Sala de computación"

Mismo `id`, mismo SVG, mismo color: cambia **solo el nombre visible**
(`categories.name` y `name_en`, en el seed y en `campusData.ts`). Hoy dice
"Computación", que nombra una materia y no un lugar — y desde que la sala es un
área, lo que se está marcando es un recinto.

Y hay una razón de fondo para dejarlo escrito, porque el nombre no va a calzar
del todo nunca: **en el campus a estas salas las llaman de tres maneras
distintas.** En unas facultades son "laboratorios" —`E441.4.L.D`, `M253A.6.L601`
en el catálogo de la §5.1 son exactamente eso—, en otras son literalmente salas,
y en el piso 5 de la FIC son "Laboratorio de Informática" y "de Telemática" con
nombre propio.

Encima hay un caso que el catálogo de horarios **no ve**: las salas de
computación **de libre acceso**, tipo las salas Alfa. No tienen código de sala
porque no se dictan clases ahí, así que no aparecen en el `data.json` ni van a
aparecer nunca. Solo pueden entrar al mapa si alguien las agrega — que es,
precisamente, para lo que sirve el flujo de sugerencia de la §12.5.

Dos consecuencias prácticas:

- **`room_code` tiene que poder quedar vacío en esta categoría.** Ya lo permite
  el esquema ("hay salas sin código"), pero la interfaz no debe pedirlo como
  obligatorio ni tratar su ausencia como un error.
- **El nombre de la categoría no manda sobre el título.** Si la sala se llama
  "Sala Alfa" o "Laboratorio de Telemática", eso va en el título tal cual. La
  categoría dice qué tipo de sitio es; el título, cómo se llama.

**Las escaleras y los ascensores merecen una explicación**, porque la intuición
dice que sí son áreas. No conviene: lo que importa de una escalera es *por aquí
se sube*, que es un punto — y además **atraviesan plantas** (ROADMAP §4.2), así
que su polígono habría que repetirlo en cada piso, que es justo el problema que
el rango de plantas resuelve. La caja de escalera grande de un edificio es la
excepción, y para eso está el área `service` dibujada a mano.

#### Cómo hacerlo sin una lista clavada en la interfaz

La tentación es un `if` con las seis categorías. Mejor: **una columna nueva en
`categories`, `area_kind`, que puede ser nula.**

- Si la categoría **tiene** `area_kind`, el pin entra a la cola de sugerencias y
  al aceptarlo aparece "trazar el área" **con el tipo ya elegido**.
- Si es **nula**, verificar es solo verificar y ahí termina.

Con eso, una categoría nueva se comporta bien sola: quien la crea decide si es
un área rellenando una columna, y no hay que tocar la interfaz. Es la misma idea
que ya usa `ttl_hours` — el comportamiento vive en el catálogo, no repartido por
el código.

### 12.7 Lo que queda por decidir

Lo de arriba está cerrado. Esto no:

1. **¿La cola es de moderador o solo de admin?** Ver el cuadro de arriba.
2. **¿Se añade `'room'` a `area_kind`?** `area_kind` es la lista cerrada de
   tipos de área que acepta la base — hoy: `hall`, `corridor`, `cafeteria`,
   `kiosk`, `lab`, `office`, `service`, `courtyard`, `sports`, `parking`,
   `green`, `other`. **No hay ninguno para "sala de clases"**, así que una sala
   tendría que entrar como `other` con el texto "Sala" al lado. Funciona, pero
   deja al tipo más común de un edificio docente clasificado como "otro", y el
   color por defecto del área sale del `kind`. Añadirlo es una migración de una
   línea.
3. ~~**¿El importador entra en el editor?**~~ **Sí, y está hecho el
   2026-08-26.** `/admin/mapeo` lee el `data.json`, y con un edificio
   seleccionado enseña sus salas: cuáles ya tienen pin y cuáles faltan. Al
   elegir una que falta, el siguiente clic en el mapa crea el pin con el código
   y la planta ya puestos.

   **Lo que NO hace, y no es un olvido: crearlas todas de golpe.** Un alta
   masiva las pondría a todas en el centroide del edificio, que es el resultado
   inútil contra el que avisa el ROADMAP — y ni siquiera funcionaría, porque
   `prevent_occupied_pin_location` rechaza dos pines vivos en el mismo punto y
   la misma planta. **La coordenada es justamente el dato que la fuente no
   tiene**, y no hay forma de deducirla: desde arriba el piso 1 y el 3 ocupan el
   mismo sitio. Así que el reparto es ese — la fuente pone lo tedioso y lo que
   se escribe mal, la persona pone el punto.

   Tres detalles del comportamiento que conviene conocer:

   - **El edificio se reconoce por su dirección postal** (§3): el importador
     busca el código del catálogo (`E441`, `E278A`) en el `short_name` o en los
     `aliases` del edificio. Un edificio sin ese código no ofrece salas, y lo
     dice en vez de quedarse vacío sin explicar por qué.
   - **Una sala cuya planta no esté declarada no se puede colocar**, y la lista
     la marca en vez de dejar un botón que fallaría contra
     `trg_validate_pin_floor`. La planta se declara en el mismo editor.
   - **Si la fuente está caída, el importador dice que no hay datos y ya.** Es
     un archivo de terceros y no puede tumbar el editor de mapeo.
   - **"Ya están en el mapa" cuenta pines VIVOS, no pines que existieron.** La
     lista se compara contra `fetchPins`, que filtra por
     `is_permanent OR expires_at > now()`. O sea que una sala **vuelve a salir
     como pendiente** en dos casos: si alguien borra su pin, y —el que sorprende—
     si su pin CADUCA. Con el TTL de 30 días de la categoría `sala`, una sala
     colocada y no verificada reaparece sola al mes como si nunca se hubiera
     puesto. No es un fallo del importador: es que efectivamente ya no hay un
     pin ahí. Pero significa que **colocar sin verificar es trabajo que se
     deshace solo**.
   - **Un techo que hoy no molesta y algún día sí:** esa consulta trae como
     mucho **300 pines** de la facultad (`limit(300)` en `fetchPins`). La FIC
     tiene 14, así que sobra sitio; pero si algún día pasa de 300 vivos, el
     importador empezaría a ofrecer salas que YA están puestas, y colocarlas
     otra vez chocaría contra `prevent_occupied_pin_location` o dejaría un
     duplicado. Cuando se acerque, el arreglo es una consulta propia que traiga
     solo los `room_code` de la facultad en vez de los pines enteros.
   - **La sala tiene que caer dentro de la huella de su edificio.** Su código
     lo dice: `E441.1.S101` es del E441 por definición. Salió al probarlo, y de
     la peor manera: E441 es un edificio HUECO, así que el centro de su
     rectángulo cae en el patio interior y no en el edificio. Dos salas se
     crearon ahí, con `building_id` null y sin que nada se quejara. Ahora se
     rechaza el punto con un aviso que menciona los patios, que es donde
     vuelve a pasar.

---

## Fuentes

- [`data.json` de Salas FIC](https://salas.docencia-eit.cl/data.json) — el horario
- [open-source-udp/salas-vacias](https://github.com/open-source-udp/salas-vacias) — de donde sale la URL y el listado de salas de otro semestre
- [Facultad de Ingeniería y Ciencias — UDP](https://www.udp.cl/pregrado-y-formacion-general/facultades/facultad-de-ingenieria-y-ciencias/) — las dos entradas de la FIC
- [Facultad de Salud y Odontología — UDP](https://www.udp.cl/pregrado-y-formacion-general/facultades/facultad-de-salud-y-odontologia/) — las cuatro direcciones
- [Conoce el campus — UDP](https://www.udp.cl/pregrado-y-formacion-general/vida-universitaria/conoce-el-campus/) y [Contacto — UDP](https://www.udp.cl/contacto/)
- [Edificio Aulario — UDP](https://www.udp.cl/tema/edificio-aulario/) — Ejército 326
- [Infraestructura — Facultad de Educación UDP](https://educacion.udp.cl/facultad/infraestructura/) — Vergara 210
- [Contacto — ICSO UDP](https://icso.udp.cl/contacto/) — Ejército 278 edificio B
- OpenStreetMap (consulta Overpass sobre el Barrio Universitario) — las direcciones marcadas como OSM
