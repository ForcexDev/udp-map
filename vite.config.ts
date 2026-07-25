/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Version: 0.SPRINT+COMMITS  (e.g. 0.5+170)
// Sprint is read from SPRINTS_STATUS.md, commit count from git history.
// Falls back to package.json version if git is unavailable (e.g. zip exports).
// ---------------------------------------------------------------------------
function computeAppVersion(): string {
  try {
    const sprintsStatus = readFileSync(path.resolve(__dirname, 'docs/SPRINTS_STATUS.md'), 'utf8')
    const sprintMatch = sprintsStatus.match(/\|\s*Sprint (\d+).*?\|\s*En progreso\s*\|/)
    const sprint = sprintMatch ? sprintMatch[1] : '0'
    const commits = execSync('git rev-list --count HEAD', { stdio: ['pipe', 'pipe', 'ignore'] })
      .toString()
      .trim()
    return `0.${sprint}+${commits}`
  } catch {
    // Fallback to package.json version if git is unavailable
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'))
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
