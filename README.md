# 📚 Biblioteca

App local y sin cuentas para llevar tu biblioteca: wishlist, por leer, leyendo, leídos y una bóveda de EPUB. Android (teléfono y tablet) primero; luego iOS y escritorio.

Nombre provisional. El plan completo está en [PLAN.md](PLAN.md).

## Desarrollo en el Mac

```bash
npm install
npm run dev            # http://localhost:5180 — la app completa en el navegador, con SQLite en WASM
npm run check          # tipos, lint, formato y tests
```

### Android sin instalar APK

Una sola vez, instala el emulador y crea los dispositivos "Telefono" y "Tablet" (~2 GB):

```bash
npm run emulators
```

Con `npm run dev` corriendo en otra terminal:

```bash
npm run android:live              # emulador Telefono
npm run android:live -- Tablet    # emulador Tablet
npm run android:live -- --phone   # tu teléfono por USB o depuración Wi-Fi
```

Cada cambio guardado aparece al instante en el emulador. Solo hay que volver a correr el comando al agregar un plugin nativo.

Los emuladores usan la GPU del Mac (`-gpu host`). Si se ven trabados, revisa que `hw.gpu.enabled=yes` esté en `~/.android/avd/<nombre>.avd/config.ini`: sin GPU, el WebView dibuja por CPU. Con la ventana del emulador oculta, macOS también le baja el ritmo.

### Diseñar con datos reales

```bash
npm run seed           # convierte ~/dev/book_app/seed a seed/biblioteca-dev.json (no se sube: el repo es público)
```

Después, en la app: Ajustes → Desarrollo → «Cargar biblioteca de ejemplo».

## Agregar libros

- Buscar en Open Library, escanear el ISBN, elegir una imagen o pegar el texto o el link de un post.
- Desde otra app: Compartir → Biblioteca. Llega a la bandeja.
- IA opcional: Ajustes → «Leer pantallazos con IA», con la API key de Anthropic de cada usuario (Claude Haiku 5.5, ~0,03 USD cada 100 pantallazos).

Para probar «compartir» en el emulador:

```bash
adb shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT 'Terminé «Piranesi»' -n dev.martinvergara.biblioteca/.MainActivity
```

Compartir una imagen con `adb` falla por permisos (el shell no puede prestar acceso a la galería); pruébalo con «Desde una imagen» o compartiendo desde la app Fotos.

## Bóveda

EPUB y PDF guardados en el teléfono, vinculados a los libros. Se agregan desde la bóveda, desde la ficha de un libro o compartiéndolos a la app. En el emulador no hay lector instalado: «Abrir» avisa que falta uno (instala KOReader para probarlo).

## Respaldos

Ajustes → Respaldo: «Respaldar la biblioteca» (liviano) o «Respaldo completo» (con los EPUB/PDF). Se guarda donde elijas en la hoja de compartir (Drive, Gmail, Archivos). «Restaurar un respaldo» acepta el ZIP o el JSON antiguo y fusiona sin borrar nada.

Para probar en el emulador sin que la recarga en vivo interrumpa (pasa al volver de un selector de archivos), en modo desarrollo la biblioteca queda en `window.__lib` y se puede restaurar por las herramientas de Chrome.

## Datos

- `src/data/`: capa de datos. La UI solo usa `Library` (`src/data/library.ts`).
- SQLite nativo en Android/iOS (`@capacitor-community/sqlite`), sql.js en el navegador y en los tests: el mismo SQL en todas partes.
- Migraciones en `src/data/migrations/`, numeradas con `PRAGMA user_version`. **Nunca se edita una migración publicada**: se agrega una nueva. Se ejecutan de a una sentencia (`src/data/sql.ts`): el plugin nativo se salta sentencias si recibe varias con comentarios `--`. Al abrir, `checkSchema` verifica que estén todas las columnas.
- Respaldo JSON v1 (`src/data/backup.ts`): exportar incluye los borrados; importar fusiona por UUID y gana el `updated_at` más nuevo.
