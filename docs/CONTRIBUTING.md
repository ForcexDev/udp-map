# Cómo trabajar en UDP Map

Mapa colaborativo de la Universidad Diego Portales: pines, eventos, foro,
notificaciones y panel de administración, en una PWA bilingüe y mobile-first.

Este documento cuenta **cómo se trabaja aquí y por qué el código es como es**.
Para el estado del proyecto —lo hecho y lo que falta— mira [ROADMAP.md](ROADMAP.md);
para la base de datos, [DATABASE.md](DATABASE.md).

> **Las reglas cortas viven en [`CLAUDE.md`](../CLAUDE.md)**, en la raíz: la regla
> de los tres archivos, los comandos de verificación y las trampas del mapa que ya
> costaron caro. Las lee cualquier agente de IA, y son la versión resumida de lo
> que hay aquí. Si una regla cambia, cambia ahí y regenera con
> `npm run gen:agents`.

---

## 🚀 Inicio Rápido

1. **Haz fork** del repositorio y clona tu fork localmente.
2. **Instala dependencias**: `npm install`
3. **Configura el entorno**: Copia `.env.example` a `.env` y llena las variables de Supabase y Web Push (si cuentas con backend).
4. **Inicia el servidor de desarrollo**: `npm run dev`

> **💡 Modo Demo Local:** Si no configuras Supabase en `.env` (dejando las variables vacías), la app corre en **modo demo** con datos en memoria y mocks. Esto te permite probar la interfaz de usuario (mapa, pines, foros, eventos, notificaciones) sin backend.

---

## 📂 Estructura del Proyecto

Organizado por **dominios (features)**, no por capas técnicas. `CLAUDE.md` lleva
la versión corta de este árbol; aquí está lo que hace cada uno.

```text
src/
├── app/                  → Entrada (main.tsx), router (App.tsx) y layout global
├── features/
│   ├── about/            → Licencias e información institucional
│   ├── admin/            → Panel /admin, métricas y gestión de roles
│   ├── auth/             → Supabase Auth, sesión, modo invitado y permissions.ts
│   ├── events/           → Calendario de eventos, filtros y RSVP
│   ├── forum/            → Hilos por facultad y publicaciones oficiales
│   ├── map/              → MapLibre GL, capas, perímetros y ruteo peatonal
│   ├── mapping/          → Editor de mapeo interior: edificios, plantas y áreas
│   ├── moderation/       → Cola de reportes de contenido (/moderacion)
│   ├── notifications/    → Web Push, service worker y centro de notificaciones
│   ├── pins/             → Motor común: creación, fotos, expiración, votos, comentarios
│   ├── places/           → Galerías de foto de facultades y edificios
│   └── profile/          → Perfil propio y público, karma e insignias
├── shared/               → UI sin dominio, stores, utilidades puras, tipos y clientes
└── styles/               → index.css (Tailwind 4 y las clases propias)
```

Dentro de un feature: `api.ts` para datos, `use*.ts` para hooks de react-query,
`demoStore.ts` para el modo sin Supabase, componentes en PascalCase.

**Regla de oro:** una feature no debería importar detalles internos de otra. Para
compartir lógica, sácala a `shared/`. Hoy esa regla **está rota** —hay ciclos
entre `map`, `pins` y `mapping`— y por eso la sección siguiente existe: no la
empeores sin darte cuenta.

### Manejo del Mapa (MapLibre)
- Toda la lógica del mapa vive en `src/features/map`.
- Para interactuar con el mapa desde componentes externos, usa el estado global de Zustand (`useUIStore`) o propaga eventos, evitando pasar referencias directas del objeto `map` (`Map` instance) por toda la aplicación. Esto asegura que los componentes de React no fuercen re-renderizados costosos del canvas WebGL.
- Respeta el límite geográfico definido en `campusBoundary.ts`. Solo el rol `admin` puede activar el desbloqueo guardado en `devUnlockMap`.
- La asignación automática de facultad usa `facultyIdAt` (`shared/data/facultyStore.ts`) y los perímetros que vienen de la tabla `faculties`.
- Los pines todavía se renderizan como marcadores individuales; no documentes clustering visual como completado hasta que exista una fuente GeoJSON con clustering o una implementación equivalente.

---

## 🏛️ Por qué el proyecto es así, y dónde duele

Cinco decisiones de arquitectura que nadie escribió cuando se tomaron, reconstruidas
a posteriori. Vienen de una auditoría de julio de 2026; las cifras están
reverificadas contra el código el 2026-08-05.

Cada una separa la **intención** de lo que realmente pasó, porque en tres de las
cinco no coinciden.

### 1. Carpetas por dominio, no por capa técnica

Se eligió `src/features/*` en vez de `/views`, `/services`, `/hooks`, para que
trabajar en el foro no obligara a tocar cinco carpetas.

**Lo que pasó:** la estructura está, las fronteras no. Hoy `map` importa de
`pins`, `pins` importa de `map` y de `mapping`, y `mapping` importa de `pins`.
Son ciclos reales, no dependencias sueltas. Se consiguió la estética del patrón
sin el aislamiento. **Antes de añadir una importación cruzada nueva, mira si lo
que necesitas puede vivir en `shared/`.**

### 2. Zustand para lo efímero, TanStack Query para lo del servidor

En vez de un árbol de estado único. **Salió bien** — es probablemente la mejor
decisión técnica del proyecto. No hay `useEffect` haciendo fetch por su cuenta:
los datos entran por queries y se invalidan.

### 3. Supabase directo, sin API propia

El frontend habla con PostgREST y la seguridad la ponen las políticas RLS.

**Lo que pasó, y está bien hecho:** en vez de dejar la lógica crítica en el
cliente, se empujó a RPC en SQL —votar, crear un pin con su límite diario—, así
que las reglas de negocio viven donde no se pueden saltar. Es el motivo de la
regla de seguridad de más abajo: **la comprobación que cuenta es la de la base.**

### 4. Radix sin estilos + Tailwind, no MUI ni Bootstrap

Para tener control total de los píxeles con la accesibilidad ya resuelta (foco,
teclado, ARIA). El resultado es bueno.

**El efecto secundario:** `react-hook-form` y `zod` entraron por un formulario y
se quedaron. Siguen usándose en **un solo archivo**, `CreatePinModal.tsx`, a
cambio de unos 40 kb en el bundle.

### 5. PWA con caché agresiva de teselas

La conectividad en los campus es mala y un mapa en gris es inservible. Workbox
cachea las teselas de OpenFreeMap con `CacheFirst` y 30 días de expiración,
configurado a mano en `vite.config.ts`. Funciona.

### Deuda estructural conocida

No es una lista de tareas: es dónde vas a chocar. Las cifras son del **2026-08-05**
y solo sirven para ver la tendencia — si al leerlas han crecido más, el punto
sigue en pie con más razón. Compruébalas con `wc -l` antes de citarlas.

| Qué | Dónde | Por qué importa |
|---|---|---|
| Ciclos entre features | `map` ↔ `pins` ↔ `mapping` | Impide extraer o testear un módulo aislado. Cambiar cómo se ve un pin puede romper otra pantalla |
| Componente que hace de todo | `map/MapPage.tsx` — **881 líneas** | Mezcla renderizado, orquestación de modales y APIs del dispositivo (giroscopio, geolocalización con parches para iOS y Brave) |
| Formulario que hace de todo | `pins/CreatePinModal.tsx` — **835 líneas** | UI móvil y escritorio, validación, compresión de imágenes en canvas y errores de RPC, todo junto |
| Cajón de sastre de red | `pins/api.ts` — **701 líneas** | Pines, comentarios, favoritos, votos y el camino del modo demo en un archivo |
| Algoritmo mezclado con vista | `forum/ThreadDetailModal.tsx` — **551 líneas** | `buildCommentTree` y el renderizado recursivo conviven |
| Store con demasiados temas | `shared/stores/uiStore.ts` | Modales, modo 2D/3D, interior, ruteo y avisos en el mismo sitio. Barato de partir, si molesta |

Las cuatro primeras **crecieron** desde julio. Si tocas uno de esos archivos y
puedes sacar algo a un módulo aparte sin desviarte de tu tarea, hazlo.

---

## 🔐 Autenticación, Usuarios y Roles

La plataforma usa **Supabase Auth (Google Provider)**, restringido al dominio `@mail.udp.cl`. Todo usuario registrado posee una fila en `profiles`.

Existen 4 roles controlados vía base de datos y `features/auth/permissions.ts`:

1. **`guest`**: Usuarios sin inicio de sesión. Acceso de **solo lectura**. Toda interacción desplegará un modal solicitando inicio de sesión.
2. **`student`**: Login normal `@mail.udp.cl`. Pueden crear pines temporales (`report`), eventos, hilos, comentarios, votos y RSVP. Rate limit preparado de 10 pines por día UTC.
3. **`moderator`**: Estudiantes promovidos. Pueden crear lugares permanentes (`place`), verificar reportes, fijar hilos en el foro y publicar como CEE.
4. **`admin`**: Acceso total. Además de moderación, acceden al panel `/admin`, asignan roles a otros usuarios (`admin_set_user_role`), desprotegen límites del mapa y gestionan la cola de moderación.

---

## 🔐 Variables de Entorno (.env)

```env
# Backend de Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key

# OpenRouteService (Ruteo peatonal)
VITE_ORS_API_KEY=tu-ors-key

# Google Auth Nativo
VITE_GOOGLE_CLIENT_ID=tu-google-client-id.apps.googleusercontent.com

# Web Push API
VITE_VAPID_PUBLIC_KEY=tu-vapid-public-key
```

---

## 🔒 Migraciones y seguridad de base de datos

- No edites una migración que ya haya sido aplicada en un entorno compartido; crea una migración posterior.
- Distingue siempre entre "archivo preparado" y "migración desplegada". Actualiza `ROADMAP.md` cuando cambie ese estado.
- Toda función `SECURITY DEFINER` debe fijar un `search_path` seguro, validar identidad/rol internamente, revocar `EXECUTE` a `PUBLIC` y concederlo solo a los roles necesarios.
- RLS controla filas, no columnas. Protege campos administrados por el servidor mediante privilegios de columnas, triggers o RPCs.
- Las operaciones que actualizan contadores o karma deben tener una sola vía transaccional.
- Nunca agregues una policy permisiva sin revisar cómo se combina con las demás; las policies permisivas se evalúan con `OR`.
- **Todo cambio en la base son tres cosas en el mismo commit:** la migración, `supabase/schema/baseline.sql` y `docs/DATABASE.md`. Hay un hook que avisa si falta la tercera.
- Registra nuevos hallazgos y su cierre en la sección "Observaciones abiertas" de `DATABASE.md`, sin borrar el historial. No marques un pendiente como resuelto sin verificarlo contra el catálogo real (`pg_proc`, `pg_policy`) — no basta con que otra herramienta o persona lo diga.

---

## 🛠️ Guías de Estilo y Desarrollo

### Stack Tecnológico
- **Frontend Core:** React 19, TypeScript 5.7, Vite 6.
- **Estado UI & Asíncrono:** Zustand + TanStack Query (React Query).
- **Estilos:** Tailwind CSS 4 + Lucide React + Radix UI.
- **Mapa:** MapLibre GL JS + OpenFreeMap.

### Tipado (TypeScript)
- Evita el uso de `any`. El linter arrojará error (`Unexpected any`).
- Los tipos de la base de datos se autogeneran en `src/shared/types/database.ts`. Utiliza las interfaces expuestas allí.

### Internacionalización (i18n)
- La aplicación soporta Español e Inglés mediante `react-i18next`.
- Usa el hook `const { t } = useTranslation()` en tus componentes.
- No hardcodees texto en el JSX; usa la función `t(...)`.

---

## 🧪 Verificación y Testing

Antes de enviar un Pull Request, asegúrate de ejecutar y pasar la suite de pruebas y linters:

```bash
npm run typecheck && npx vitest run && npx eslint src
```

Los tres tienen que pasar. `npm run build` corre además el typecheck, así que
sirve como comprobación final.

Aún no hay una suite E2E ni pruebas de integración contra Supabase; si tu cambio depende de RLS, RPCs o triggers, agrega una validación reproducible además de las pruebas de frontend.

---

## 🔀 Proceso de Pull Request

1. Trabaja sobre `main` actualizado y crea una rama: `feature/nuevo-foro`, `fix/boton-login`.
2. Verifica en local antes de abrir nada. Si falla, CI lo rechaza igual.
3. Título claro, y menciona el issue si lo hay (`Closes #12`).
4. **Deja al día el documento que corresponda:** `ROADMAP.md` si cerraste un
   pendiente o cambiaste una decisión, `DATABASE.md` si tocaste el esquema,
   `CHANGELOG.md` si es algo que el usuario va a notar.
