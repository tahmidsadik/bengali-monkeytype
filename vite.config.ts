import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    // `pnpm dev:api` runs the Worker (API + D1) on 8787 during development
    proxy: { '/api': 'http://localhost:8787' },
  },
})
