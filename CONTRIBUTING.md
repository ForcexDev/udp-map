# Contribuir a UDP Map

¡Gracias por tu interés en contribuir! 🎉

## Inicio Rápido

1. **Haz fork** del repo y clona tu fork
2. **Instala** dependencias: `npm install`
3. **Configura el entorno**: Copia `.env.example` a `.env.local` y llena tus API keys
4. **Inicia** el servidor: `npm run dev`

## Estructura del Proyecto

```
src/
├── app/            → Punto de entrada (App.tsx, index.tsx)
├── components/     → Componentes de UI en React
│   └── Map/        → Componentes del mapa (MapView, MapHUD, MapMarker)
├── config/         → Tipos y constantes compartidas (types.ts, constants.ts)
├── hooks/          → Hooks personalizados (usePosts, useUserSession)
├── services/       → Llamadas a APIs backend (Supabase, Gemini AI)
├── utils/          → Funciones utilitarias (mapUtils)
├── styles/         → Hojas de estilo CSS
└── i18n.ts         → Internacionalización (Español/Inglés)
```

## Autenticación

Este proyecto usa **Supabase Auth con Google Provider**. El flujo es:

1. El usuario hace clic en "Iniciar con Google"
2. Supabase redirige a Google → el usuario acepta → vuelve a la app
3. Supabase crea una sesión autenticada (`auth.uid()`)
4. El perfil se crea/actualiza en la tabla `profiles` con el UUID de Supabase Auth
5. Row Level Security (RLS) protege los datos por usuario

> **Nota**: Google OAuth se configura en el **Supabase Dashboard** (Authentication → Providers → Google), no como variable de entorno.

## Guías de Estilo

### Código
- **TypeScript** — Todos los archivos usan tipado estricto
- **Componentes funcionales** — Usa el patrón `FC<Props>` con hooks
- **Nombres** — PascalCase para componentes, camelCase para funciones/variables

### Traducciones (i18n)
- Todos los textos visibles al usuario deben pasar por `i18n.ts`
- Usa `t('clave', lang)` para textos estáticos
- Usa `catLabel(cat, lang)` / `facName(fac, lang)` para datos dinámicos
- Siempre agrega las traducciones en `es` y `en`

### Agregar un Componente Nuevo
1. Crea el archivo en `src/components/`
2. Importa los tipos desde `../config/types`
3. Acepta el prop `lang` si el componente muestra texto al usuario
4. Exporta como default

### Variables de Entorno
- **Nunca** subas `.env.local` — contiene API keys reales
- `.env.example` es la plantilla — mantenla actualizada si agregas nuevas variables
- Las variables con prefijo `VITE_` se exponen al frontend (es normal y seguro)
- La seguridad de datos la maneja **Supabase RLS**, no las keys

### Seguridad (RLS)
El proyecto usa Row Level Security en Supabase para proteger datos:

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | Todos | Solo tu perfil | Solo tu perfil | — |
| `posts` | Todos | Como tú mismo | Votos (todos) | Solo tus posts |
| `chat` | Todos | Como tú mismo | — | — |

## Despliegue y Web App (Vercel)

El proyecto está configurado para desplegarse automáticamente en Vercel:

1. Las variables de entorno (`GEMINI_API_KEY`, etc.) se configuran en el **Dashboard de Vercel**, no en el código.
2. El repositorio es público, pero las claves están protegidas.

## App Móvil (PWA)

El proyecto es una **Progressive Web App (PWA)**. Esto permite:
- "Instalar" la web como una app en Android/iOS desde el navegador.
- Funcionar offline (cacheo básico).
- Recibir notificaciones push (vía Web Push API).

Para generar una versión de Play Store (.apk), usamos **Bubblewrap** o **Capacitor**.

## Proceso de Pull Request

1. Crea una rama: `git checkout -b feature/mi-feature`
2. Haz tus cambios y prueba localmente
3. Verifica que `npx tsc --noEmit` pase sin errores
4. Haz push y abre un PR con una descripción clara
