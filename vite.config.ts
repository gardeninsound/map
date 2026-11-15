/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  // Served at the root of gardeninsound.website (public/CNAME). To move it under /map/ later,
  // set base: '/map/' — every asset URL goes through import.meta.env.BASE_URL.
  base: '/',
  plugins: [react()],
  // two pages: the map, and /story/ (the story log, src/story/; not linked from the map yet)
  build: {
    rolldownOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), story: resolve(import.meta.dirname, 'story/index.html') },
    },
  },
  test: { environment: 'jsdom', globals: true },
});
