# Contribuir a UDP Map v0.3.0

**Última actualización:** 2026-07-24

¡Gracias por tu interés en contribuir a UDP Map! 🎉 Estamos construyendo el mapa vivo, calendario de eventos, foro estudiantil, sistema de notificaciones y panel de administración de la comunidad UDP.

Este documento refleja la arquitectura y estándares actuales de la versión 0.3.0. Los Sprints 1, 2, 3 y 4 están completados y operativos en el repositorio. Para consultar el estado de cada componente, revisa [PLAN.md](PLAN.md), [SPRINTS_STATUS.md](SPRINTS_STATUS.md) y [securityDB.md](securityDB.md).

---

## 🚀 Inicio Rápido

1. **Haz fork** del repositorio y clona tu fork localmente.
2. **Instala dependencias**: `npm install`
3. **Configura el entorno**: Copia `.env.example` a `.env` y llena las variables de Supabase y Web Push (si cuentas con backend).
4. **Inicia el servidor de desarrollo**: `npm run dev`

> **💡 Modo Demo Local:** Si no configuras Supabase en `.env` (dejando las variables vacías), la app corre en **modo demo** con datos en memoria y mocks. Esto te permite probar la interfaz de usuario (mapa, pines, foros, eventos, notificaciones) sin backend.

---

## 📂 Estructura del Proyecto (Feature-Sliced Design)

El código está organizado por **funcionalidades (features)** desacopladas:

```text
src/
├── app/                  → Entrada (main.tsx), router principal (App.tsx) y layout global
├── features/             → Dominios funcionales de la aplicación:
│   ├── about/            → Licencias e información institucional
│   ├── admin/            → Panel de administración (/admin), métricas y gestión de roles
│   ├── auth/             → Autenticación Supabase, sesión, modo invitado y permissions.ts
│   ├── events/           → Calendario de eventos, filtros y gestión de RSVP
│   ├── forum/            → Foro estudiantil, hilos por facultad y publicaciones oficiales
│   ├── map/              → Componente MapLibre GL, campus, capas, ruteo peatonal e indoor
│   ├── moderation/       → Cola de reportes de contenido (/moderacion)
│   ├── notifications/    → Suscripción Web Push API, service worker y sidebar/drawer
│   ├── pins/             → Motor común de pines: creador, fotos, expiración, votos y comentarios
│   └── profile/          → Perfil de usuario, perfil público, karma e insignias
├── shared/               → Componentes UI (Tailwind CSS 4 + Radix UI), hooks, tipos y utilidades
└── styles/               → Estilos globales en Tailwind CSS (index.css)

supabase/
├── migrations/           → Esquema SQL, RLS, triggers, RPCs y parches de seguridad
├── seed/                 → Datos iniciales (campus, facultades, categorías)
└── functions/            → Edge Functions desplegables (`expire-pins` y `send-push`)

docs/
├── PLAN.md               → Documento maestro y roadmap vivo.
├── SPRINTS_STATUS.md     → Estado comprobable por sprint.
├── securityDB.md         → Registro histórico de seguridad y base de datos.
├── NOTIFICATIONS_AND_MODERATION.md → Etapas y Definition of Done de notificaciones y moderación.
└── CHANGELOG.md          → Novedades mostradas por el pop-up de actualización PWA.
```

**Regla de oro de arquitectura:** Una feature no debe importar detalles internos de otra feature. Para compartir lógica, expón funciones públicas en su `index.ts` o trasládala a `shared/`.

### Manejo del Mapa (MapLibre)
- Toda la lógica del mapa vive en `src/features/map`.
- Para interactuar con el mapa desde componentes externos, usa el estado global de Zustand (`useUIStore`) o propaga eventos, evitando pasar referencias directas del objeto `map` (`Map` instance) por toda la aplicación. Esto asegura que los componentes de React no fuercen re-renderizados costosos del canvas WebGL.
- Respeta el límite geográfico definido en `campusBoundary.ts`. Solo el rol `admin` puede activar el desbloqueo guardado en `devUnlockMap`.
- La asignación automática de facultad usa `facultyIdAt` y los polígonos de `facultyPerimeters.ts`.
- Los pines todavía se renderizan como marcadores individuales; no documentes clustering visual como completado hasta que exista una fuente GeoJSON con clustering o una implementación equivalente.

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
- Distingue siempre entre "archivo preparado" y "migración desplegada". Actualiza `SPRINTS_STATUS.md` cuando cambie ese estado.
- Toda función `SECURITY DEFINER` debe fijar un `search_path` seguro, validar identidad/rol internamente, revocar `EXECUTE` a `PUBLIC` y concederlo solo a los roles necesarios.
- RLS controla filas, no columnas. Protege campos administrados por el servidor mediante privilegios de columnas, triggers o RPCs.
- Las operaciones que actualizan contadores o karma deben tener una sola vía transaccional.
- Nunca agregues una policy permisiva sin revisar cómo se combina con las demás; las policies permisivas se evalúan con `OR`.
- Registra nuevos hallazgos y su cierre en `securityDB.md` sin borrar el historial. No marques un pendiente como resuelto sin verificarlo contra el catálogo real (`pg_proc`, `pg_policy`) — no basta con que otra herramienta o persona lo diga.

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
# Pruebas unitarias (54 tests en 12 suites)
npm test

# Verificación de tipos TypeScript
npm run typecheck

# ESLint
npm run lint

# Build de producción
npm run build
```

Aún no hay una suite E2E ni pruebas de integración contra Supabase; si tu cambio depende de RLS, RPCs o triggers, agrega una validación reproducible además de las pruebas de frontend.

---

## 🔀 Proceso de Pull Request

1. Asegúrate de estar trabajando sobre la rama principal actualizada (`git pull origin main`).
2. Crea una rama descriptiva para tu feature o fix: `git checkout -b feature/nuevo-foro` o `fix/boton-login`.
3. Haz tus cambios, respetando la estructura de carpetas y guías de estilo.
4. Verifica todo localmente ejecutando `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build`. Si algo falla, la PR será rechazada automáticamente.
5. Abre el PR con un título claro. Si resuelve un Issue, menciónalo (`Closes #12`).
6. Actualiza `SPRINTS_STATUS.md`, `PLAN.md`, `CHANGELOG.md` o `securityDB.md` cuando el cambio altere su estado real.
7. Espera la revisión de otro desarrollador para hacer merge.
