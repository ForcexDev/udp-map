# UDP Map — reglas del repositorio

## Lo primero, aunque no leas nada más

**Al terminar un cambio, deja al día el documento que le corresponde:**

| Si tocaste… | Actualiza, en el mismo commit |
|---|---|
| El esquema de la base | La migración **+** `supabase/schema/baseline.sql` **+** `docs/DATABASE.md` |
| Algo del plan: cerrar un pendiente, cambiar una decisión | `docs/ROADMAP.md` |

`docs/ROADMAP.md` es el plan vivo y la lista de pendientes. **`PLAN.md` y
`SPRINTS_STATUS.md` ya no existen** — se borraron el 2026-08-05 y su contenido
está ahí. Si buscas el estado del proyecto, es ese archivo.

Antes de dar algo por terminado:

```bash
npm run typecheck && npx vitest run && npx eslint src
```

---

Mapa colaborativo de la Universidad Diego Portales. React 19 + TypeScript + Vite,
MapLibre GL para el mapa, Supabase para datos y auth, Tailwind 4, PWA.

> **Este archivo es el origen.** `AGENTS.md` (Antigravity, Codex), `GEMINI.md`,
> `.cursorrules` y `.github/copilot-instructions.md` se **generan** desde aquí
> con `npm run gen:agents`. Llevan el contenido completo, no un enlace, porque
> una herramienta que lee el contexto a trozos nunca va a seguir el enlace.
> No los edites a mano: edita `CLAUDE.md` y regenera.

---

## Por qué la regla de los tres archivos

1. La migración nueva en `supabase/migrations/`, con nombre `<timestamp>_descripcion.sql`.
   Es lo que se ejecuta contra la base.
2. `supabase/schema/baseline.sql`. Es lo que reconstruye la base desde cero.
3. `docs/DATABASE.md`. Es lo que explica **por qué** el esquema es así.

Las tres, siempre. Si se separan, el baseline deja de describir la realidad y la
documentación deja de servir para entender la base. Ya pasó: el mapeo interior
entero (`building_floors`, `areas`, `pin_schedule_items`) se implementó sin tocar
`DATABASE.md`, y recuperarlo después costó más que haberlo escrito en su momento.

Hay un hook (`.claude/hooks/check-database-docs.mjs`) que avisa si tocas el
esquema y `DATABASE.md` sigue igual. Solo funciona en Claude Code; en el resto de
herramientas la regla depende de que la leas.

Las migraciones se aplican **a mano** desde el SQL Editor de Supabase. No hay
`db push` ni en CI ni en los scripts de npm. Cuando crees una migración, dile a
quien te lo pidió que tiene que aplicarla.

Si quien te pide algo no dice en qué trabajar, mira los pendientes de
`docs/ROADMAP.md` y ofrécele lo que hay antes de proponer nada por tu cuenta.

---

## Antes de dar por terminado un cambio

```bash
npm run typecheck && npx vitest run && npx eslint src
```

Los tres tienen que pasar. `npm run build` además corre el typecheck.

No marques algo como terminado si un test falla, si la implementación está a
medias o si no encontraste un archivo que necesitabas. Dilo.

---

## Cómo está organizado el código

Arquitectura por features, no por capas técnicas.

```
src/
├── features/<dominio>/     auth, map, mapping, pins, places, events, forum,
│                           profile, admin, onboarding
├── shared/
│   ├── data/               el catálogo: campusData (semilla), facultyStore (vivo)
│   ├── stores/             zustand (uiStore, filterStore)
│   ├── ui/                 componentes sin dominio (Dialog, PhotoCarousel…)
│   ├── utils/              lógica pura y testeable
│   ├── lib/                clientes externos (supabase, i18n)
│   └── types/database.ts   los tipos de las tablas
└── test/setup.ts           dobles del entorno que jsdom no trae
```

Dentro de un feature: `api.ts` para datos, `use*.ts` para hooks de react-query,
`demoStore.ts` para el modo sin Supabase, componentes en PascalCase.

**Las fronteras entre features no se respetan, y no lo empeores.** Hoy hay ciclos
reales: `map` ↔ `pins` ↔ `mapping`. Antes de añadir una importación cruzada
nueva, mira si lo que necesitas puede vivir en `shared/`. El porqué de esto y la
lista de archivos que ya se pasaron de tamaño están en `docs/CONTRIBUTING.md`,
sección "Por qué el proyecto es así, y dónde duele".

**Modo demo.** La app funciona sin credenciales de Supabase, contra almacenes en
memoria. Cuando escribas una función de datos nueva, cubre los dos caminos: si
`supabase` es `null`, cae al `demoStore`. Si no, el editor de mapeo y el mapa
dejan de poder probarse sin base.

---

## Reglas que ya costaron caro

Están escritas porque alguien las descubrió peleando con un bug. Léelas antes de
tocar el mapa.

- **El desvanecido significa "por vencer".** `filter: opacity()` sobre un marcador
  es la señal de que un pin está expirando (`MapView.tsx`). No lo uses para nada
  más: atenuar un pin permanente le hace decir lo contrario de la verdad.
- **MapLibre es dueño del `opacity` en línea de sus marcadores.** `Marker._updateOpacity()`
  lo reescribe en cada `move`. Para atenuar, variables CSS y `filter`, nunca
  `el.style.opacity`.
- **No rehagas el `innerHTML` de un marcador en cada render.** `pins` cambia de
  identidad cuando react-query revalida; rehacer el SVG hace que el icono
  desaparezca un frame. Compara una clave de render antes de tocar el DOM.
- **MapLibre mide su contenedor una sola vez, en el constructor.** Si el contenedor
  crece después, hay que llamar a `map.resize()` o los marcadores quedan corridos.
- **La planta es un contexto de FACULTAD, no de edificio.** La regla vive entera en
  `shared/utils/floorVisibility.ts` y la comparten los marcadores y los polígonos.
  No la reimplementes en un tercer sitio.
- **`FACULTIES` es un array MUTABLE, no una constante.** Vive en
  `shared/data/campusData.ts` sembrado con el catálogo de siempre, y
  `facultyStore.publishFaculties()` lo reemplaza **en el sitio** con lo que hay
  en la tabla `faculties` al arrancar. Se reemplaza con `splice` y no
  reasignando: los ~26 archivos que hacen `FACULTIES.find(...)` guardan esta
  misma referencia, y reasignar la dejaría apuntando al catálogo viejo. Si tu
  componente PINTA una lista de facultades, usa `useFaculties()`; si solo hace
  una consulta puntual, `FACULTIES` basta.
- **Los perímetros de facultad viven SOLO en la base.** No hay copia en el
  repositorio: la hubo (`facultyPerimeters.ts`), se desincronizó durante meses y
  se borró. `seed.sql` tampoco los siembra. Se trazan desde `/admin/mapeo`.
- **`polygon` null no es un perímetro cualquiera.** Significa "sin trazar": no
  pinta contorno, no captura pines y no se puede mapear por dentro. No lo
  rellenes con un cuadrado alrededor de la chincheta — ya se hizo, y asignaba
  facultad a pines que estaban en la calle.
- **No pongas un índice de perímetros al lado de `FACULTIES`.** Ya se probó: son
  dos contenedores que hay que mantener a la par, y en cuanto uno se quedó atrás
  el editor enseñaba el nombre nuevo de una facultad junto a un "sin trazar" que
  ya no era cierto. Todo se deriva del catálogo.

---

## Seguridad

- **La comprobación de rol que cuenta es la de la base.** Esconder un botón en la
  interfaz no impide llamar al endpoint. Todo lo que restrinja por rol necesita su
  política RLS; el cliente solo decide qué dibujar.
- `public.user_role()` es la función que resuelve el rol en las políticas.
- No metas secretos en el repositorio. Las claves de servicio viven en Vault.

---

## Estilo

- **Comentarios en español**, como el resto del repositorio.
- Explica **por qué**, no qué. Un comentario que repite el código sobra; uno que
  cuenta qué se rompió si lo cambias, vale.
- Escribe como el código de alrededor: misma densidad de comentarios, mismos
  nombres, mismos giros.
- Mensajes de interfaz por i18n (`t('clave', 'respaldo')`), no clavados.

---

## Documentación viva

| Archivo | Qué es |
|---|---|
| `docs/ROADMAP.md` | El plan. Qué está hecho y qué falta. Se actualiza al cerrar algo. |
| `docs/DATABASE.md` | El esquema y por qué es así. Se actualiza con cada migración. |
| `docs/CONTRIBUTING.md` | Cómo trabajar en el repositorio y cómo está organizado el código. |
| `docs/CHANGELOG.md` | Novedades por versión. Lo lee el aviso de actualización de la PWA. |
| `docs/NOTIFICATIONS_AND_MODERATION.md` | Notificaciones y moderación. |
| `docs/PWA_UPDATE.md` | Cómo la app detecta una versión nueva. |
