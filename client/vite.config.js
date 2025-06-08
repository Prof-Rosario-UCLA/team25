import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills' // Import the plugin

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    nodePolyfills({ // Add the plugin to the plugins array
      // Options (optional, defaults are usually good):
      protocolImports: true, // Recommended for libraries that might use "node:" protocol imports
      global: true,        // Polyfill `global`
      process: true,       // Polyfill `process`
      buffer: true,        // Polyfill `Buffer`
      // You can exclude polyfills if you're sure they're not needed, e.g.:
      // exclude: ['fs', 'path'],
    })
  ],
})