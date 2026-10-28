# Desarrollo

Esta guía prepara el entorno y el flujo de contribución. La ubicación del código
está en [repositorio](../referencia/repositorio.md); las reglas, en
[CLAUDE.md](../../CLAUDE.md).

## Entorno local

Usa Node.js 24, como CI, y el lockfile:

```bash
npm ci
cp .env.example .env
npm run dev
```

En PowerShell, `Copy-Item .env.example .env` sustituye a `cp`. Si la política
local bloquea `npm.ps1` o `npx.ps1`, usa `npm.cmd` y `npx.cmd`; no hace falta
cambiar la política del equipo.

Vite usa 5173 por defecto. Para otra instancia:

```bash
PORT=5199 npm run dev
```

```powershell
$env:PORT = '5199'
npm run dev
Remove-Item Env:PORT
```

El puerto no selecciona el backend. OAuth debe admitir el origen usado; CORS y
su extensión están en [despliegue](despliegue.md#configuracion-por-entorno).
`udp-map-demo` de `.claude/launch.json` usa `--mode demo`, pero la aplicación
no consulta ese modo para decidir si conecta a Supabase.

## Variables y modo demo

La plantilla es [`.env.example`](../../.env.example).

| Variable                        | Uso y ausencia                                      |
| ------------------------------- | --------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Junto con una clave pública activa el backend       |
| `VITE_SUPABASE_ANON_KEY`        | Clave pública; tiene precedencia sobre el alias     |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Alias si falta `ANON_KEY`                           |
| `VITE_GOOGLE_CLIENT_ID`         | Cliente del botón `GoogleLogin` activo              |
| `VITE_ORS_API_KEY`              | Rutas ORS; sin ella se intenta OSRM y después recta |
| `VITE_VAPID_PUBLIC_KEY`         | Suscripción push; debe concordar con el par Edge    |

`shared/lib/supabase.ts` crea el cliente solo si existen URL y una clave
pública. Si falta cualquiera, `supabase` es `null`. Sin VAPID puede haber backend
real con push sin configurar: no se convierte en demo.

Demo ofrece sesiones de estudiante y administrador. La sesión se recuerda en
`localStorage`; los almacenes de dominio viven en memoria y se pierden al
recargar. El editor interior arranca vacío para no inventar geometrías.
Reproduce operaciones y algunas cascadas, no toda la autorización, concurrencia
o persistencia del servidor. La tarjeta push no se ofrece allí.

Teselas, rutas y fuentes externas pueden necesitar red. La
[referencia PWA](../referencia/pwa.md) delimita cachés y funcionamiento sin conexión.

## Convenciones

Trabaja por dominio: `api.ts` para datos, `use*.ts` para hooks y `demoStore.ts`
junto a la feature. Usa `shared/` para reglas realmente compartidas. Hay
acoplamientos entre mapa, pines y mapeo; no los amplíes sin revisar el límite.

El patrón predominante usa Zustand para estado efímero y TanStack Query para
datos remotos. No es universal: autenticación, detección PWA y rutas tienen
otros ciclos. Los motivos y consecuencias están en
[arquitectura](../decisiones/arquitectura.md).

`shared/types/database.ts` es un espejo **manual** de lo que consulta el cliente.
Omite tablas internas a propósito. Actualízalo si cambia lo que lee el cliente;
no hay generación automática. `supabase gen types` sería otro flujo, no un paso
actual de CI.

Usa TypeScript estricto y evita `any`. Escribe comentarios en español que expliquen
restricciones y motivos. Para interfaz añade claves ES/EN y usa
`t('clave', 'respaldo')`; las utilidades puras reciben texto o usan funciones de
localización sin introducir hooks.

## Mapa y editor

El mapa público vive en `features/map`; `MappingCanvas` crea otra instancia
para el editor. Hay comunicación mediante `uiStore` y también propiedades y
callbacks. Conserva las restricciones de
[marcadores](../../CLAUDE.md#reglas-del-mapa-que-no-hay-que-perder).

La planta de visualización es contexto de facultad; el formulario de creación
puede restringirse al edificio. Los códigos y la importación tienen su contrato
en [salas](../referencia/salas.md).

Exportar mapeo descarga `buildings.ts` y `areas.ts` por el navegador. No escribe
en `src/shared/data` ni conecta esos archivos al demo. Integrar ese resultado
requiere trabajo explícito; no es un respaldo operativo completo.

## Datos y errores

Toda función nueva debe funcionar con y sin Supabase. No conviertas una carga
fallida en una lista vacía. Traduce rechazos reconocibles del servidor sin perder
su explicación. Cuando una operación necesita una RPC transaccional, no la
sustituyas por escrituras independientes del cliente.

`useGuard` consulta `can()` para la acción y abre `LoginModal` si no autoriza;
devuelve false para que el manejador no continúe. Esto aplica a las acciones
que usan ese guard, no a toda navegación o interacción de un invitado.

Para esquema, RLS y funciones sigue
[aplicar un cambio de base](despliegue.md#aplicar-un-cambio-de-base). La
interfaz no demuestra autorización y un archivo no acredita despliegue.

## Scripts y contribución

`npm run dev` desarrolla; `npm run preview` sirve el build; `npm run build`
verifica tipos y construye; `npm run format` formatea el código con Prettier
(`npm run format:check` verifica). Consulta [validación](validacion.md) para pruebas y CI.

Después de editar `CLAUDE.md`:

```bash
npm run gen:agents
node scripts/gen_agents.mjs --check
```

El generador guarda copias completas y solo escribe si cambian. Su comprobación
compara bytes; los finales de línea pueden importar. Los enlaces de la copia
de Copilot se adaptan a su ubicación en .github desde el generador.

`scripts/gen_seed_full.ts` genera el seed público desde el catálogo. No se
ejecuta al arrancar ni en CI, no siembra perímetros ni correos admin.
`scripts/generate-icons.mjs` puede sobrescribir iconos: revisa sus destinos.

Antes de una PR ejecuta las comprobaciones obligatorias, revisa el diff y actualiza
la documentación principal. Describe problema, resultado y validación.
No atribuyas commits o PR a una IA. No cierres tareas que dependan de aplicar
SQL o comprobar datos y dispositivos.

Para el flujo habitual de contribución, parte de `main` actualizado y crea una
rama con propósito, como `feature/nuevo-foro` o `fix/boton-login`. Usa un título
claro y enlaza el issue cuando exista, por ejemplo `Closes #12` cuando la PR
realmente lo cierre. La verificación local precede a abrir la PR; CI usa el
lint completo, no solo el subconjunto de `src`.
