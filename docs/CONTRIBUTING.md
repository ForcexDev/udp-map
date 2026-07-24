# Contribuir a UDP Map v0.2.0

**Última actualización:** 2026-07-21

¡Gracias por tu interés en contribuir! 🎉 Estamos construyendo el mapa vivo, calendario de eventos y foro de la UDP.

Este documento refleja la arquitectura y estándares actuales de la versión 0.2.0. Los Sprints 1 y 2 están terminados, el núcleo del Sprint 3 está operativo y el Sprint 4 está en progreso. Para distinguir lo implementado, lo preparado y lo pendiente, revisa [PLAN.md](PLAN.md), [SPRINTS_STATUS.md](SPRINTS_STATUS.md) y [securityDB.md](securityDB.md).

## Inicio Rápido

1. **Haz fork** del repo y clona tu fork localmente.
2. **Instala** dependencias: `npm install`
3. **Configura el entorno**: Copia `.env.example` a `.env` y llena las variables de Supabase (si las tienes).
4. **Inicia** el servidor: `npm run dev`

> **Demo Local:** Si no configuras Supabase, la app corre en un "modo demo" (con datos en memoria y mocks) útil para probar la interfaz (mapas, pines, eventos y foros) sin necesidad de backend.

## Estructura del Proyecto (Feature-Sliced Design)

El código está organizado por **funcionalidades (features)**, no por tipo de archivo:

```text
src/
├── app/                  → Entrada (main.tsx), providers globales (Query, Router, i18n), layout global.
├── features/             → Dominios principales de la aplicación:
│   ├── auth/             → Autenticación, sesión, modo invitado, permissions.ts.
│   ├── map/              → Componente MapLibre, campus, capas, ruteo peatonal.
│   ├── pins/             → Motor común de pines: creador, fotos, expiración, votos y comentarios.
│   ├── forum/            → Foro por facultad, hilos (threads), respuestas anidadas.
│   ├── events/           → Calendario de eventos, filtros, creación de eventos oficiales y estudiantiles.
│   └── profile/          → Perfil de usuario, perfiles públicos (vistos por otros), gestión de roles (admin).
├── shared/               → Código base y utilidades compartidas:
│   ├── ui/               → Design system (botones, modales, Bottom Sheets).
│   ├── hooks/            → Hooks transversales.
│   ├── lib/              → Clientes (Supabase, QueryClient, i18n).
│   ├── data/             → Mock data y constantes (campusData).
│   └── types/            → Tipos autogenerados de BD y modelos de dominio.
└── styles/               → Estilos globales en Tailwind CSS (index.css).

supabase/
├── migrations/           → Esquema SQL (tablas, RLS, triggers, políticas de seguridad).
├── functions/            → Edge Functions desplegables; actualmente `expire-pins`.
└── seed/                 → Datos iniciales.

docs/
├── PLAN.md               → Documento maestro y roadmap vivo.
├── SPRINTS_STATUS.md     → Estado comprobable por sprint.
├── securityDB.md         → Registro histórico de seguridad y base de datos.
└── CHANGELOG.md          → Novedades mostradas por el pop-up de actualización PWA.
```

**Regla de oro de arquitectura:** Una feature no debe importar detalles internos de otra feature. Para compartir lógica, expón funciones claras o muévelo a `shared/`.

## Autenticación, Usuarios y Roles

La plataforma usa **Supabase Auth (Google Provider)**, restringido al dominio `@mail.udp.cl`. Todo usuario (salvo invitados) tiene una entrada en la tabla `profiles`.

Existen 4 roles controlados vía base de datos y `features/auth/permissions.ts`:
1. **`guest`**: Usuarios sin inicio de sesión. Tienen acceso de **solo lectura**. Todo intento de escritura despliega un modal pidiendo login.
2. **`student`**: Login normal. Pueden crear pines temporales (reportes), eventos, hilos en el foro, comentar y votar. El código incorpora un máximo de 10 pines por día UTC, pendiente de activar mediante su migración en Supabase.
3. **`moderator`**: Estudiantes promovidos. Pueden gestionar contenido (eliminar pines ajenos, fijar hilos), crear lugares permanentes (`place`) y publicar hilos como Centro de Alumnos FIC.
4. **`admin`**: Acceso total. Además de la moderación, pueden asignar roles a otros perfiles, crear facultades o categorías y publicar hilos como Administración UDP.

La aplicación usa **Row Level Security (RLS)** y validaciones dentro de RPCs. No asumas que una restricción del frontend es una medida de seguridad. Existen tareas de hardening confirmadas y documentadas en [securityDB.md](securityDB.md); una contribución que toque tablas, policies, triggers o funciones privilegiadas debe revisar ese registro.

## Modelo de Datos Unificado (Pines & Foro)

- **Tabla `pins`**: Controla todo el contenido geolocalizado. Determinado por su columna `type` (`place`, `event`, `report`).
  - Los eventos usan la misma tabla, definiendo `starts_at` y `ends_at`.
  - Comparten tablas satélite: `pin_photos`, `pin_comments` y `pin_votes`.
- **Foro (`forum_threads` y `forum_comments`)**: Sistema independiente de discusiones separadas por facultad. Soporta respuestas anidadas infinitas (renderizadas como un árbol de comentarios).
- **Rate limit:** la creación productiva pasa por la RPC `create_pin_with_daily_limit` una vez aplicada la migración correspondiente; `pin_creation_events` conserva el consumo aunque el pin se elimine.

## Migraciones y seguridad de base de datos

- No edites una migración que ya haya sido aplicada en un entorno compartido; crea una migración posterior.
- Distingue siempre entre “archivo preparado” y “migración desplegada”. Actualiza `SPRINTS_STATUS.md` cuando cambie ese estado.
- Toda función `SECURITY DEFINER` debe fijar un `search_path` seguro, validar identidad/rol internamente, revocar `EXECUTE` a `PUBLIC` y concederlo solo a los roles necesarios.
- RLS controla filas, no columnas. Protege campos administrados por el servidor mediante privilegios de columnas, triggers o RPCs.
- Las operaciones que actualizan contadores o karma deben tener una sola vía transaccional.
- Nunca agregues una policy permisiva sin revisar cómo se combina con las demás; las policies permisivas se evalúan con `OR`.
- Registra nuevos hallazgos y su cierre en `securityDB.md` sin borrar el historial.

## Guías de Estilo y Desarrollo

### Stack Tecnológico
- **Frontend:** React 19, TypeScript, Vite 6.
- **Estado:** Zustand (estado UI local, como Modales) + TanStack Query (Estado de datos asíncrono y caché).
- **Estilos:** Tailwind CSS 4 + Lucide React.
- **Mapa:** MapLibre GL JS + OpenFreeMap.

### Tipado (TypeScript)
- Evita usar `any` a toda costa. El linter arrojará error (`Unexpected any`). Si no conoces el tipo exacto, usa `unknown` o genéricos (`Record<string, unknown>`).
- Los tipos de la base de datos se autogeneran en `src/shared/types/database.ts`. Usa las interfaces expuestas allí.

### Internacionalización (i18n)
- La aplicación es bilingüe mediante `react-i18next`.
- Usa siempre el hook `const { t } = useTranslation()` en tus componentes.
- Nunca hardcodees texto directamente en el JSX (e.g. `<p>Hola</p>`), usa `<p>{t('greeting', 'Hola')}</p>`.

### Manejo del Mapa (MapLibre)
- Toda la lógica del mapa vive en `src/features/map`.
- Para interactuar con el mapa desde componentes externos, usa el estado global de Zustand (`useUIStore`) o propaga eventos, evitando pasar referencias directas del objeto `map` (`Map` instance) por toda la aplicación. Esto asegura que los componentes de React no fuercen re-renderizados costosos del canvas WebGL.
- Respeta el límite geográfico definido en `campusBoundary.ts`. Solo el rol `admin` puede activar el desbloqueo guardado en `devUnlockMap`.
- La asignación automática de facultad usa `facultyIdAt` y los polígonos de `facultyPerimeters.ts`.
- Los pines todavía se renderizan como marcadores individuales; no documentes clustering visual como completado hasta que exista una fuente GeoJSON con clustering o una implementación equivalente.

## Testing y CI/CD

En cada Pull Request o push a la rama principal, GitHub Actions ejecutará:
1. `npm run lint` (ESLint: verifica reglas de Hooks, `no-explicit-any`, etc.)
2. `npm run typecheck` (TypeScript: validación estricta de tipos)
3. `npm run test` (Vitest: Pruebas unitarias de utilidades y componentes lógicos)
4. `npm run build` (build de producción Vite/PWA)

Actualmente existen 9 archivos de prueba y 42 pruebas Vitest. Aún no hay una suite E2E ni pruebas de integración contra Supabase; si tu cambio depende de RLS, RPCs o triggers, agrega una validación reproducible además de las pruebas de frontend.

Asegúrate de correr los cuatro comandos localmente antes de hacer push. Si modificas documentación cargada por la aplicación, como `CHANGELOG.md`, ejecuta también el build para comprobar la importación `?raw`.

## Proceso de Pull Request

1. Asegúrate de estar trabajando sobre la rama principal actualizada (`git pull origin main`).
2. Crea una rama descriptiva para tu feature o fix: `git checkout -b feature/nuevo-foro` o `fix/boton-login`.
3. Haz tus cambios, respetando la estructura de carpetas y guías de estilo.
4. Verifica todo localmente ejecutando `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build`. Si algo falla, la PR será rechazada automáticamente.
5. Abre el PR con un título claro. Si resuelve un Issue, menciónalo (`Closes #12`).
6. Actualiza `SPRINTS_STATUS.md`, `PLAN.md`, `CHANGELOG.md` o `securityDB.md` cuando el cambio altere su estado real.
7. Espera la revisión de otro desarrollador para hacer merge.
