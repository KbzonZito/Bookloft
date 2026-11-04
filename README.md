# 📚 Biblioteca

Tu biblioteca personal en el teléfono: estantes, sagas, notas y una bóveda de EPUB y PDF. **Sin cuentas ni servidores**: todo queda en tu dispositivo y tú decides dónde respaldarlo.

Android (teléfono y tablet). iOS y escritorio vendrán después. _Biblioteca_ es un nombre provisional.

## Qué hace

- **Estantes**: Leyendo, Por leer, Deseos, Leídos y Sin terminar, con calificación, prioridad, etiquetas y notas.
- **Por autor y saga**: cada autor con sus sagas en orden, cuántos llevas leídos y cuál sigue.
- **¿Qué leo ahora?**: tres propuestas con su razón (la saga que tienes empezada, lo imprescindible, autores que te gustaron); con IA, Claude elige según lo que has leído.
- **Tu año en libros**: leídos, páginas, mes a mes, autores y los mejor calificados, para compartir como imagen.
- **Agregar libros como prefieras**: buscando en Open Library, escaneando el ISBN, con una foto (portadas o lomos en una repisa) o **compartiendo** un post o pantallazo desde otra app.
- **IA opcional con tu propia API key** de Anthropic (Claude Haiku): lee pantallazos y fotos, y ordena tus libros en sagas. Sin key, la app lee el texto de la imagen en el mismo teléfono.
- **Portadas** en el idioma en que buscas; puedes elegir otra edición, pegar un link o usar una foto tuya.
- **Importar y exportar** tus notas de Obsidian (`.md`), o importar un CSV de Goodreads, StoryGraph o una planilla, o un JSON, sin duplicar lo que ya tienes.
- **Cada libro** con su reseña y páginas, en el idioma del título cuando existe.
- **Bóveda**: tus EPUB y PDF vinculados a cada libro, que se abren en tu lector favorito.
- **Respaldos** en ZIP (solo la biblioteca o con la bóveda) para guardar en Drive o donde quieras, y restaurarlos fusionando sin perder nada.
- Paletas de color de día y de noche (o los colores de tu teléfono), portadas sin conexión, en español e inglés.

## Instalar

Descarga el último `biblioteca-X.Y.Z.apk` desde [Releases](https://github.com/KbzonZito/library_app/releases) y ábrelo en el teléfono (Android pide permitir instalar desde el navegador o el gestor de archivos).

Las versiones nuevas se instalan **encima** de la anterior: no hace falta desinstalar y la biblioteca se mantiene.

## Apoyar

La app es gratis, sin anuncios y sin cuentas. Si te sirve, puedes invitarme un café:

[![Invítame un café en Ko-fi](https://img.shields.io/badge/Ko--fi-Invitar%20un%20caf%C3%A9-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/kbzonzito)

## Privacidad

No hay servidor propio ni cuentas. La app solo se conecta a:

- **Open Library** y **Apple Books**, para buscar libros y portadas.
- **Anthropic**, solo si conectas tu API key (que se guarda cifrada en el Keystore del teléfono, nunca en los respaldos).
- Donde **tú** compartas un respaldo (Drive, correo, archivos).

## Desarrollo

Requisitos: Node 24, y para Android el JDK 21 y las herramientas de línea de comandos de Android (`brew install openjdk@21 android-commandlinetools`).

```bash
npm install
npm run dev        # http://localhost:5180 — la app completa en el navegador (SQLite en WebAssembly)
npm run check      # tipos, lint, formato, código sin usar (knip) y tests
```

En el navegador, Ajustes → Desarrollo → «Cargar biblioteca de ejemplo» agrega ~60 clásicos para probar.

### Android sin instalar APK

```bash
npm run emulators                 # una vez: emuladores "Telefono" y "Tablet" (~2 GB)
npm run android:live              # con `npm run dev` corriendo: la app en el emulador, con recarga en vivo
npm run android:live -- Tablet    # en la tablet
npm run android:live -- --phone   # en tu teléfono por USB o depuración Wi-Fi
```

Solo hay que volver a correrlo al agregar un plugin nativo. Si el emulador se ve trabado, revisa que tenga `hw.gpu.enabled=yes` en `~/.android/avd/<nombre>.avd/config.ini`.

Para probar «compartir» en el emulador:

```bash
adb shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT 'Terminé «Piranesi»' -n dev.martinvergara.biblioteca/.MainActivity
```

### APK y versiones

```bash
npm run apk                # APK firmado de prueba en builds/ (lo instala si hay un teléfono conectado)
npm run release -- 0.4.0   # pasa [Unreleased] del CHANGELOG a la versión, crea la etiqueta y la sube
```

GitHub Actions compila el APK de cada etiqueta `v*` y lo publica en Releases. La firma se configura una vez con `scripts/setup-signing.sh` (la llave queda en `~/.config/biblioteca`, fuera del repo; respáldala).

### Estructura

```
src/
  data/       capa de datos: SQLite (nativo, WASM y tests), migraciones, respaldo JSON, importar notas
  sources/    lo que viene de afuera: Open Library, Apple Books, IA, OCR, EPUB, respaldos ZIP
  app/        estado compartido de la UI: biblioteca, bandeja, estantes, completar datos
  components/ pantallas y componentes de React
  ui/         tema, estilos y animaciones
android/      proyecto nativo de Capacitor
scripts/      emuladores, APK, firma y releases
```

- La UI solo habla con `Library` (`src/data/library.ts`). El mismo SQL corre en Android, en el navegador y en los tests.
- Migraciones en `src/data/migrations/`, numeradas con `PRAGMA user_version`. **Nunca se edita una migración publicada**: se agrega una nueva.
- Respaldos: exportar incluye los borrados; importar fusiona por UUID y gana el cambio más nuevo.

Más detalles: [docs/DECISIONES.md](docs/DECISIONES.md) (arquitectura, diseño, negocio) y [PLAN.md](PLAN.md) (hoja de ruta).

## Licencia

[GPL-3.0](LICENSE). Puedes usar, estudiar, modificar y compartir la app; si publicas una versión modificada, su código también tiene que ser abierto.
