<!--
  ARCHIVO GENERADO. No lo edites a mano: los cambios se pierden.
  Se genera desde CLAUDE.md con `npm run gen:agents`.
-->

# UDP Map — reglas del repositorio

## Antes de trabajar y de cerrar un cambio

Lee el [índice documental](../docs/README.md). El plan vivo es `docs/ROADMAP.md`;
para ubicar código, usa `docs/referencia/repositorio.md`. Si no te indican una
tarea, ofrece los pendientes del plan antes de proponer otra.

Actualiza la documentación correspondiente en el mismo cambio:

| Si cambias… | Actualiza… |
|---|---|
| Esquema, RPC, políticas o triggers | Migración nueva + `supabase/schema/baseline.sql` + `docs/referencia/base-de-datos.md` |
| Pendientes o decisiones del plan | `docs/ROADMAP.md` y la decisión correspondiente si cambia su justificación |
| Archivos, rutas o Edge Functions | `docs/referencia/repositorio.md`; el índice si cambia la orientación |
| Comportamiento visible de una versión | `docs/CHANGELOG.md`, respetando su contrato con el build |

La migración ejecuta el cambio; el baseline reconstruye la base; la referencia
explica el contrato y sus motivos. Mantener solo dos ya dejó el mapeo interior
sin explicación. El hook `.claude/hooks/check-database-docs.mjs` avisa si falta
la referencia: no bloquea ni sustituye esta regla.

Las migraciones se aplican **a mano en el SQL Editor de Supabase**. No hay
`db push` automático en scripts ni CI. Al preparar una, avisa de que debe
aplicarse; un archivo versionado no acredita su ejecución. No edites una migración
ya aplicada en un entorno compartido para cambiar el esquema: crea otra.

Antes de dar por terminado un cambio deben pasar:

~~~bash
npm run typecheck
npx vitest run
npx eslint src
~~~

No lo marques terminado con pruebas fallidas, implementación incompleta o archivos
necesarios sin revisar. `npm run build` también ejecuta el typecheck.
El alcance de CI y las comprobaciones adicionales están en
[validación](../docs/guias/validacion.md).

## Fuente de estas instrucciones

**Edita este archivo.** `AGENTS.md`, `GEMINI.md`, `.cursorrules` y
`.github/copilot-instructions.md` se generan desde aquí:

~~~bash
npm run gen:agents
~~~

No edites los derivados a mano. Llevan las reglas completas porque los antiguos
punteros al origen dejaban sin instrucciones a herramientas que no seguían el enlace.

## Código y modo demo

La organización es por dominios en `src/features/`. Dentro de un dominio,
`api.ts` concentra acceso a datos, `use*.ts` los hooks de react-query,
`demoStore.ts` los datos de prueba y PascalCase los componentes. Los tipos de
base en `src/shared/types/database.ts` se mantienen a mano.

Hay dependencias cruzadas, incluidos ciclos entre `map`, `pins` y `mapping`.
Antes de añadir otra, comprueba si la regla puede vivir en `shared/`.
La [referencia](../docs/referencia/repositorio.md) describe los límites actuales y
[arquitectura](../docs/decisiones/arquitectura.md) sus decisiones y deuda.

Toda función nueva de datos debe cubrir `supabase === null` y el camino real.
Usa el almacén demo correspondiente; no conviertas una operación disponible sin
backend en una consulta obligatoria a Supabase. Demo no significa paridad de
autorización, persistencia ni funcionamiento sin red.

## Reglas del mapa que no hay que perder

- **El desvanecido significa «por vencer».** No atenúes infraestructura permanente.
  Los eventos usan su estado temporal propio. Consulta el efecto temporal de `MapView`.
- **MapLibre controla el `opacity` inline y el `transform` de sus marcadores.**
  Para desvanecer usa variables CSS y `filter`; no escribas `el.style.opacity`.
  No sustituyas sus clases de posicionamiento.
- **No rehagas `innerHTML` en cada render.** Una revalidación cambia la identidad
  de `pins` y recrear el SVG produce parpadeo. Compara la clave de render.
- **Conserva la protección de redimensionamiento de `MapView`.** Su
  `ResizeObserver` llama a `map.resize()` para mantener el mapa alineado.
  La dependencia actual también observa cambios: no es cierto que MapLibre mida
  solo en el constructor.
- **La planta visible es contexto de facultad.** La regla común de marcadores y
  polígonos está en `shared/utils/floorVisibility.ts`; no la copies.
  Las plantas del formulario tienen sus propias precondiciones de edificio.
- **`FACULTIES` es mutable.** `facultyStore.publishFaculties` reemplaza su
  contenido con `splice` para conservar la referencia usada por otros módulos.
  Usa `useFaculties()` al pintar listas; `FACULTIES.find(...)` basta para
  consultas puntuales.
- **La fuente operativa de perímetros es la base.** El catálogo activo y el seed
  no incluyen una geometría alternativa. Hay restos históricos: no los
  conviertas en otra fuente viva.
- **`polygon: null` significa «sin trazar».** No pinta contorno, no asigna
  facultad por perímetro ni habilita mapeo interior. No inventes un cuadrado
  alrededor de la chincheta: ya asignó facultad a pines de la calle.
- **No crees un índice paralelo de perímetros.** Se deriva de `FACULTIES`.
  Mantener dos contenedores ya hizo discrepar nombres y estado «sin trazar».

Antes de tocar códigos o importar salas, lee [salas](../docs/referencia/salas.md).
No deduzcas la facultad por el ramo que ocupa una sala ni confundas una dirección
con un identificador de facultad.

## Seguridad

La autorización efectiva vive en el servidor: privilegios SQL, RLS, funciones y
controles Edge. Ocultar un botón no protege un endpoint. `can()` solo decide
interfaz; `public.user_role()` y, donde se usa, `has_capability()` participan
en las políticas. Revisa las
[diferencias conocidas](../docs/referencia/base-de-datos.md#discrepancias-y-observaciones-abiertas).

No guardes secretos en el repositorio. Distingue claves públicas del frontend,
secretos del entorno Edge y secretos de Vault que leen los cron; su configuración
está en [despliegue](../docs/guias/despliegue.md#configuracion-por-entorno).

## Estilo y commits

- Comentarios en español, con la densidad y los nombres del código próximo.
  Explica por qué existe una regla; no repitas la instrucción.
- Mensajes de interfaz mediante i18n: `t('clave', 'respaldo')`. La existencia de
  catálogos ES/EN no significa que todos los textos estén traducidos.
- **Nunca `Co-Authored-By` ni otra atribución a una IA** en commits o
  descripciones de PR; tampoco «Generated with…». Los commits van solo a nombre
  de quien los hace.
