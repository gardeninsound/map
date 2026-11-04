/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served at the root of gardeninsound.website (public/CNAME). To move it under /map/ later,
  // set base: '/map/' — every asset URL goes through import.meta.env.BASE_URL.
  base: '/',
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
});
