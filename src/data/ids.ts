/** UUIDv7: los primeros 48 bits son el milisegundo, así los IDs quedan ordenados por fecha */
export function uuidv7(time = Date.now()): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 5, t = time; i >= 0; i--, t = Math.floor(t / 256)) b[i] = t % 256;
  b[6] = (b[6] & 0x0f) | 0x70; // versión 7
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 9562
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Fecha ISO UTC con milisegundos: se compara como texto para fusionar respaldos */
export const now = () => new Date().toISOString();
