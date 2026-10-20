import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/bunpro-api': {
        target: 'https://api.bunpro.jp',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/bunpro-api/, ''),
      },
    },
  },
})