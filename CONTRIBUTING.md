# Contribuir a UDP Map v0.1

¡Gracias por tu interés en contribuir! 🎉 Estamos construyendo el mapa vivo del campus, eventos y foro de la UDP.

Este documento refleja la nueva arquitectura y estándares de la versión 0.1 (v0.1). Para detalles completos de producto y estado de sprints, revisa los archivos `PLAN.md` y `SPRINTS_STATUS.md`.

## Inicio Rápido

1. **Haz fork** del repo y clona tu fork.
2. **Instala** dependencias: `npm install`
3. **Configura el entorno**: Copia `.env.example` a `.env` y llena las variables de Supabase (si las tienes).
4. **Inicia** el servidor: `npm run dev`

> **Demo Local:** Si no configuras Supabase, la app corre en un "modo demo" (con datos en memoria y mocks) útil para probar UI sin backend.

## Estructura del Proyecto (Feature-Sliced Design)

El código está organizado por **funcionalidades (features)**, no por tipo de archivo:

```
src/
├── app/                  → Entrada, providers (Query, Router, i18n, Zustand), layout global
├── features/             → Dominios principales de la app
│   ├── auth/             → Login, sesión, modo invitado, permissions.ts
│   ├── map/              → MapLibre, campus, capas, indoor, ruteo peatonal
│   ├── pins/             → Motor común: fotos, comentarios, expiración, votos
│   ├── forum/            → Foro, hilos, comentarios anidados
│   ├── profile/          → Perfil, karma, insignias
│   └── moderation/       → Reportes, cola de moderación
├── shared/               → Código compartido
│   ├── ui/               → Design system (botones, modales, bottom sheets)
│   ├── hooks/            → Hooks transversales
│   ├── lib/              → Clientes (Supabase, QueryClient, i18n)
│   └── types/            → Tipos autogenerados de DB y dominio
└── styles/               → Tailwind CSS globales
supabase/
├── migrations/           → Esquema SQL (pines, RLS, RPCs)
├── functions/            → Edge Functions (Deno: moderate-content, expire-pins)
└── seed/                 → Datos iniciales (campus, facultades)
```

**Regla de oro de arquitectura:** Una feature no debe importar detalles internos de otra feature. Para compartir lógica, expón funciones claras o muévelo a `shared/`.

## Autenticación y Roles

Usamos **Supabase Auth (Google Provider)** restringido al dominio `@mail.udp.cl`.

Existen 4 roles definidos en la base de datos y controlados en `features/auth/permissions.ts`:
1. **`guest`**: Usuarios sin login. Tienen acceso de **solo lectura**. Todo intento de escritura despliega un modal pidiendo login.
2. **`student`**: Login con `@mail.udp.cl`. Pueden crear reportes, eventos estudiantiles, votar, comentar y subir fotos.
3. **`moderator`**: Estudiantes promovidos. Pueden ocultar contenido ajeno y crear lugares permanentes (`place`).
4. **`admin`**: Acceso total.

La seguridad está garantizada por **Row Level Security (RLS)** en la base de datos Supabase, que impide (incluso mediante la API) que un `guest` escriba directamente en la DB.

## Guías de Estilo y Desarrollo

### Stack Tecnológico
- **Frontend:** React 19, TypeScript, Vite 6.
- **Estado:** Zustand (UI local rápida) + TanStack Query (Estado asíncrono/servidor).
- **Estilos:** Tailwind CSS 4 + Lucide React.
- **Mapa:** MapLibre GL JS + OpenFreeMap.

### Tipado (TypeScript)
- Evita usar `any` a toda costa. El linter arrojará error (`Unexpected any`). Si no conoces el tipo, usa `unknown`.
- Los tipos de la base de datos se autogeneran de Supabase en `src/shared/types/database.ts`.

### Internacionalización (i18n)
- Usamos `react-i18next`.
- Usa el hook `const { t } = useTranslation()` en tus componentes.
- Nunca pongas texto en español/inglés quemado directamente en el JSX.

### Manejo del Mapa (MapLibre)
- Toda la lógica del mapa vive en `src/features/map`.
- Para interactuar con el mapa desde componentes externos, usa eventos de ventana (`window.dispatchEvent`) o modifica el estado de Zustand (`useUIStore`), evitando pasar referencias explícitas del objeto `map` por toda la aplicación.

## Modelo de Datos Unificado (Pines)

En la v0.1, **TODO** es un pin en la base de datos, definido por la columna `type` en la tabla `pins`:
- `place`: Lugares permanentes (Facultades, bibliotecas). Los gestiona el administrador.
- `event`: Eventos con fecha de inicio y fin (`starts_at`, `ends_at`).
- `report`: Reportes temporales creados por usuarios que se eliminan solos al llegar a su tiempo de expiración (`expires_at`).

Todos los pines (sin importar su tipo) comparten las mismas tablas satélite para interacciones: `pin_photos`, `pin_comments` y `pin_votes`.

## Testing y CI/CD

En cada Pull Request, GitHub Actions ejecutará automáticamente:
1. `npm run lint` (ESLint, previene `any` y malas prácticas)
2. `npm run typecheck` (TypeScript tsc)
3. `npm run test` (Vitest)

Asegúrate de correr estos comandos localmente antes de hacer push. Si modificas componentes del mapa, revisa que los mocks en `MapView.test.tsx` sigan siendo compatibles, ya que MapLibre no corre en el entorno de tests (Node/JSDOM).

## Proceso de Pull Request

1. Asegúrate de estar trabajando sobre la rama principal actualizada (`git pull origin main`).
2. Crea una rama para tu feature: `git checkout -b feature/nombre-feature` o `fix/nombre-bug`.
3. Haz tus cambios siguiendo las guías de estilo.
4. Verifica localmente (`npm run lint`, `npm run test`, `npm run build`).
5. Abre el PR con un título descriptivo y enlázalo a un issue si existe.
6. Espera la revisión de tu código para hacer merge.
