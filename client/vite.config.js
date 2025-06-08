import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills'; // From hakob-game-routes
import { VitePWA } from 'vite-plugin-pwa'; // From ethan-game-routes

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({ // Configuration from hakob-game-routes
      protocolImports: true, //
      global: true,        // Polyfill `global`
      process: true,       // Polyfill `process`
      buffer: true,        // Polyfill `Buffer`
    }),
    VitePWA({ // Configuration from ethan-game-routes
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'robots.txt',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'LoopZoo',
        short_name: 'LoopZoo',
        description: 'Chain as many animals as you can in LoopZoo!',
        theme_color: '#34d399', // Tailwind green-400
        background_color: '#f0fdf4',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});