import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LibraryProvider } from './app/library';
import { openLibrary } from './data';
import { systemLang, translate } from './i18n';
import './ui/theme.css';
import './ui/app.css';

const root = createRoot(document.getElementById('root')!);

openLibrary().then(
  (lib) =>
    root.render(
      <StrictMode>
        <LibraryProvider lib={lib}>
          <App />
        </LibraryProvider>
      </StrictMode>,
    ),
  (error) =>
    root.render(
      <p className="loading">{translate(systemLang(), 'app.dbError', { msg: String(error) })}</p>,
    ),
);
