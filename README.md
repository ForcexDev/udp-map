<div align="center">

# 📍 UDP Map

**Mapa colaborativo de pines, reportes y utilidades para la Universidad Diego Portales**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![MapLibre](https://img.shields.io/badge/MapLibre-GL-42A5F5?logo=maplibre&logoColor=white)](https://maplibre.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-yellow.svg)](LICENSE)

</div>

---

## 🌟 Descripción

UDP Map permite a la comunidad de la Universidad Diego Portales crear **pines geolocalizados en tiempo real** en los campus para compartir información útil — salas libres, comida, zonas de estudio, objetos perdidos y más. Todo esto en una PWA gratuita y mobile-first.

> **Estado del Proyecto:** Sprint 1 (Fundaciones) y Sprint 2 (Motor de Pines) completados. Modo Invitado activo.

### Funcionalidades

| Función | Descripción |
|---|---|
| 🗺️ **Mapa Interactivo** | Motor **MapLibre GL + OpenFreeMap** (3 campus) con marcadores por categoría |
| 📍 **Pines y Reportes** | Crea pines de lugares o reportes temporales con fecha de expiración automática |
| 📸 **Fotos y Comentarios** | Sube múltiples fotos (optimizadas) y comenta en tiempo real en cada pin |
| 🧭 **Ruteo Peatonal e Indoor** | Calcula rutas a pie (incluyendo accesibles) y visualiza planos de edificios por piso |
| 🔐 **Login Exclusivo UDP** | Autenticación con Google limitada a `@mail.udp.cl` con roles (Admin / Mod / Estudiante / Invitado) |
| 👁️ **Modo Invitado** | Acceso de solo lectura para quienes no han iniciado sesión |
| 🌐 **Bilingüe** | Interfaz completa en Español e Inglés (ES/EN) |
| 🔍 **Filtros Avanzados** | Filtra en vivo por tipo, categoría, facultad y favoritos |

---

## 🚀 Inicio Rápido

### Requisitos

- [Node.js](https://nodejs.org/) v18+
- Un proyecto en [Supabase](https://supabase.com) con Google Auth configurado (`@mail.udp.cl`)

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/ForcexDev/udp-map.git
cd udp-map

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus URLs y API keys

# 4. Iniciar servidor de desarrollo
npm run dev
```

La app estará disponible en `http://localhost:5173` (puerto por defecto de Vite).

### Modo Demo (sin backend)
Si no configuras Supabase (dejando las variables de entorno vacías), la app corre automáticamente en **modo demo** con datos en memoria. Esto te permite probar la interfaz, crear pines, ver rutas y mapas indoor sin necesidad de conectarte a una base de datos real.

---

## 📂 Estructura del Proyecto

```text
src/
├── app/                  → Punto de entrada, rutas y layout principal
├── features/
│   ├── auth/             → Sesión, permisos y modo invitado
│   ├── map/              → MapLibre, campus, filtros, indoor y ruteo
│   ├── pins/             → Motor común: fotos, comentarios, expiración y votos
│   └── profile/          → Perfil de usuario y pines favoritos
├── shared/               → UI components (Tailwind + Radix), utilidades, tipos
supabase/
├── migrations/           → Esquema SQL (pines, roles, RLS, RPCs)
├── seed/                 → Datos iniciales (campus, facultades, categorías)
└── functions/            → Edge Functions (borrado de pines vencidos en Storage)
```

---

## 🔐 Variables de Entorno

| Variable | Descripción | ¿Expuesta al frontend? |
|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | ✅ Sí |
| `VITE_SUPABASE_ANON_KEY` | Clave pública/anónima de Supabase | ✅ Sí |
| `VITE_ORS_API_KEY` | (Opcional) OpenRouteService para ruteo peatonal real | ✅ Sí |

> [!NOTE]
> Google OAuth se configura directamente en **Supabase Dashboard → Authentication → Providers → Google**, restringiendo el acceso al dominio `mail.udp.cl`.

> [!IMPORTANT]
> **Nunca subas `.env`** — ya está en `.gitignore`.
> Usa `.env.example` como plantilla y comparte las keys de forma segura con tu equipo.

---

## 🛠️ Stack Tecnológico

- **Frontend:** React 19 + TypeScript + Vite 6
- **Mapa y Ruteo:** MapLibre GL + OpenFreeMap + OpenRouteService
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage, Edge Functions, pg_cron)
- **Estado y Fetching:** Zustand + TanStack Query + React Router
- **Estilos y UI:** Tailwind CSS 4 + Radix UI + Lucide React + react-hook-form + zod
- **PWA:** vite-plugin-pwa (Workbox)

---

## 🤝 Contribuir

Consulta [CONTRIBUTING.md](docs/CONTRIBUTING.md) para instrucciones de configuración, estilo de código y proceso de Pull Requests.

---

## 📄 Licencia

Este proyecto está bajo la [Licencia MIT](LICENSE).
