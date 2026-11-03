import { describe, expect, it } from 'vitest';
import { createDb, type RawDriver } from './driver';

/** Motor falso que anota el orden de lo que se ejecuta */
function recorder() {
  const log: string[] = [];
  const raw: RawDriver = {
    exec: async (sql) => void log.push(sql),
    all: async () => [],
    run: async (sql) => (log.push(sql), 1),
    close: async () => void log.push('close'),
  };
  return { raw, log };
}

describe('createDb', () => {
  it('guardar de inmediato espera a que termine la transacción en curso', async () => {
    const { raw, log } = recorder();
    const db = createDb(raw, { persist: async () => void log.push('persist') });

    let release!: () => void;
    const tx = db.transaction(async (t) => {
      await t.run('INSERT 1');
      await new Promise<void>((r) => (release = r));
      await t.run('INSERT 2');
    });
    await new Promise((r) => setTimeout(r, 0));
    const flushed = db.flush();
    release();
    await Promise.all([tx, flushed]);

    expect(log).toEqual(['BEGIN', 'INSERT 1', 'INSERT 2', 'COMMIT', 'persist']);
    await db.close();
  });
});
