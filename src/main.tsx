import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { openLibrary } from './data';
import { DevScreen } from './DevScreen';
import './dev.css';

const root = createRoot(document.getElementById('root')!);

openLibrary().then(
  (lib) =>
    root.render(
      <StrictMode>
        <DevScreen lib={lib} />
      </StrictMode>,
    ),
  (error) =>
    root.render(<pre className="dev">No se pudo abrir la base de datos: {String(error)}</pre>),
);
