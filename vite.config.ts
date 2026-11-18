/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { changelogSection, formatAppVersion, isSemver } from './src/shared/utils/appVersion'

// ---------------------------------------------------------------------------
// Versión: SemVer de package.json (1.0.0-alpha.1) más el commit del build como
// metadato (+a1b2c3d). Contrato y flujo de publicación en
// docs/guias/despliegue.md#publicar-una-version; funciones puras en
// src/shared/utils/appVersion.ts.
// ---------------------------------------------------------------------------
const PKG_VERSION: string = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'),
).version

if (!isSemver(PKG_VERSION)) {
  throw new Error(`package.json: "${PKG_VERSION}" no es SemVer (p. ej. 1.0.0-alpha.1)`)
}

function git(command: string): string | null {
  try {
    return execSync(`git ${command}`, { stdio: ['pipe', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return null
  }
}

// Vercel entrega el SHA aunque clone sin historial; en local se pregunta a git y
// un árbol con cambios sin commitear se marca, para no confundirlo con el commit.
// Sin git (exportación en zip) la versión queda sin metadato.
const FULL_SHA = process.env.VERCEL_GIT_COMMIT_SHA ?? git('rev-parse HEAD')
const DIRTY = !process.env.VERCEL_GIT_COMMIT_SHA && Boolean(git('status --porcelain'))
const COMMIT = FULL_SHA ? `${FULL_SHA.slice(0, 7)}${DIRTY ? '.dirty' : ''}` : null
const APP_VERSION = formatAppVersion(PKG_VERSION, COMMIT)

// Identidad del despliegue para el aviso de actualización. En local vale 'dev'
// a propósito: el servidor y el bundle comparten id y el aviso no salta.
// Probarlo exige dos builds con id distinto —`VERCEL_GIT_COMMIT_SHA=a npm run
// build`, servirlo y reconstruir con `=b`—.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev'

function readChangelog(): string {
  return readFileSync(path.resolve(__dirname, 'docs/CHANGELOG.md'), 'utf8')
}

function updateInfoJson(improvements: string[]): string {
  return JSON.stringify({ version: APP_VERSION, buildId: BUILD_ID, improvements })
}

function updateInfoPlugin(): Plugin {
  return {
    name: 'udp-map-update-info',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/update-info.json')) return next()
        res.setHeader('Content-Type', 'application/json')
        res.end(updateInfoJson(changelogSection(readChangelog(), PKG_VERSION) ?? []))
      })
    },
    generateBundle() {
      // Publicar una versión sin sus novedades dejaría el aviso vacío: el build
      // falla en vez de desplegarla así.
      const improvements = changelogSection(readChangelog(), PKG_VERSION)
      if (!improvements?.length) {
        this.error(`docs/CHANGELOG.md no tiene puntos en la sección "## ${PKG_VERSION}"`)
      }
      this.emitFile({
        type: 'asset',
        fileName: 'update-info.json',
        source: updateInfoJson(improvements),
      })
    },
  }
}

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
    // Globales del bundle; tipos en src/vite-env.d.ts.
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    tailwindcss(),
    updateInfoPlugin(),
    VitePWA({
      registerType: 'prompt',
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
