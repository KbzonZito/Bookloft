/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // github (por defecto): APK de GitHub, con link a Ko-fi. play: Google Play prohíbe links de
    // donación externos, así que esa versión no lo muestra (DISTRIBUTION=play npm run build)
    __DISTRIBUTION__: JSON.stringify(process.env.DISTRIBUTION === 'play' ? 'play' : 'github'),
  },
  // Puerto fijo: lo usan el live reload de Android y el panel del navegador
  server: { port: 5180, strictPort: true },
});
