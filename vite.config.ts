import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Se publica en GitHub Pages bajo /653gim_app/ (prueba en /653gim_app/v2/ con BASE). Comparte dominio
// con otras apps (fspdev.github.io): por eso todo lo que se guarda en el teléfono lleva el prefijo "g653:".
const base = process.env.BASE ?? '/653gim_app/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // "prompt": la app nueva no se activa sola; el socio elige cuándo (nunca en medio de un entreno).
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: '653 Gimnasio',
        short_name: '653 Gimnasio',
        id: base,
        description: 'Tu plan de entrenamiento, armado por tu profe.',
        lang: 'es-AR',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // La app completa (incluidas las tipografías, que van empaquetadas) queda guardada: abre sin señal.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        // Sin reglas de caché en tiempo de ejecución: todo queda en el teléfono.
      },
    }),
  ],
})
