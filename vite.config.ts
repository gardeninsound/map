/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  // Served at the root of gardeninsound.website (public/CNAME). To move it under /map/ later,
  // set base: '/map/' — every asset URL goes through import.meta.env.BASE_URL.
  base: '/',
  plugins: [react()],
  // three pages: the map, /story/ (the story log, src/story/) and /admin/ (src/admin/); neither linked from the map
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        story: resolve(import.meta.dirname, 'story/index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
  test: { environment: 'jsdom', globals: true },
});
