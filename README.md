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

## Datos

- `src/data/`: capa de datos. La UI solo usa `Library` (`src/data/library.ts`).
- SQLite nativo en Android/iOS (`@capacitor-community/sqlite`), sql.js en el navegador y en los tests: el mismo SQL en todas partes.
- Migraciones en `src/data/migrations/`, numeradas con `PRAGMA user_version`. **Nunca se edita una migración publicada**: se agrega una nueva.
- Respaldo JSON v1 (`src/data/backup.ts`): exportar incluye los borrados; importar fusiona por UUID y gana el `updated_at` más nuevo.
