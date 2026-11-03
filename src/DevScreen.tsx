// Pantalla temporal para probar la capa de datos. Se reemplaza por la UI real en la Fase 2.
import { useEffect, useState, type FormEvent } from 'react';
import { exportJson, importJson, STATUSES, type Book, type Library, type Status } from './data';

export function DevScreen({ lib }: { lib: Library }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = () => void lib.listBooks({ query }).then(setBooks);
    load();
    return lib.onChange(load);
  }, [lib, query]);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const title = String(form.get('title')).trim();
    if (!title) return;
    const author = String(form.get('author')).trim();
    const { duplicate } = await lib.addBook({
      title,
      authors: author ? [author] : [],
      year: null,
      cover_url: null,
      ol_key: null,
      isbn: null,
      pages: null,
    });
    setMessage(duplicate ? 'Ya estaba en la biblioteca' : `Agregado: ${title}`);
    formEl.reset();
  }

  async function download() {
    const blob = new Blob([JSON.stringify(await exportJson(lib, __APP_VERSION__), null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `biblioteca-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      const r = await importJson(lib, JSON.parse(await file.text()));
      setMessage(`Importado: ${r.added} nuevos, ${r.updated} actualizados, ${r.skipped} iguales`);
    } catch (error) {
      setMessage(String(error));
    }
  }

  return (
    <main className="dev">
      <header>
        <h1>Biblioteca</h1>
        <small>Pantalla de prueba de datos · v{__APP_VERSION__}</small>
      </header>

      <form onSubmit={add} className="row">
        <input name="title" placeholder="Título" aria-label="Título" />
        <input name="author" placeholder="Autor" aria-label="Autor" />
        <button>Agregar</button>
      </form>

      <div className="row">
        <input
          type="search"
          placeholder="Buscar"
          aria-label="Buscar"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" onClick={download}>
          Exportar JSON
        </button>
        <label className="button">
          Importar JSON
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
      </div>

      {message && <p className="message">{message}</p>}
      <p className="count">{books.length} libros</p>

      <ul>
        {books.map((b) => (
          <li key={b.id}>
            <div>
              <strong>{b.title}</strong>
              <span>{b.authors.join(', ')}</span>
            </div>
            <select
              aria-label="Estado"
              value={b.status}
              onChange={(e) => lib.updateBook(b.id, { status: e.target.value as Status })}
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button type="button" onClick={() => lib.deleteBook(b.id)} aria-label="Borrar">
              ×
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
