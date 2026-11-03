import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Provisional hasta tener nombre: el appId no se puede cambiar después de publicar en Play
  appId: 'dev.martinvergara.biblioteca',
  appName: 'Biblioteca',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
      iosIsEncryption: false,
    },
  },
};

export default config;
