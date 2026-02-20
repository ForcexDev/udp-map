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
- Las variables con prefijo `VITE_` se exponen al frontend

## Proceso de Pull Request

1. Crea una rama: `git checkout -b feature/mi-feature`
2. Haz tus cambios y prueba localmente
3. Verifica que `npx tsc --noEmit` pase sin errores
4. Haz push y abre un PR con una descripción clara
