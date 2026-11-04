# Biblioteca (app) — Plan del proyecto

> Estado: **Fases 1 a 5 listas** · Creado: 2026-11-03
> Origen: la app web familiar en Cloudflare (`~/dev/book_app`). Esta app la **reemplaza**.

## 1. Qué es

Una app **cozy, local y sin cuentas** para llevar tu biblioteca: wishlist, por leer, leyendo, leídos y una bóveda de EPUB.
Cada persona que la instala tiene **su propia biblioteca en su dispositivo**. Agregas libros **compartiendo** un post, reel o pantallazo de Instagram directamente a la app, buscando por título o escaneando el ISBN.

Plataformas: **Android (teléfono y tablet)** primero. Después escritorio (Mac/Windows/Linux) e iOS con el mismo código.

## 2. Decisiones tomadas

| Tema       | Decisión                                                                    | Por qué                                                    |
| ---------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Cloudflare | **Reemplazar.** Migrar datos y apagar Workers, D1, R2 y Access              | Un solo producto que mantener                              |
| Tecnología | **Capacitor + React + Vite + TypeScript**                                   | Igual que Printer Hub; reusa casi toda la UI de `book_app` |
| Datos      | **Local-first** (SQLite en el dispositivo) + respaldos a ZIP y Google Drive | 0 USD de servidor, privacidad, funciona sin internet       |
| Negocio    | **Gratis + Pro de pago único** + propina                                    | Sin costos fijos, no hay servidor que pagar                |
| IA         | **Cada usuario usa su propia API key** (BYOK)                               | Tú no pagas la IA de nadie                                 |

## 3. Qué se pierde al salir de Cloudflare y cómo lo cubrimos

| Hoy en Cloudflare                         | En la app                                | Reemplazo                                                                   |
| ----------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| Ver la biblioteca de otros familiares     | ❌ Cada uno ve solo la suya              | Futuro: "Recomendar a alguien" con un link o archivo que se abre en su app  |
| Bóveda EPUB compartida                    | ❌ Cada uno tiene su bóveda              | Compartir un EPUB por la hoja de compartir de Android                       |
| Entrar desde cualquier navegador o PC     | ❌ Hasta tener versión escritorio        | Restaurar desde Drive en otro equipo; Fase 10 (escritorio)                  |
| Bot de Telegram                           | ✅ **Mejor**: compartir directo a la app | Hoja de compartir de Android → bandeja de entrada de la app                 |
| Una API key central (la pagabas tú)       | ✅ Cada uno la suya, o modo gratis       | OCR en el dispositivo + Open Library, sin key                               |
| Login con Cloudflare Access               | ✅ No hace falta                         | Sin cuentas; opcional bloqueo con huella                                    |
| Datos siempre en la nube                  | 🟡 Depende del usuario                   | Android Auto Backup (automático) + Drive + ZIP                              |
| Leer el link de un reel desde un servidor | 🟡 Por probar                            | Desde el teléfono (IP residencial) puede funcionar mejor; si no, pantallazo |
| Familiares con iPhone                     | ❌ Hasta tener versión iOS               | Fase 11 (requiere Apple Developer, 99 USD/año)                              |

## 4. Arquitectura

```
Instagram ─compartir─► App (intent ACTION_SEND) ─► Bandeja de entrada ─┐
Buscar título / escanear ISBN ─────────────────────────────────────────┤
                                                                       ▼
                       React (UI) ──► Repositorio ──┬─► SQLite (libros, archivos, bandeja, ajustes)
                                                    ├─► Filesystem (EPUB, portadas en caché)
                                                    ├─► Open Library (búsqueda, portadas)
                                                    ├─► ML Kit en el dispositivo (OCR, código de barras) — gratis
                                                    ├─► Claude API con la key del usuario (opcional)
                                                    └─► Google Drive del usuario (respaldos)
```

- **Sin servidor propio.** Todo pasa en el dispositivo; las llamadas externas van directo a Open Library, Anthropic y Google.
- **Repositorio** (`src/data/`): una sola interfaz para la UI. En Android usa SQLite nativo; en el navegador del Mac usa SQLite en WebAssembly, así se desarrolla igual.
- **La API key** se guarda cifrada en el Keystore de Android, nunca en SQLite ni en los respaldos.

### Modelo de datos (local, un usuario por dispositivo)

```
books     id (UUIDv7), title, authors, series, series_index, isbn, ol_key, cover_url, cover_path, year, pages,
          status, priority, position (REAL), tags, note, rating (0,5–5), source_url,
          added_at, started_at, finished_at, search_text, updated_at, deleted_at
files     id, book_id, path, filename, size, sha256, format, meta_title, meta_author, added_at, updated_at, deleted_at
inbox     id, kind (text|url|image), input, image_path, candidates (JSON), state, book_id, created_at, updated_at
settings  key, value (JSON), updated_at
```

Cambios respecto a Cloudflare: `users` desaparece y `entries` se funde con `books` (hay un solo usuario).
Estados en inglés (`wishlist`, `to_read`, `reading`, `read`, `abandoned`); la migración traduce los de Cloudflare. Calificación de a media estrella.
Esquema real: `src/data/migrations/0001_init.sql`.
**IDs UUID + `updated_at` + `deleted_at` desde el día 1:** permiten fusionar respaldos y, más adelante, sincronizar dispositivos sin rehacer el esquema.

## 5. Agregar libros (reemplaza al bot de Telegram)

1. **Compartir a la app**: desde Instagram (o cualquier app) → Compartir → Biblioteca. Acepta texto, links e imágenes. Llega a la **bandeja de entrada**.
2. **Identificar el libro**, en este orden según lo que haya:
   - **ISBN** en el texto o escaneado con la cámara → Open Library. Gratis y exacto.
   - **IA con tu key** (Claude Haiku 5.5, ~0,0003 USD por pantallazo): lee el pantallazo o el texto y propone libros. Se reusa `ai.ts` de `book_app`.
   - **Modo gratis sin key**: OCR en el dispositivo (ML Kit) → líneas candidatas → búsqueda en Open Library.
3. **La IA propone, tú confirmas**: siempre con tarjetas para elegir, nunca agrega sola.
4. Buscar por título a mano, como hoy.

Configuración de la key: pantalla "Conectar IA" con un paso a paso para sacar la key en console.anthropic.com, un botón "Probar" y el costo estimado por pantallazo.

### Cómo quedó (Fase 3)

- **Compartir a la app** (`@capgo/capacitor-share-target`): textos, links y pantallazos llegan a la **bandeja**, que se abre sola. Las imágenes se copian reducidas (1568 px, JPEG) a `inbox/` en el almacenamiento de la app.
- **Identificar** (`src/sources/identify.ts`), de lo más exacto a lo más difuso: ISBN en el texto → IA con la key del usuario (Claude Haiku 5.5) → OCR en el teléfono (ML Kit) → búsqueda en Open Library. Con un link, el teléfono intenta leer `og:description`; Instagram suele pedir sesión, así que el pantallazo sigue siendo lo más confiable.
- **OCR sin IA**: junta las líneas grandes de la portada en orden de lectura ("HAIL" + "MARY" + "ANDY WEIR") antes de buscar.
- **Escanear ISBN** con el lector de Google Play Services: no pide permiso de cámara.
- **La API key** se guarda en el Keystore/Keychain (`@aparajita/capacitor-secure-storage`), nunca en SQLite ni en los respaldos. Se prueba antes de guardarla.
- Lo que llega desde Instagram se agrega por defecto a **Deseos**.

### Bóveda (Fase 4)

- EPUB y PDF se guardan en `vault/<huella>.<formato>` dentro del almacenamiento privado de la app; la huella (SHA-256) evita duplicados.
- Se vinculan solos a un libro de la biblioteca por título y autor del EPUB (acepta subtítulos como "Tenth Anniversary"); si no está, se puede crear la ficha desde el archivo.
- Se abren en el lector que el usuario tenga instalado y se comparten con su nombre original. Si la ficha está pero el archivo no (respaldo JSON restaurado sin archivos), la app lo dice.
- Se pueden recibir desde otras apps (Compartir → Biblioteca).
- **Android Auto Backup excluye `vault/` e `inbox/`**: su límite es 25 MB y, si se pasa, Android deja de respaldar todo, incluida la base. Los EPUB irán en el respaldo completo (Fase 5).
- Quitar un archivo es reversible por un día; después se borra del disco (la fila queda para los respaldos).

## 6. Respaldos

| Nivel                       | Qué es                                                                                                    | Esfuerzo para el usuario          |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Android Auto Backup**     | Android guarda la base de datos en la cuenta Google del usuario (hasta 25 MB) y la restaura al reinstalar | Ninguno                           |
| **Exportar / importar ZIP** | `biblioteca.json` + portadas + (opcional) EPUB. Se guarda con la hoja de compartir o en Archivos          | Un botón                          |
| **Google Drive**            | Respaldo manual o automático (diario/semanal) a Drive, en una carpeta propia de la app                    | Iniciar sesión con Google una vez |
| **Exportar a Markdown**     | Notas legibles para Obsidian (ya existe en `book_app`)                                                    | Un botón                          |

- Dos tipos de respaldo: **"Biblioteca"** (datos + portadas, liviano) y **"Completo"** (incluye la bóveda EPUB, puede pesar GB).
- Restaurar **fusiona por UUID** usando `updated_at`: nunca borra lo más nuevo.
- Drive usa el permiso más acotado posible (solo los archivos que crea la app), para que la verificación de Google sea liviana.

### Cómo quedó (Fase 5)

- **ZIP**: `biblioteca.json` (fichas, bóveda, ajustes, con los borrados) y, en el respaldo completo, `vault/…` con los EPUB/PDF tal cual (sin recomprimir). Se arma archivo por archivo en la caché y se entrega por la hoja de compartir: **Drive**, Gmail, Bluetooth, Archivos. En el navegador se descarga. Es un ZIP estándar: se abre en cualquier computador.
- **Restaurar** lee el ZIP por su índice (directorio central): un EPUB es en sí un ZIP y un lector por partes confundía sus marcas internas. Fusiona por UUID (gana lo más nuevo, nunca borra) y solo escribe los archivos que faltan. 573 libros en 0,7 s en el emulador.
- **Recordatorio**: con 10 libros o más, si pasó un mes sin respaldar, un aviso con "Respaldar", como máximo una vez por semana.
- **Respaldo automático a Drive (pendiente)**: necesita un proyecto en Google Cloud con una credencial OAuth atada al nombre del paquete y a la huella SHA-1 de la firma, y la verificación de Google de la pantalla de permisos. Conviene hacerlo con el nombre y la firma definitivos (antes de la Fase 9). Ámbito sugerido: `drive.file` o `drive.appdata` (no sensibles).
- Si la página se recarga con una transacción a medias (Android reiniciando el WebView), al abrir se deshace antes de reconectar; antes la base quedaba bloqueada.

## 7. Diseño: cozy, moderno, simple

**Dirección (2026-11-03): minimalista y cálido, con animaciones excelentes.** Menos adornos que `book_app`: las portadas son el color de la app.

**Sistema elegido (Fase 2):**

| Token  | Día: sala de lectura                 | Noche: noche con velas  |
| ------ | ------------------------------------ | ----------------------- |
| Papel  | `#ECEEEA` gris verdoso de biblioteca | `#15120F` madera oscura |
| Tinta  | `#1C1F1D`                            | `#EDE6DA`               |
| Acento | `#8C2B3A` cinta de marcapáginas      | `#E0A75E` vela          |

- Tipografía: **Newsreader** (títulos de libros y estantes, con tamaño óptico) + **Instrument Sans** (interfaz). Van empaquetadas en la app, funcionan sin internet.
- Lo memorable, en un solo lugar: los estantes son tipografía grande y el activo lo marca una **cinta de marcapáginas** que se desliza con resorte; la **portada vuela** a la ficha y la ficha se tiñe con el color de esa portada.
- Portadas con lomo (esquinas rectas a la izquierda y un pliegue fino); las que no tienen imagen son "tela de encuadernación" con el título.
- Código: `src/ui/theme.css` (tokens), `src/ui/app.css` (estructura), `src/ui/motion.ts` (resortes compartidos).

- **Minimalismo:** mucho aire, una sola familia tipográfica para la interfaz + serif solo en títulos de libros, paleta casi neutra (papel / tinta) con un único acento cálido. Sin texturas, sin bordes donde baste el espacio, íconos finos. El modo noche sigue siendo cálido ("noche con velas"), no gris.
- **Animaciones fluidas** (la firma de la app):
  - **Elemento compartido:** la portada vuela de la estantería a la ficha y vuelve (View Transitions API + Motion `layoutId`).
  - **Física de resortes** en vez de curvas fijas; gestos que siguen el dedo (deslizar para cerrar la ficha, arrastrar para reordenar) y se pueden interrumpir a mitad.
  - Solo `transform` y `opacity` (GPU), 60/120 fps en gama media; listas virtualizadas para 600+ libros.
  - Háptica suave en acciones clave; respeta "reducir movimiento" del sistema.
  - Presupuesto: ninguna transición > 350 ms; se mide en un teléfono de gama media, no solo en el emulador.
- **Adaptativo por ancho**, no por tipo de dispositivo:

| Ancho                                    | Navegación          | Contenido                                                   |
| ---------------------------------------- | ------------------- | ----------------------------------------------------------- |
| < 600 dp (teléfono)                      | Barra inferior      | Una columna; la ficha del libro se abre a pantalla completa |
| 600–840 dp (tablet vertical, plegable)   | Riel lateral        | Cuadrícula de portadas más ancha; ficha como panel          |
| > 840 dp (tablet horizontal, escritorio) | Riel o menú lateral | **Lista + ficha lado a lado** (dos paneles)                 |

- Objetivos táctiles ≥ 48 dp, soporte de teclado y mouse desde el inicio (sirve para tablets con teclado y para escritorio).
- Microdetalles cozy: estantes con madera, portadas con sombra suave, animaciones cortas, háptica al mover libros.

## 8. Probar en el Mac sin instalar APK cada vez

Tres niveles, de más rápido a más real:

1. **Navegador** (`npm run dev`): el 90 % del trabajo. Recarga al instante. Con las vistas de dispositivo de Chrome se prueban teléfono, tablet y escritorio. Los plugins nativos tienen una versión web (SQLite en WASM, subir archivo en vez de compartir).
2. **Emulador de Android en el Mac** (Apple Silicon corre imágenes arm64 rápido) **con live reload**: `npm run android:live` abre la app en el emulador apuntando al servidor de Vite del Mac. Cada cambio aparece al guardar, sin reinstalar. Solo se recompila cuando se agrega un plugin nativo. Creamos dos emuladores: Pixel (teléfono) y Pixel Tablet.
3. **Tu teléfono real por Wi-Fi**: depuración inalámbrica + live reload, y **scrcpy** para ver y controlar el teléfono en una ventana del Mac.

Ya tienes `android-commandlinetools` y JDK; falta instalar `emulator`, una imagen de sistema y `scrcpy` (Fase 0).

## 9. Fases

Niveles de pensamiento (esfuerzo sugerido para Claude):
🟢 mecánico (bajo) · 🟡 decisiones locales (medio) · 🟠 diseño con consecuencias (alto) · 🔴 difícil de revertir (máximo + modo plan)

| Fase | Contenido                                                                                                                                   | Nivel | Estado                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------- |
| 0    | Base: Vite + React + TS + Capacitor, estructura, lint/format/tests (como Printer Hub), emuladores teléfono y tablet, `android:live`, scrcpy | 🟡    | 🟡 Falta scrcpy y el script de APK                                                                                   |
| 1    | **Datos locales**: SQLite nativo y WASM, esquema con UUID, migraciones, repositorio, respaldo JSON, tests                                   | 🔴    | ✅                                                                                                                   |
| 2    | **UI**: portar estanterías, ficha, búsqueda, vista autor/saga e i18n; layouts adaptativos teléfono/tablet; modo noche                       | 🟠    | ✅ Falta reordenar arrastrando                                                                                       |
| 3    | **Agregar libros**: Open Library, escáner ISBN, compartir a la app, bandeja de entrada, OCR, IA con key propia                              | 🟠    | ✅ Falta probar en un teléfono real: escáner, compartir imagen desde Instagram e IA con una key real                 |
| 4    | **Bóveda EPUB local**: importar desde Archivos, leer metadatos (ya existe `epub.ts`), vincular, abrir en lector externo, compartir          | 🟡    | ✅ Falta probar abrir en un lector real (KOReader, Play Libros) y archivos grandes                                   |
| 5    | **Respaldos**: ZIP, Auto Backup, Google Drive (proyecto en Google Cloud, OAuth), restauración con fusión                                    | 🟠    | ✅ ZIP + Drive por la hoja de compartir. Falta el respaldo **automático** a Drive (después de elegir nombre y firma) |
| 6    | **Migración desde Cloudflare**: script que exporta cada persona de D1 + sus EPUB de R2 a un ZIP de la app; importarlo en cada teléfono      | 🟡    | ⏳                                                                                                                   |
| 7    | **Apagar Cloudflare**: borrar webhook, Workers, Access, D1 y R2 **solo después** de verificar los ZIP de todos                              | 🔴    | ⏳                                                                                                                   |
| 8    | **Pro y propinas**: Google Play Billing (pago único Pro + propinas), flavor "GitHub" con link a Ko-fi                                       | 🟠    | ⏳                                                                                                                   |
| 9    | **Publicación**: cuenta Play (25 USD), política de privacidad, ficha, formulario de seguridad de datos, prueba cerrada                      | 🟡    | ⏳                                                                                                                   |
| 10   | Escritorio Mac/Windows/Linux (Tauri o Electron sobre la misma web)                                                                          | 🟠    | Futuro                                                                                                               |
| 11   | iOS                                                                                                                                         | 🟠    | Futuro                                                                                                               |

Flujo de trabajo (igual que Printer Hub): commits locales → APK de prueba local → **tú confirmas** → release numerado en GitHub/Play.

### Versiones y firma (revisado 2026-11-04)

Para que una versión nueva se instale **encima** de la anterior, sin desinstalar ni perder la biblioteca, Android exige tres cosas, y las tres se cumplen:

1. **Mismo `appId`** (`dev.martinvergara.biblioteca`). No cambia aunque cambie el nombre visible: el nombre que se ve en el teléfono (`appName`) se puede cambiar cuando queramos. Cambiar el `appId` crearía otra app aparte, así que se queda.
2. **Misma firma**: la llave de `~/.config/biblioteca/release.p12` (la misma que usa GitHub Actions por los secretos). El certificado tiene SHA-256 `d51e7975…cc79`. **Respaldarla en el gestor de contraseñas**: sin ella no se puede actualizar la app.
3. **`versionCode` mayor**: se calcula de `package.json` como `mayor·10000 + menor·100 + parche` (0.1.0 → 100, 0.2.0 → 200).

¿Sirve la firma de Printer Hub? Técnicamente sí (una llave puede firmar varias apps), pero conviene una por app: si una se filtra, no compromete la otra, y se puede traspasar una app sin entregar la de la otra. Esta app ya tiene la suya; **no hay que cambiar nada**. Al publicar en Play se usará _Play App Signing_ (Google guarda la llave de la app y la nuestra pasa a ser la de subida).

## 10. Negocio

**Gratis** (tiene que ser buena sola): biblioteca completa, estanterías, búsqueda, ISBN, compartir a la app con OCR, bóveda EPUB, respaldo ZIP, modo noche.

**Pro, pago único (~3–5 USD)**, ideas:

- IA con tu key (pantallazos y textos) — o dejarla gratis y cobrar por lo de abajo
- Respaldo automático a Google Drive
- Estadísticas y "Wrapped" anual
- Temas y estanterías extra, ícono alternativo
- Aviso de nuevo libro de una saga, "¿Qué leo ahora?"

**Propinas — ojo con Google Play:**

- Google Play **no permite** links de donación externos dentro de la app (fuera de EE. UU.); hay apps sacadas o advertidas por eso, incluso en 2026 (AnkiDroid). Tampoco permite cobrar "donaciones" con Play Billing.
- Solución: en la versión de Play, **"Invítame un café"** como compra dentro de la app que da algo a cambio (tema o ícono "mecenas"). En la versión de GitHub y en el README/web: link a **Ko-fi**.
- **Ko-fi antes que Buy Me a Coffee** para Chile: Ko-fi no cobra comisión en propinas y acepta **PayPal** (que funciona en Chile); Buy Me a Coffee cobra 5 %, depende de Stripe y dejó de soportar varios países. Antes de crear la cuenta, confirma que puedes retirar de PayPal a tu banco.
- Google Play sí paga a cuentas en Chile (perfil de pagos con cuenta bancaria chilena). Comisión de Google: 15 % del primer millón USD al año.

**Competencia y diferencia:** Goodreads, StoryGraph, Bookly, Basmo, Libib. Lo nuestro: **compartir desde Instagram → libro en segundos**, bóveda EPUB propia, sin cuenta, privado, bonito, funciona offline y tablet de verdad.

## 11. Consejos

- **Valida antes de cobrar:** publica la v1 gratis en prueba cerrada con familia y amigos. Las cuentas personales nuevas de Play **necesitan ~12 testers activos durante 14 días** antes de publicar en producción: empieza a juntarlos temprano.
- **El esquema es lo único difícil de cambiar** después de publicar (vive en los teléfonos de la gente). Por eso la Fase 1 va en modo plan.
- **BYOK es fricción** para gente no técnica. El modo gratis (OCR + Open Library + ISBN) tiene que funcionar bien solo; la IA es un plus.
- **La bóveda EPUB y las políticas:** preséntala como "tus archivos". Nada de catálogos públicos ni descargas desde la app, para no parecer una app de piratería.
- **Nombre y marca:** "Biblioteca" es genérico y no se puede proteger ni encontrar en Play. Elige un nombre propio antes de la Fase 9 (revisa que el dominio y el nombre en Play estén libres).
- **Política de privacidad obligatoria** (por Drive, cámara y la API key). Al no tener servidor, es corta y honesta: "tus datos no salen de tu dispositivo salvo a los servicios que tú conectas".
- **Rota la API key** que está en `book_app/.dev.vars` y en tus notas cuando apagues Cloudflare.
- **Keystore de firma:** respáldala fuera del Mac (gestor de contraseñas). Si la pierdes, no puedes actualizar la app fuera de Play.

## 12. Preguntas abiertas y respuestas

| Pregunta              | Respuesta (2026-11-03)                                                                                                                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nombre                | **Pendiente** (se decide más adelante). Candidatos: **Velada** (favorito: lectura de noche, cálido, corto), **Cinta** (la cinta marcapáginas, que ya es el acento de la app), **Anaquel** (repisa de libros). Descartado: **Lomo** (existe "Loomo - Reading Friend"). Antes de elegir: buscar en Play y App Store, dominio y marca en INAPI |
| Ícono                 | **Pendiente**: buscar o diseñar un ícono mejor junto con el nombre (hoy es el de Capacitor ajustado). Idea: la cinta marcapáginas burdeos sobre papel                                                                                                                                                                                       |
| Repo                  | **Público** (licencia por decidir; GPL-3.0 impide clones cerrados en Play)                                                                                                                                                                                                                                                                  |
| Familiares con iPhone | **Sí** → iOS sube de prioridad: se prueba gratis en el Simulador de iOS del Mac desde la Fase 2; publicar en App Store (99 USD/año) después de Android                                                                                                                                                                                      |
| Gratis vs Pro         | Más adelante                                                                                                                                                                                                                                                                                                                                |
| Bóveda en R2          | **Vacía**: la migración (Fase 6) es solo datos y portadas                                                                                                                                                                                                                                                                                   |
| Lector EPUB integrado | No por ahora                                                                                                                                                                                                                                                                                                                                |

## 13. Mejoras pendientes (heredadas de la app de Cloudflare)

Ideas que estaban planeadas para book_app y siguen valiendo aquí. Nivel de pensamiento entre paréntesis.

| Mejora                                                                                                                                   | Nivel | Estado                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------- |
| 🌍 Portada y datos en el idioma de la búsqueda                                                                                           | 🟡    | ✅ v0.2.0 (edición que coincide en Open Library)                            |
| 📚 Ordenar por saga dentro de cada autor                                                                                                 | 🟡    | ✅ v0.2.0 (editar saga a mano, leer "(Saga #2)" del título, ordenar con IA) |
| 📥 Importar notas de Obsidian (.md) y JSON                                                                                               | 🟡    | ✅ v0.2.0                                                                   |
| 🖼️ Elegir portada (otras ediciones, Apple Books, link o imagen propia)                                                                   | 🟡    | ✅ v0.2.0                                                                   |
| 🎲 **"¿Qué leo ahora?"** con IA: siguiente libro según sagas empezadas, prioridades y lo último leído (Haiku, fracción de centavo)       | 🟡    | ⏳                                                                          |
| 📈 **Progreso de saga**: "3 de 7 leídos" y el próximo libro destacado                                                                    | 🟢    | ⏳                                                                          |
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

## 14. Optimización (al final)

Cosas que no bloquean nada pero conviene hacer antes de publicar:

- **Peso del APK (81 MB en v0.1.0)**: casi todo es el OCR de ML Kit empaquetado para 4 arquitecturas.
  - Publicar en Play como **AAB** (cada teléfono descarga solo su arquitectura: ~25 MB).
  - Para GitHub: **APK por arquitectura** (`splits.abi`) o solo `arm64-v8a` (todos los teléfonos actuales).
  - Cambiar al OCR **no empaquetado** de ML Kit (lo descarga Google Play Services la primera vez): la app baja ~20 MB más.
- **Arranque**: medir el tiempo hasta ver la biblioteca en un teléfono de gama baja; cargar diferidos el SDK de Anthropic, fflate y sql.js (solo se usan al identificar, respaldar o en el navegador).
- **Listas largas**: con más de ~1.000 libros, virtualizar la cuadrícula y la vista por autor.
- **Portadas**: caché local de las portadas en el teléfono (hoy dependen de la caché del WebView); miniaturas más chicas en la cuadrícula.
- **Consultas a Open Library**: caché de búsquedas recientes y un `User-Agent` propio desde HTTP nativo (lo piden en su API).
- **Base de datos**: índices revisados con `EXPLAIN QUERY PLAN` cuando haya datos reales; `VACUUM` ocasional después de borrar mucho.
- **Animaciones**: perfilar en un teléfono de gama baja (60 fps al abrir la ficha y al cambiar de estante).
