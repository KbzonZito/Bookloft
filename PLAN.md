# Biblioteca — Hoja de ruta

> Estado: **v0.3.0**, fases 0 a 6 listas · Actualizado: 2026-11-04
> Qué está decidido y por qué (arquitectura, diseño, negocio, firma): [docs/DECISIONES.md](docs/DECISIONES.md). Cambios por versión: [CHANGELOG.md](CHANGELOG.md).

Niveles de pensamiento (esfuerzo sugerido para Claude):
🟢 mecánico (bajo) · 🟡 decisiones locales (medio) · 🟠 diseño con consecuencias (alto) · 🔴 difícil de revertir (máximo + modo plan)

| Fase | Contenido                                                                                                                                   | Nivel | Estado                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------- |
| 0    | Base: Vite + React + TS + Capacitor, estructura, lint/format/tests (como Printer Hub), emuladores teléfono y tablet, `android:live`, scrcpy | 🟡    | ✅ (scrcpy, opcional)                                                                                                |
| 1    | **Datos locales**: SQLite nativo y WASM, esquema con UUID, migraciones, repositorio, respaldo JSON, tests                                   | 🔴    | ✅                                                                                                                   |
| 2    | **UI**: portar estanterías, ficha, búsqueda, vista autor/saga e i18n; layouts adaptativos teléfono/tablet; modo noche                       | 🟠    | ✅ Falta reordenar arrastrando                                                                                       |
| 3    | **Agregar libros**: Open Library, escáner ISBN, compartir a la app, bandeja de entrada, OCR, IA con key propia                              | 🟠    | ✅ Falta probar en un teléfono real: escáner, compartir imagen desde Instagram e IA con una key real                 |
| 4    | **Bóveda EPUB local**: importar desde Archivos, leer metadatos (ya existe `epub.ts`), vincular, abrir en lector externo, compartir          | 🟡    | ✅ Falta probar abrir en un lector real (KOReader, Play Libros) y archivos grandes                                   |
| 5    | **Respaldos**: ZIP, Auto Backup, Google Drive (proyecto en Google Cloud, OAuth), restauración con fusión                                    | 🟠    | ✅ ZIP + Drive por la hoja de compartir. Falta el respaldo **automático** a Drive (después de elegir nombre y firma) |
| 6    | **Limpieza y optimización**: el repo solo con la app actual, código muerto fuera, licencia GPL-3.0, CI, APK de 81 a 41 MB                   | 🟡    | ✅ v0.3.0                                                                                                            |
| 7    | **Pro y propinas**: Google Play Billing (pago único Pro + propinas), flavor "GitHub" con link a Ko-fi                                       | 🟠    | Más adelante                                                                                                         |
| 8    | **Publicación**: cuenta Play (25 USD), política de privacidad, ficha, formulario de seguridad de datos, prueba cerrada                      | 🟡    | Más adelante                                                                                                         |
| 9    | Escritorio Mac/Windows/Linux (Tauri o Electron sobre la misma web)                                                                          | 🟠    | Futuro                                                                                                               |
| 10   | iOS                                                                                                                                         | 🟠    | Futuro                                                                                                               |

Flujo de trabajo: commits locales → APK de prueba local → **tú confirmas** → release numerado en GitHub/Play (`npm run release`). Las antiguas fases de migrar y apagar Cloudflare no hicieron falta: Cloudflare se eliminó el 2026-11-04.

### Pendiente antes de publicar (Fase 8)

- **Nombre** (candidatos: Velada, Cinta, Anaquel; Lomo descartado) e **ícono** nuevo. Ver docs/DECISIONES.md.
- **Respaldo automático a Drive**: necesita el nombre y la firma definitivos.
- Probar en un teléfono real: escáner, compartir desde Instagram, IA con una key real, abrir EPUB en un lector.

## Mejoras pendientes

Ideas para después de las fases. Varias venían de la antigua app web.

| Mejora                                                                                                                                   | Nivel | Estado                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------- |
| 🌍 Portada y datos en el idioma de la búsqueda                                                                                           | 🟡    | ✅ v0.2.0 (edición que coincide en Open Library)                            |
| 📚 Ordenar por saga dentro de cada autor                                                                                                 | 🟡    | ✅ v0.2.0 (editar saga a mano, leer "(Saga #2)" del título, ordenar con IA) |
| 📥 Importar notas de Obsidian (.md) y JSON                                                                                               | 🟡    | ✅ v0.2.0                                                                   |
| 🖼️ Elegir portada (otras ediciones, Apple Books, link o imagen propia)                                                                   | 🟡    | ✅ v0.2.0                                                                   |
| 🎲 **"¿Qué leo ahora?"** con IA: siguiente libro según sagas empezadas, prioridades y lo último leído (Haiku, fracción de centavo)       | 🟡    | ✅ v0.6.0                                                                   |
| 📈 **Progreso de saga**: "3 de 7 leídos" y el próximo libro destacado                                                                    | 🟢    | ✅ v0.6.0                                                                   |
| 🔔 **Aviso de saga**: cuando sale el siguiente libro de una saga que sigo (revisión periódica en Open Library)                           | 🟠    | ⏳                                                                          |
| 📅 **Resumen del año ("Wrapped")**: leídos, páginas, autores favoritos, mejor calificado; compartible como imagen                        | 🟡    | ⏳ (candidato a Pro)                                                        |
| 🎁 **Recomendar a un familiar**: compartir un libro con mi comentario y que caiga en su lista de deseos (link o archivo que la app abre) | 🟠    | ⏳                                                                          |
| 🔁 **Exportar a Obsidian**: guardar la biblioteca como .md en el mismo formato que se importa (ida y vuelta)                             | 🟡    | ⏳                                                                          |
| 🔀 Ordenar arrastrando dentro de "Mi orden"                                                                                              | 🟡    | ⏳                                                                          |
| 🤖 Recomendaciones con IA: "si te gustó X…", a partir de los libros con 4–5 estrellas                                                    | 🟡    | ⏳                                                                          |
| 📚 Catálogo OPDS para descargar la bóveda desde KOReader                                                                                 | 🟠    | ⏳                                                                          |
| ✉️ "Enviar a Kindle" por correo                                                                                                          | 🟡    | ⏳                                                                          |
| 🎥 Reels en video sin pantallazo (necesitaría un servidor con `yt-dlp`: choca con "sin servidor")                                        | 🔴    | Descartado por ahora                                                        |
| 📄 Importar desde Goodreads/StoryGraph (CSV)                                                                                             | 🟢    | ⏳                                                                          |

## Fase 6: cómo quedó (limpieza y optimización)

- **Sin restos de Cloudflare**: fuera el script `seed`, los comentarios y las secciones de migración. `~/dev/book_app` y los datos de prueba quedaron archivados en `~/dev/archive/` y se borraron.
- **Ejemplo sintético** (`src/dev/sample.ts`): ~60 clásicos en formato de notas; solo existe en `npm run dev`.
- **Código muerto**: `knip` corre en `npm run check`; un test avisa si queda un texto de traducción sin usar.
- **Repo**: licencia GPL-3.0, checks en cada pull request, Dependabot, plantillas de issues.
- **Peso**: APK de 81 a **41 MB** (solo ARM; x86 era para emuladores Intel). El SDK de Anthropic se carga al usar la IA: el código inicial bajó de 876 a 525 KB.
- **Uso diario**: al completar portadas de cientos de libros, la biblioteca se redibuja a lo más cada 400 ms en vez de por cada libro. Medido con 600 libros y la CPU 4× más lenta: el scroll queda casi igual que con 40 (19,6 vs 16,6 ms por cuadro), así que **no hace falta virtualizar** todavía.

### Optimización que queda para después

- **AAB en Play** (~25 MB por teléfono) y OCR de ML Kit **no empaquetado** (requiere parchear el plugin): solo vale la pena al publicar.
- `minifyEnabled`/`shrinkResources`: ~3 MB, pero hay que probar cada plugin con reglas de ProGuard.
- Retomar "completar datos" si se cierra la app a mitad. (Las portadas sin conexión ya están: v0.4.0, ~17 KB por libro, medido con 515 portadas = 8,5 MB.)
- `User-Agent` propio hacia Open Library (piden identificarse) usando HTTP nativo.
- Perfilar animaciones en un teléfono de gama baja real (el emulador no es representativo).
