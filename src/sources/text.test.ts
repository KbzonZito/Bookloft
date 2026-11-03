import { describe, expect, it } from 'vitest';
import { findIsbns, guessQueries, isbn10to13, similarTitle, titleLines } from './text';

describe('ISBN', () => {
  it('encuentra ISBN-13 e ISBN-10 válidos y los deja en 13 dígitos', () => {
    // Los dos son el mismo libro: aparece una sola vez
    expect(findIsbns('ISBN 978-0-7653-5037-4 y también 0765350378')).toEqual(['9780765350374']);
    expect(findIsbns('código 9788499089515 en la contratapa')).toEqual(['9788499089515']);
  });

  it('ignora números que no son ISBN', () => {
    expect(findIsbns('teléfono +56 9 1234 5678 y 1234567890123')).toEqual([]);
    expect(findIsbns('9780765350375')).toEqual([]); // dígito verificador malo
  });

  it('convierte ISBN-10 a 13', () => {
    expect(isbn10to13('0765350378')).toBe('9780765350374');
    expect(isbn10to13('080442957X')).toBe('9780804429573');
  });
});

describe('títulos posibles', () => {
  it('prefiere lo que está entre comillas y salta el ruido de Instagram', () => {
    const caption = `@libreria.cozy
Hoy terminé «El nombre del viento» y estoy en shock
#fantasia #booktok
1.234 me gusta`;
    expect(guessQueries(caption)).toEqual([
      'El nombre del viento',
      'Hoy terminé «El nombre del viento» y estoy en shock',
    ]);
  });

  it('del OCR toma primero las líneas más grandes', () => {
    expect(
      titleLines([
        { text: 'NEW YORK TIMES BESTSELLER', height: 12, top: 0 },
        { text: 'PIRANESI', height: 80, top: 100 },
        { text: 'Susanna Clarke', height: 30, top: 300 },
        { text: '@booksta', height: 40, top: 400 },
      ]),
    ).toEqual(['PIRANESI', 'Susanna Clarke', 'NEW YORK TIMES BESTSELLER']);
  });

  it('junta un título partido en varias líneas grandes, en orden de lectura', () => {
    // Lo que leyó ML Kit de la portada de Project Hail Mary en el emulador
    expect(
      titleLines([
        { text: 'PRO JE CT', height: 24, top: 17 },
        { text: 'HAIL', height: 60, top: 45 },
        { text: 'MARY', height: 60, top: 110 },
        { text: "'Original, compelling and fun'", height: 8, top: 180 },
        { text: 'ANDY.', height: 40, top: 330 },
        { text: 'WEIR.', height: 60, top: 375 },
        { text: 'THE MULTIMILLION-COPY BESTSELLING AUTHOR OF', height: 9, top: 445 },
      ])[0],
    ).toBe('HAIL MARY ANDY WEIR');
  });
});

describe('títulos parecidos', () => {
  it('acepta ediciones y subtítulos, rechaza coincidencias de una palabra', () => {
    expect(similarTitle('Elantris', 'Elantris (Tenth Anniversary Edition)')).toBe(true);
    expect(similarTitle('El nombre del viento', 'El Nombre del Viento')).toBe(true);
    expect(similarTitle('The Way of Kings', 'Way of Kings, The')).toBe(true);
    expect(
      similarTitle(
        'Un libro que no tengo',
        'Tengo Miedo : un Libro para Vencer Aquello Que Nos Hace Sentir Diminutos',
      ),
    ).toBe(false);
    expect(similarTitle('Dune', 'Dune Messiah')).toBe(true);
    expect(similarTitle('It', 'It')).toBe(true);
  });
});
