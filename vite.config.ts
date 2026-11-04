/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Key de Google Books (restringida a la app en Google Cloud). Viene del entorno al compilar:
    // ~/.config/biblioteca/signing.env en local y el secreto GOOGLE_BOOKS_KEY en GitHub Actions
    __GOOGLE_BOOKS_KEY__: JSON.stringify(process.env.GOOGLE_BOOKS_KEY ?? ''),
    // github (por defecto): APK de GitHub, con link a Ko-fi. play: Google Play prohíbe links de
    // donación externos, así que esa versión no lo muestra (DISTRIBUTION=play npm run build)
    __DISTRIBUTION__: JSON.stringify(process.env.DISTRIBUTION === 'play' ? 'play' : 'github'),
  },
  // Puerto fijo: lo usan el live reload de Android y el panel del navegador
  server: { port: 5180, strictPort: true },
});
