// Portada de un libro: la imagen de Open Library o, si no hay, una tela de encuadernación con el título
import { memo, useEffect, useState } from 'react';
import type { Book } from '../data';
import { localCoverSrc } from '../sources/covers';

// Telas apagadas, para que las portadas sin imagen no griten más que las reales
const CLOTH = [
  '#3f5a4c',
  '#6e4b3a',
  '#4b5a72',
  '#6a4560',
  '#5d6a3e',
  '#7a6038',
  '#3f4f52',
  '#6f3d3a',
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

const clothColor = (title: string) => CLOTH[hash(title) % CLOTH.length];

/** Open Library devuelve un pixel en blanco si no tiene la portada; con default=false responde 404 */
function coverSrc(url: string | null, size: 'M' | 'L' = 'M') {
  if (!url) return null;
  if (!url.includes('covers.openlibrary.org')) return url;
  const sized = url.replace(/-[SML]\.jpg/, `-${size}.jpg`);
  return sized.includes('?') ? sized : `${sized}?default=false`;
}

/** La portada que se muestra: la propia (imagen del teléfono) gana sobre la de internet */
export function bookCover(book: Pick<Book, 'cover_url' | 'cover_path'>, size: 'M' | 'L' = 'M') {
  return localCoverSrc(book.cover_path ?? null) ?? coverSrc(book.cover_url, size);
}

/**
 * Solo las fuentes conocidas responden con CORS: con ellas se pide la imagen "anónima" para poder
 * leer su color. Un link pegado de otro sitio se muestra igual, sin tinte.
 */
const CORS_HOSTS =
  /^(https:\/\/(covers\.openlibrary\.org|archive\.org|[\w-]+\.mzstatic\.com|localhost)\/|data:)/;
const crossOriginFor = (src: string) => (CORS_HOSTS.test(src) ? 'anonymous' : undefined);

// Color dominante de cada portada, calculado una vez por sesión
const colors = new Map<string, Promise<string | null>>();

/** Promedio de la imagen, pesando más los píxeles con color: así el gris del fondo no gana */
function coverColor(book: Book): Promise<string | null> {
  const src = bookCover(book);
  if (!src) return Promise.resolve(clothColor(book.title));
  if (!crossOriginFor(src)) return Promise.resolve(null);
  let p = colors.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 12;
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(img, 0, 0, 12, 12);
          const data = ctx.getImageData(0, 0, 12, 12).data;
          let r = 0;
          let g = 0;
          let b = 0;
          let w = 0;
          for (let i = 0; i < data.length; i += 4) {
            const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]];
            const sat = Math.max(pr, pg, pb) - Math.min(pr, pg, pb);
            const weight = 1 + sat / 16;
            r += pr * weight;
            g += pg * weight;
            b += pb * weight;
            w += weight;
          }
          resolve(`rgb(${Math.round(r / w)} ${Math.round(g / w)} ${Math.round(b / w)})`);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(clothColor(book.title));
      img.src = src;
    });
    colors.set(src, p);
  }
  return p;
}

export function useCoverColor(book: Book) {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void coverColor(book).then((c) => alive && setColor(c));
    return () => {
      alive = false;
    };
  }, [book.cover_url, book.cover_path, book.title]);
  return color;
}

export const Cover = memo(function Cover({
  book,
  size = 'M',
  eager = false,
}: {
  book: Book;
  size?: 'M' | 'L';
  eager?: boolean;
}) {
  const src = bookCover(book, size);
  // Por URL: si se cambia la portada, la nueva vuelve a intentarse aunque la anterior fallara
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  // La L tarda en llegar: mientras tanto se muestra la M que ya está en caché
  const loaded = size === 'M' || loadedSrc === src;
  const showImage = src && !failed;
  const medium = bookCover(book, 'M');
  const placeholder = size === 'L' && medium !== src ? medium : null;

  return (
    <div
      className="cover"
      style={showImage ? undefined : { background: clothColor(book.title) }}
      data-cover
    >
      {showImage ? (
        <>
          {placeholder && !loaded && (
            <img
              src={placeholder}
              alt=""
              draggable={false}
              crossOrigin={crossOriginFor(placeholder)}
            />
          )}
          <img
            src={src}
            alt=""
            draggable={false}
            crossOrigin={crossOriginFor(src)}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailedSrc(src)}
            onLoad={(e) =>
              e.currentTarget.naturalWidth < 10 ? setFailedSrc(src) : setLoadedSrc(src)
            }
            style={loaded ? undefined : { opacity: 0 }}
          />
        </>
      ) : (
        <div className="cover-cloth" aria-hidden>
          <span className="t">{book.title}</span>
          <span className="a">{book.authors[0]}</span>
        </div>
      )}
    </div>
  );
});
