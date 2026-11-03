import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { listenForShares } from './app/inbox';
import { LibraryProvider } from './app/library';
import { openLibrary } from './data';
import { systemLang, translate } from './i18n';
import { purgeDeletedFiles } from './sources/vault';
import './ui/theme.css';
import './ui/app.css';

const root = createRoot(document.getElementById('root')!);

openLibrary().then(
  (lib) => {
    // Lo antes posible: si la app se abrió desde "Compartir", el plugin entrega lo compartido ahora
    listenForShares(lib);
    void purgeDeletedFiles(lib);
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
