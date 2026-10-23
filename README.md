# UDP Map

Mapa colaborativo para la comunidad de la Universidad Diego Portales: lugares,
avisos temporales, eventos, foro y orientación por el campus. Aplicación React y
TypeScript con MapLibre, Supabase y soporte PWA.

Puedes consultar el mapa sin sesión. Para publicar se requiere una cuenta
`@mail.udp.cl`; las acciones dependen del rol y de las autorizaciones del servidor.
La interfaz admite español e inglés, con traducciones aún incompletas.

## Arranque rápido

Usa Node.js 24, como CI:

~~~bash
git clone https://github.com/ForcexDev/udp-map.git
cd udp-map
npm ci
cp .env.example .env
npm run dev
~~~

En PowerShell, copia la plantilla con `Copy-Item .env.example .env`. El servidor
usa `http://localhost:5173`.

Sin URL y clave pública de Supabase, la aplicación funciona en **modo demo**, con
sesiones de prueba y datos en memoria. No necesita un backend Supabase, pero
mapas base, rutas y fuentes externas dependen de red o caché previa. El mapeo
interior demo empieza vacío: se dibuja desde el editor.

Para conectar un backend y configurar Google o push, sigue
[desarrollo](docs/guias/desarrollo.md) y [despliegue](docs/guias/despliegue.md).
No subas `.env` al repositorio.

## Qué ofrece

- Mapa con filtros, edificios, plantas, salas y fichas de facultad.
- Pines de lugares, eventos y reportes, con fotos, comentarios, votos y caducidad.
- Calendario y RSVP, foro con respuestas agrupadas y menciones, perfiles e insignias.
- Avisos personales y Web Push; administración, denuncias y editor de mapeo.
- Rutas exteriores y guía contextual por pasos. La guía no calcula un grafo
  interior ni acredita accesibilidad; los respaldos de rutas tienen limitaciones.

El detalle está en el [índice documental](docs/README.md) y el
[plan vivo](docs/ROADMAP.md). Consulta dependencias y versiones en
[package.json](package.json).

## Trabajar en el proyecto

Lee las [reglas](CLAUDE.md), la [referencia del código](docs/referencia/repositorio.md)
y la [guía de validación](docs/guias/validacion.md). Antes de cerrar un cambio:

~~~bash
npm run typecheck
npx vitest run
npx eslint src
~~~

El software se distribuye bajo la [licencia MIT](LICENSE).
