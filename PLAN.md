# Biblioteca — Hoja de ruta

> Estado: **v0.7.0** (en preparación), fases 0 a 6 listas y varias mejoras · Actualizado: 2026-11-04
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
| 7    | **Pro y propinas**: Google Play Billing (pago único Pro + propinas), flavor "GitHub" con link a Ko-fi                                       | 🟠    | 🟡 Ko-fi listo en la versión de GitHub (v0.7.0); Play Billing más adelante                                           |
| 8    | **Publicación**: cuenta Play (25 USD), política de privacidad, ficha, formulario de seguridad de datos, prueba cerrada                      | 🟡    | Más adelante                                                                                                         |
| 8.5  | **Kindle / KOReader** (ver abajo): servidor local en la app, catálogo OPDS, enviar EPUB del Kindle a la bóveda, sincronizar la página       | 🟠    | Próxima                                                                                                              |
| 9    | Escritorio Mac/Windows/Linux (Tauri o Electron sobre la misma web)                                                                          | 🟠    | Futuro                                                                                                               |
| 10   | iOS                                                                                                                                         | 🟠    | Futuro                                                                                                               |

Flujo de trabajo: commits locales → APK de prueba local → **tú confirmas** → release numerado en GitHub/Play (`npm run release`). Las antiguas fases de migrar y apagar Cloudflare no hicieron falta: Cloudflare se eliminó el 2026-11-04.

### Pendiente antes de publicar (Fase 8)

- **Nombre** (candidatos: Velada, Cinta, Anaquel; Lomo descartado) e **ícono** nuevo. Ver docs/DECISIONES.md.
- **Respaldo automático a Drive**: necesita el nombre y la firma definitivos.
- Probar en un teléfono real: escáner, compartir desde Instagram, IA con una key real (también "Que elija la IA" en ¿Qué leo ahora?), abrir EPUB en un lector.
- Compilar la versión de Play con `DISTRIBUTION=play` (sin el link de Ko-fi, que Play no permite).

### Fase Kindle / KOReader (próxima)

Para que el Kindle (con KOReader) y la app se hablen sin servidor en internet: el teléfono hace de servidor en el Wi‑Fi mientras la app está abierta.

1. **Servidor local + catálogo OPDS** 🟠: plugin nativo con un servidor HTTP chico. En Ajustes, "Compartir bóveda" muestra la dirección (`http://192.168.x.x:8080/opds`); KOReader la agrega como catálogo y descarga los EPUB por estante o autor.
2. **Respaldo del Kindle a la app** 🟠: plugin de KOReader (Lua) "Enviar a Biblioteca" que sube a la bóveda los EPUB nuevos del Kindle (recuerda cuáles mandó, reintenta cuando el teléfono vuelve a estar). La bóveda ya evita duplicados y los une a cada libro; con el respaldo completo (o el automático a Drive) quedan a salvo si le pasa algo al Kindle.
3. **Sincronizar la página** 🟠: el mismo servidor responde el protocolo kosync que KOReader ya trae ("Progress sync"); la ficha muestra el porcentaje. Hay que calcular la huella MD5 parcial que usa KOReader para reconocer cada archivo.
4. **Plugin propio, después** 🟡: encontrar el teléfono solo, avisar "terminé" (pasa a Leídos con fecha y nota), subrayados y notas a la ficha.

Mientras tanto: script para copiar por USB los EPUB nuevos del Kindle a una carpeta de Drive en el Mac.

### Compartir a la app (ideas para hacerlo más directo)

Ya funciona (Fase 3): compartir texto, links, imágenes, EPUB o PDF abre la Bandeja. Mejoras posibles:

- Agregar solo cuando hay una coincidencia clara, con aviso para deshacer.
- Accesos directos en la hoja de compartir ("Biblioteca · Por leer").

## Mejoras pendientes

Ideas para después de las fases. Varias venían de la antigua app web.

| Mejora                                                                                                                                   | Nivel | Estado                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| 🌍 Portada y datos en el idioma de la búsqueda                                                                                           | 🟡    | ✅ v0.2.0 (edición que coincide en Open Library)                                                                 |
| 📚 Ordenar por saga dentro de cada autor                                                                                                 | 🟡    | ✅ v0.2.0 (editar saga a mano, leer "(Saga #2)" del título, ordenar con IA)                                      |
| 📥 Importar notas de Obsidian (.md) y JSON                                                                                               | 🟡    | ✅ v0.2.0                                                                                                        |
| 🖼️ Elegir portada (otras ediciones, Apple Books, link o imagen propia)                                                                   | 🟡    | ✅ v0.2.0                                                                                                        |
| 🎲 **"¿Qué leo ahora?"** con IA: siguiente libro según sagas empezadas, prioridades y lo último leído (Haiku, fracción de centavo)       | 🟡    | ✅ v0.6.0                                                                                                        |
| 📈 **Progreso de saga**: "3 de 7 leídos" y el próximo libro destacado                                                                    | 🟢    | ✅ v0.6.0                                                                                                        |
| 🔔 **Aviso de saga**: cuando sale el siguiente libro de una saga que sigo (revisión periódica en Open Library)                           | 🟠    | ⏳                                                                                                               |
| 📅 **Resumen del año ("Wrapped")**: leídos, páginas, autores favoritos, mejor calificado; compartible como imagen                        | 🟡    | ✅ v0.7.0 (en Leídos; compartir como imagen 1080×1920; fecha de término editable para los importados)            |
| 🎁 **Recomendar a un familiar**: compartir un libro con mi comentario y que caiga en su lista de deseos (link o archivo que la app abre) | 🟠    | ⏳                                                                                                               |
| 🔁 **Exportar a Obsidian**: guardar la biblioteca como .md en el mismo formato que se importa (ida y vuelta)                             | 🟡    | ✅ v0.7.0 (Ajustes → Organizar; `#leyendo`, `#deseo`, `#sin-terminar`, ★ y etiquetas; se reimporta sin duplicar) |
| 🔀 Ordenar arrastrando dentro de "Mi orden"                                                                                              | 🟡    | ⏳                                                                                                               |
| 🤖 Recomendaciones con IA: "si te gustó X…", a partir de los libros con 4–5 estrellas                                                    | 🟡    | ⏳                                                                                                               |
| 📚 Catálogo OPDS para descargar la bóveda desde KOReader                                                                                 | 🟠    | ➡️ Fase Kindle / KOReader                                                                                        |
| ✉️ "Enviar a Kindle" por correo                                                                                                          | 🟡    | ⏳                                                                                                               |
| 🎥 Reels en video sin pantallazo (necesitaría un servidor con `yt-dlp`: choca con "sin servidor")                                        | 🔴    | Descartado por ahora                                                                                             |
| 🎨 Paletas de color (5 cozy + Dispositivo/Material You), de día y de noche                                                               | 🟡    | ✅ v0.5.0                                                                                                        |
| 📖 Reseña ("De qué trata") y páginas en la ficha                                                                                         | 🟡    | ✅ v0.5.0 (Apple Books en el idioma del título, si no Open Library)                                              |
| 🖼️ Portadas sin conexión (ajuste opcional, ~17 KB por libro)                                                                             | 🟡    | ✅ v0.4.0                                                                                                        |
| ☕ Ko-fi en la versión de GitHub (Ajustes → Apoyar la app, README, botón Sponsor)                                                        | 🟢    | ✅ v0.7.0                                                                                                        |
| 📄 Importar desde Goodreads/StoryGraph (CSV)                                                                                             | 🟢    | ✅ v0.7.0 (también StoryGraph y planillas con `,` o `;`)                                                         |

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

## Historial de versiones (resumen)

- **v0.2.0**: navegación abajo, portadas por idioma, cambiar portada, editar datos, sagas por autor, importar Obsidian/JSON.
- **v0.3.0**: Fase 6 (limpieza, licencia GPL-3.0, APK de 41 MB).
- **v0.4.0**: botón ✕ en la ficha, cierre sin bloqueos, "Sin terminar"/DNF, portadas sin conexión.
- **v0.5.0**: paletas de color y del dispositivo, reseña y páginas en la ficha.
- **v0.6.0**: ¿Qué leo ahora? y progreso de sagas. Ko-fi y barra de títulos opaca salen en la v0.7.0.
- **v0.7.0** (en preparación): exportar a Obsidian, resumen del año, Ko-fi y barra de títulos opaca.
