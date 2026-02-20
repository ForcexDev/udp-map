<div align="center">

# 📍 UDP Map

**Mapa colaborativo en tiempo real para la Universidad Diego Portales**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-yellow.svg)](LICENSE)

</div>

---

## 🌟 Descripción

UDP Map permite a estudiantes, funcionarios e invitados crear **pines geolocalizados** en los campus de la Universidad Diego Portales para compartir información útil — salas libres, lugares de estudio, comida, zonas silenciosas, mesas de ping pong y más.

### Funcionalidades

| Función | Descripción |
|---|---|
| 🗺️ **Mapa Interactivo** | Mapa basado en Leaflet con 3 campus y zonas por facultad |
| 📌 **Pines en Tiempo Real** | Crea, vota y elimina reportes geolocalizados |
| 🤖 **Moderación con IA** | Google Gemini audita los posts antes de publicarse |
| 🔐 **Login con Google** | Supabase Auth con roles (Admin / Estudiante / Invitado) |
| 🌐 **Bilingüe** | Interfaz completa en Español e Inglés con detección automática |
| 💬 **Chat por Facultad** | Chat en tiempo real con bot de IA integrado |
| 📊 **Explorador de Facultad** | Navega los reportes de cada facultad con estadísticas |
| 🗑️ **Eliminar Propios** | Los creadores pueden eliminar sus propios reportes |

---

## 🚀 Inicio Rápido

### Requisitos

- [Node.js](https://nodejs.org/) v18+
- Un proyecto en [Supabase](https://supabase.com) con Google Auth configurado
- Una [API Key de Gemini](https://aistudio.google.com/apikey)

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/ForcexDev/udp-map.git
cd udp-map

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Edita .env.local con tus API keys reales

# 4. Iniciar servidor de desarrollo
npm run dev
```

La app estará disponible en `http://localhost:3000`

---

## 📂 Estructura del Proyecto

```
udp-map/
├── src/
│   ├── app/              → Punto de entrada (App.tsx, index.tsx)
│   ├── components/       → Componentes de React
│   │   └── Map/          → Componentes del mapa (MapView, MapHUD, MapMarker)
│   ├── config/           → Tipos y constantes compartidas
│   ├── hooks/            → Hooks personalizados de React
│   ├── services/         → Llamadas a APIs (Supabase, Gemini)
│   ├── utils/            → Funciones utilitarias
│   ├── styles/           → Hojas de estilo CSS
│   └── i18n.ts           → Traducciones (ES/EN)
├── index.html            → HTML de entrada
├── vite.config.ts        → Configuración de Vite
├── tsconfig.json         → Configuración de TypeScript
├── .env.example          → Plantilla de variables de entorno
└── package.json
```

---

## 🔐 Variables de Entorno

| Variable | Descripción | ¿Expuesta al frontend? |
|---|---|---|
| `GEMINI_API_KEY` | API key de Google Gemini para auditoría de posts | ❌ Solo servidor |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | ✅ Sí |
| `VITE_SUPABASE_ANON_KEY` | Clave pública/anónima de Supabase | ✅ Sí |

> [!NOTE]
> Google OAuth se configura directamente en **Supabase Dashboard → Authentication → Providers → Google**, no como variable de entorno.

> [!IMPORTANT]
> **Nunca subas `.env.local`** — ya está en `.gitignore`.
> Usa `.env.example` como plantilla y comparte las keys de forma segura con tu equipo.

---

## 🛠️ Stack Tecnológico

- **Frontend:** React 19 + TypeScript + Vite
- **Mapa:** Leaflet + React Leaflet
- **Backend:** Supabase (Postgres + Realtime + Storage + Auth)
- **Autenticación:** Supabase Auth con Google Provider
- **Seguridad:** Row Level Security (RLS) en Supabase
- **IA:** Google Gemini (moderación de contenido)
- **Iconos:** Lucide React
- **Estilos:** Tailwind CSS + CSS personalizado

---

## 🤝 Contribuir

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para instrucciones de configuración, estilo de código y proceso de Pull Requests.

---

## 📄 Licencia

Este proyecto está bajo la [Licencia MIT](LICENSE).
