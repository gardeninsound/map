/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub repo name → served at <user>.github.io/bearisland-map/
  base: '/bearisland-map/',
  plugins: [react()],
  // west-seattle-map is linked from ../west-seattle-map; make it share our React.
  resolve: { dedupe: ['react', 'react-dom'] },
  test: { environment: 'jsdom', globals: true },
});
