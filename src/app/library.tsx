// La biblioteca abierta, disponible para toda la UI, y hooks que se refrescan solos cuando cambia
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Book, Library } from '../data';

const Ctx = createContext<Library | null>(null);

export function LibraryProvider({ lib, children }: { lib: Library; children: ReactNode }) {
  return <Ctx.Provider value={lib}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const lib = useContext(Ctx);
  if (!lib) throw new Error('useLibrary fuera de LibraryProvider');
  return lib;
}

/** Todos los libros vivos. Con unos cientos de libros, filtrar en memoria es instantáneo. */
export function useAllBooks(): Book[] | null {
  const lib = useLibrary();
  const [books, setBooks] = useState<Book[] | null>(null);
  useEffect(() => {
    let alive = true;
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      last = performance.now();
      void lib.listBooks().then((b) => alive && setBooks(b));
    };
    // Un cambio del usuario se ve al tiro; una ráfaga (completar portadas de cientos de libros)
    // recarga a lo más cada 400 ms en vez de redibujar toda la biblioteca por cada libro
    const onChange = () => {
      if (timer) return;
      const wait = 400 - (performance.now() - last);
      if (wait <= 0) load();
      else timer = setTimeout(() => ((timer = undefined), load()), wait);
    };
    load();
    const stop = lib.onChange(onChange);
    return () => {
      alive = false;
      clearTimeout(timer);
      stop();
    };
  }, [lib]);
  return books;
}

/** Un ajuste guardado en la base, con su valor por defecto mientras carga */
export function useSetting<T>(key: string, fallback: T): [T, (value: T) => void] {
  const lib = useLibrary();
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    let alive = true;
    const load = () => void lib.getSetting(key, fallback).then((v) => alive && setValue(v));
    load();
    const stop = lib.onChange(load);
    return () => {
      alive = false;
      stop();
    };
  }, [lib, key]);
  return [
    value,
    (v: T) => {
      setValue(v);
      void lib.setSetting(key, v);
    },
  ];
}
