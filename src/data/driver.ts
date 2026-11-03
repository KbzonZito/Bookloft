// Una sola interfaz para SQLite: nativo en Android/iOS, WASM en el navegador y en los tests

export type Value = string | number | null;
export type Row = Record<string, Value>;

/** Lo mínimo que cada motor tiene que implementar */
export interface RawDriver {
  /** Varias sentencias sin parámetros (migraciones, BEGIN/COMMIT) */
  exec(sql: string): Promise<void>;
  all(sql: string, params?: Value[]): Promise<Row[]>;
  /** Devuelve cuántas filas cambiaron */
  run(sql: string, params?: Value[]): Promise<number>;
  close(): Promise<void>;
}

export interface Db {
  exec(sql: string): Promise<void>;
  all<T = Row>(sql: string, params?: Value[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: Value[]): Promise<T | undefined>;
  run(sql: string, params?: Value[]): Promise<number>;
  /** Todo lo que se haga con `tx` se confirma junto o no se confirma */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  /** Guarda ya, sin esperar el debounce, pero después de lo que esté en curso */
  flush(): Promise<void>;
  close(): Promise<void>;
}

interface Options {
  /** Se llama (con debounce) después de cada escritura, fuera de cualquier transacción */
  persist?: () => Promise<void>;
}

/**
 * Envuelve un motor en una cola: las operaciones corren de a una, así una transacción
 * nunca se mezcla con escrituras que lleguen mientras espera un `await`.
 */
export function createDb(raw: RawDriver, { persist }: Options = {}): Db {
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
    const result = queue.then(job);
    queue = result.catch(() => {});
    return result;
  };

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const wrote = () => {
    if (!persist) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void enqueue(persist), 300);
  };

  // Dentro de una transacción se usa el motor directo: la cola ya está tomada
  const scoped = (inner: RawDriver): Db => ({
    exec: (sql) => inner.exec(sql),
    all: <T>(sql: string, params?: Value[]) => inner.all(sql, params) as Promise<T[]>,
    get: async <T>(sql: string, params?: Value[]) =>
      ((await inner.all(sql, params))[0] as T | undefined) ?? undefined,
    run: (sql, params) => inner.run(sql, params),
    transaction: (fn) => fn(scoped(inner)),
    flush: () => Promise.reject(new Error('No se puede guardar dentro de una transacción')),
    close: () => Promise.reject(new Error('No se puede cerrar dentro de una transacción')),
  });

  return {
    exec: (sql) => enqueue(() => raw.exec(sql)).finally(wrote),
    all: <T>(sql: string, params?: Value[]) => enqueue(() => raw.all(sql, params)) as Promise<T[]>,
    get: async <T>(sql: string, params?: Value[]) =>
      ((await enqueue(() => raw.all(sql, params)))[0] as T | undefined) ?? undefined,
    run: (sql, params) => enqueue(() => raw.run(sql, params)).finally(wrote),
    transaction: <T>(fn: (tx: Db) => Promise<T>) =>
      enqueue(async () => {
        await raw.exec('BEGIN');
        try {
          const result = await fn(scoped(raw));
          await raw.exec('COMMIT');
          return result;
        } catch (error) {
          await raw.exec('ROLLBACK');
          throw error;
        }
      }).finally(wrote),
    flush: async () => {
      clearTimeout(saveTimer);
      if (persist) await enqueue(persist);
    },
    close: async () => {
      clearTimeout(saveTimer);
      await enqueue(async () => {
        if (persist) await persist();
        await raw.close();
      });
    },
  };
}
