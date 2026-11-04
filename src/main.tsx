import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { listenForShares } from './app/inbox';
import { LibraryProvider } from './app/library';
import { openLibrary } from './data';
import { systemLang, translate } from './i18n';
import { initOfflineCovers, syncOfflineCovers } from './app/offline-covers';
import { initLocalCovers } from './sources/covers';
import { purgeDeletedFiles } from './sources/vault';
import './ui/theme.css';
import './ui/app.css';

const root = createRoot(document.getElementById('root')!);
// La primera vez, crear la base tarda unos segundos: que se note que la app está viva
root.render(<p className="loading">{translate(systemLang(), 'app.loading')}</p>);

Promise.all([openLibrary(), initLocalCovers()]).then(
  async ([lib]) => {
    await initOfflineCovers(lib).catch(() => {});
    // Lo antes posible: si la app se abrió desde "Compartir", el plugin entrega lo compartido ahora
    listenForShares(lib);
    void purgeDeletedFiles(lib);
    // Portadas sin conexión: al abrir (sin apurar el arranque) y unos segundos después de cada cambio
    let sync: ReturnType<typeof setTimeout> | undefined;
    const later = (ms: number) => {
      clearTimeout(sync);
      sync = setTimeout(() => void syncOfflineCovers(lib), ms);
    };
    later(4000);
    lib.onChange(() => later(5000));
    // Para probar desde las herramientas de desarrollo (emulador por CDP); nunca en la app publicada
    if (import.meta.env.DEV) Object.assign(window, { __lib: lib });
    root.render(
      <StrictMode>
        <LibraryProvider lib={lib}>
          <App />
        </LibraryProvider>
      </StrictMode>,
    );
  },
  (error) =>
    root.render(
      <p className="loading">{translate(systemLang(), 'app.dbError', { msg: String(error) })}</p>,
    ),
);
