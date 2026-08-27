/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Versión: MAJOR.MINOR+COMMITS (p. ej. 0.6+180), de package.json más el número
// de commits.
//
// Antes el número del medio salía de buscar en SPRINTS_STATUS.md el sprint
// marcado "En progreso". Eso ataba el build a un documento de seguimiento, y
// para cuando se retiró ese documento ya llevaba tiempo sin funcionar: ningún
// sprint estaba marcado en progreso, la expresión regular no casaba y todos los
// builds salían como "0.0+N".
//
// Si git no está disponible (una exportación en zip), se cae a la versión de
// package.json a secas.
// ---------------------------------------------------------------------------
function computeAppVersion(): string {
  const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'))
  const [major, minor] = (pkg.version as string).split('.')
  try {
    const commits = execSync('git rev-list --count HEAD', { stdio: ['pipe', 'pipe', 'ignore'] })
      .toString()
      .trim()
    return `${major}.${minor}+${commits}`
  } catch {
    return pkg.version as string
  }
}

function updateInfoJson(version: string): string {
  const changelog = readFileSync(path.resolve(__dirname, 'docs/CHANGELOG.md'), 'utf8')
  const improvements = changelog
    .split('\n')
    .filter((line) => line.trim().startsWith('-'))
    .map((line) => line.replace(/^\s*-\s*/, '').trim())

  return JSON.stringify({ version, buildId: BUILD_ID, improvements })
}

function updateInfoPlugin(version: string): Plugin {
  return {
    name: 'udp-map-update-info',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/update-info.json')) return next()
        res.setHeader('Content-Type', 'application/json')
        res.end(updateInfoJson(version))
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'update-info.json',
        source: updateInfoJson(version),
      })
    },
  }
}

const APP_VERSION = computeAppVersion()

// Identifies the deployment. The version string can repeat across deploys
// (Vercel builds from a shallow clone, so the commit count is not the real one),
// so update detection uses this instead.
// ponytail: local builds share the literal 'dev', so the banner never fires
// outside Vercel. Techo: probar en local exige dos builds con id distinto —
// `VERCEL_GIT_COMMIT_SHA=a npm run build`, servirlo, y reconstruir con `=b`.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev'

export default defineConfig({
  // El puerto por defecto sigue siendo 5173, y no es una preferencia: es el
  // origen que tienen registrado el callback de Google OAuth y la lista CORS de
  // la Edge Function send-push. Levantar ahí es lo que hace que se pueda
  // iniciar sesión y probar el push en local.
  //
  // `PORT` existe para lo otro: arrancar una segunda instancia —el modo demo,
  // que no necesita ni OAuth ni push— sin pelearse con la primera. Vite no lee
  // esta variable por su cuenta.
  server: {
    port: Number(process.env.PORT) || 5173,
  },
  define: {
    // Injected at build-time; available globally as __APP_VERSION__ / __BUILD_ID__
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    tailwindcss(),
    updateInfoPlugin(APP_VERSION),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'push-sw.js'],
      manifest: {
        name: 'UDP Map',
        short_name: 'UDP Map',
        description:
          'Mapa colaborativo de pines, eventos y foro para la comunidad de la Universidad Diego Portales',
        theme_color: '#9d2235',
        background_color: '#ffffff',
        display: 'standalone',
        lang: 'es',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        importScripts: ['push-sw.js'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // `fic.png` son 5,4 MB —una foto de 2560x1707 guardada como PNG— y era
        // el 63% del precache entero. Precachear significa que TODO el que
        // instala o actualiza la aplicación se la descarga, aunque no llegue a
        // abrir nunca la ficha de Ingeniería, que es el único sitio donde se
        // usa. Y como el precache se rehace en cada versión, se la volvía a
        // descargar en cada actualización: por eso "Actualizar" tardaba tanto
        // que parecía colgado.
        //
        // Fuera del precache se sirve de la red la primera vez que alguien abre
        // esa ficha, y de ahí en adelante la cachea el navegador. El coste real
        // de sacarla es que esa portada no se ve sin conexión la primera vez.
        //
        // Lo que de verdad toca es reescalarla: a 800 px y en WebP son ~60 KB,
        // noventa veces menos, y entonces vuelve a caber en el precache sin
        // que nadie lo note.
        globIgnores: ['**/fic.png'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Tiles y glyphs de OpenFreeMap: cache-first para shell offline del mapa
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfreemap-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
          supabase: ['@supabase/supabase-js'],
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    css: false,
  },
})
