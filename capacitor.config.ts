import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Provisional hasta tener nombre: el appId no se puede cambiar después de publicar en Play
  appId: 'dev.martinvergara.biblioteca',
  appName: 'Biblioteca',
  webDir: 'dist',
  android: {
    // Solo para diagnosticar un APK de producción desde chrome://inspect: WEBVIEW_DEBUG=1 npm run apk
    webContentsDebuggingEnabled: process.env.WEBVIEW_DEBUG === '1' || undefined,
  },
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
      iosIsEncryption: false,
    },
  },
};

export default config;
