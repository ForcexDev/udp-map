<div align="center">

# 📍 UDP Map

**Mapa colaborativo de pines, reportes, eventos, foro y utilidades para la Universidad Diego Portales**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![MapLibre](https://img.shields.io/badge/MapLibre-GL-42A5F5?logo=maplibre&logoColor=white)](https://maplibre.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Vitest](https://img.shields.io/badge/Vitest-3.0-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-yellow.svg)](LICENSE)

</div>

---

## 🌟 Descripción

**UDP Map** permite a la comunidad de la Universidad Diego Portales interactuar en tiempo real mediante un **mapa colaborativo de pines**, un **calendario de eventos**, un **foro social por facultades**, un **sistema de notificaciones Web Push** y un **panel de administración y moderación**. Todo en una Progressive Web App (PWA) gratuita, mobile-first y bilingüe.

> **Estado del Proyecto (v0.8.0):** el plan y los pendientes viven en [docs/ROADMAP.md](docs/ROADMAP.md).

### 🚀 Funcionalidades Principales

| Función | Descripción |
|---|---|
| 🗺️ **Mapa Interactivo** | Motor **MapLibre GL + OpenFreeMap** (3 campus UDP) con marcadores por categoría, modo 2D/3D y límites geográficos |
| 📍 **Pines y Reportes** | Crea pines de lugares (`place`), eventos (`event`) o reportes temporales (`report`) con fecha de expiración automática y rate limit diario |
| 📸 **Fotos y Comentarios** | Subida multi-foto optimizada, comentarios en tiempo real con UI optimista y sistema de votos |
| 🧭 **Ruteo y Orientación** | Ruta peatonal e indoor accesible (vía OpenRouteService), brújula con giroscopio nativo y rotación de mapa |
| 📅 **Eventos y RSVP** | Calendario de eventos estudiantiles y oficiales con indicación de asistencia ("Voy" / "Me interesa") y recordatorios |
| 💬 **Foro por Facultad** | Discusiones estudiantiles y publicaciones oficiales con respuestas anidadas, menciones automáticas y ordenamiento por votos |
| 🔔 **Notificaciones Web Push** | Centro de notificaciones en tiempo real (respuestas en foros, logros, recordatorios de eventos y avisos de moderación) |
| 🛡️ **Moderación y Admin** | Panel de administración (`/admin`), cola de reportes de contenido, gestión de roles de usuario e insignias de cartógrafo |
| 🔐 **Login Exclusivo UDP** | Autenticación restringida al dominio `@mail.udp.cl` con roles (`guest`, `student`, `moderator`, `admin`) y RLS estricto |
| 👁️ **Modo Invitado & Demo** | Lectura sin sesión y fallback en memoria para pruebas locales offline |
| 🌐 **Bilingüe (ES/EN)** | Interfaz traducida completa mediante `react-i18next` |

---

## 🚀 Inicio Rápido

### Requisitos

- [Node.js](https://nodejs.org/) 24 (la versión que usa CI)
- (Opcional) Proyecto en [Supabase](https://supabase.com) con Google Auth configurado para `@mail.udp.cl`

### Instalación y Desarrollo

```bash
# 1. Clonar el repositorio
git clone https://github.com/ForcexDev/udp-map.git
cd udp-map

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Edita .env con las credenciales de Supabase y Web Push (opcional)

# 4. Iniciar servidor de desarrollo
npm run dev
```

La app estará disponible en `http://localhost:5173`.

### 💡 Modo Demo (Sin Backend)

Si no defines las variables de Supabase en `.env` (dejándolas vacías), **UDP Map corre automáticamente en modo demo** con datos locales en memoria. Podrás probar la interfaz de mapas, la creación de pines, foros, eventos y navegación indoor sin necesidad de conectarte a una base de datos real.

---

## 📂 Estructura del Proyecto (Feature-Sliced Design)

```text
src/
├── app/                  → Punto de entrada, router principal (App.tsx) y layout global
├── features/             → Módulos funcionales desacoplados:
│   ├── about/            → Información institucional y licencias
│   ├── admin/            → Panel de administración (/admin), métricas y gestión de usuarios
│   ├── auth/             → Autenticación Supabase, roles, permisos y modo invitado
│   ├── events/           → Calendario de eventos, filtros y gestión de RSVP
│   ├── forum/            → Foro estudiantil, hilos por facultad y publicaciones oficiales
│   ├── map/              → MapLibre GL, selectores de campus, perímetros GeoJSON y ruteo
│   ├── mapping/          → Editor de mapeo interior: edificios, plantas y áreas (/admin/mapeo)
│   ├── moderation/       → Cola de reportes de contenido y acciones de moderación
│   ├── notifications/    → Suscripción Web Push, service worker y sidebar de notificaciones
│   ├── pins/             → Motor común de pines: creador, fotos, expiración, votos y comentarios
│   ├── places/           → Galerías de fotos de facultades y edificios
│   └── profile/          → Perfil de usuario, perfil público, karma e insignias
├── shared/               → UI Kit (Tailwind + Radix), hooks, tipos DB autogenerados y utilidades
├── styles/               → Estilos globales en Tailwind CSS (index.css)
└── test/                 → Dobles de entorno para jsdom (setup de Vitest)

supabase/
├── schema/               → baseline.sql: reconstruye la base desde cero
├── migrations/           → Migraciones incrementales desde agosto 2026 (se aplican a mano en el SQL Editor)
├── _archive/             → Migraciones históricas ya integradas en el baseline
├── seed/                 → Datos iniciales (campus, facultades, categorías, insignias)
└── functions/            → Edge Functions desplegables (`send-push` y `storage-gc`; la expiración de pines es un job de pg_cron, no una función)
```

---

## 🔐 Variables de Entorno

| Variable | Descripción | ¿Requerida? | ¿Expuesta en Frontend? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | URL de la instancia de Supabase | Opcional (Demo si falta) | ✅ Sí |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima pública de Supabase (`VITE_SUPABASE_PUBLISHABLE_KEY` se acepta como alias) | Opcional (Demo si falta) | ✅ Sí |
| `VITE_ORS_API_KEY` | API Key de OpenRouteService (Ruteo peatonal real) | Opcional (Línea recta fallback) | ✅ Sí |
| `VITE_GOOGLE_CLIENT_ID` | Client ID de Google OAuth para login nativo | Opcional | ✅ Sí |
| `VITE_VAPID_PUBLIC_KEY` | Clave pública VAPID para notificaciones Web Push | Opcional | ✅ Sí |

> [!NOTE]
> Google OAuth se configura en el **Supabase Dashboard → Authentication → Providers → Google**, restringiendo el acceso al dominio `mail.udp.cl`.

> [!IMPORTANT]
> **Nunca subas `.env`** al repositorio. Utiliza `.env.example` como plantilla.

---

## 🛠️ Stack Tecnológico

- **Frontend Core:** React 19 + TypeScript 5.7 + Vite 6
- **Estado & Data Fetching:** Zustand + TanStack Query (React Query) + React Router 7
- **Mapa & Geolocalización:** MapLibre GL JS + OpenFreeMap + OpenRouteService API
- **Backend & Serverless:** Supabase (PostgreSQL 15, Row Level Security, Realtime, Storage, Edge Functions Deno)
- **Estilos & UI Kit:** Tailwind CSS 4 + Radix UI + Lucide React + Framer Motion + react-hook-form + Zod
- **Notificaciones & PWA:** Web Push API (Service Worker VAPID) + `vite-plugin-pwa` (Workbox)
- **Internacionalización:** `react-i18next` (ES / EN)
- **Testing & Calidad:** Vitest 3 + React Testing Library + ESLint 9 + TypeScript `tsc`

---

## 🧪 Pruebas y Comprobación de Calidad

```bash
# Ejecutar la suite de pruebas (Vitest)
npm test

# Verificación de tipos TypeScript
npm run typecheck

# Linter de código
npm run lint

# Claves de traducción ES/EN al día
npm run check:i18n

# Lo que debe pasar antes de dar un cambio por terminado
npm run typecheck && npx vitest run && npx eslint src
```

---

## 🤝 Contribuir

Revisa la guía [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) para conocer el flujo de trabajo, estándares de código, seguridad en migraciones SQL y cómo enviar Pull Requests.

La documentación viva está en `docs/`: [ROADMAP](docs/ROADMAP.md) (qué está hecho y qué falta), [DATABASE](docs/DATABASE.md) (el esquema y por qué es así), [CONTRIBUTING](docs/CONTRIBUTING.md), [SALAS](docs/SALAS.md) (código de sala y direcciones), [CHANGELOG](docs/CHANGELOG.md), [NOTIFICATIONS_AND_MODERATION](docs/NOTIFICATIONS_AND_MODERATION.md) y [PWA_UPDATE](docs/PWA_UPDATE.md). Para ubicarte en el código, [docs/REPO_MAP.md](docs/REPO_MAP.md) dice qué hay en cada carpeta y dónde tocar para cada cambio. Si trabajas con un agente de IA, las reglas del repositorio están en [CLAUDE.md](CLAUDE.md); `npm run gen:agents` regenera desde ahí los archivos para otras herramientas.

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.
