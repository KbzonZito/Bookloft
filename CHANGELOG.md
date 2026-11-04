# Cambios

## [Unreleased]

## [0.4.0] - 2026-11-04

- Botón ✕ para cerrar la ficha de un libro (además de deslizar hacia abajo o tocar afuera).
- Al cerrar la ficha se puede tocar otro libro al instante (antes la app parecía trabarse unos segundos).
- Si el libro cambió de estante, su portada se desvanece al cerrar en vez de quedarse quieta.
- "Abandonados" ahora se llama "Sin terminar" (DNF en inglés).
- Portadas sin conexión (Ajustes, opcional): guarda una copia chica de cada portada en el teléfono. Unos 17 KB por libro (≈9 MB con 500 portadas).

## [0.3.0] - 2026-11-04

- La app pesa la mitad: el APK baja de 81 a 41 MB y abre más liviana (la IA se carga recién al usarla).
- Con cientos de libros, completar portadas ya no hace que la biblioteca se redibuje por cada libro.
- Repo ordenado: licencia GPL-3.0, README nuevo, decisiones en docs/ y sin restos de la app web anterior.
- Barra de navegación: Buscar pasa a ser el círculo de color de la barra, y el + queda afuera, a la derecha, siempre a la misma distancia.

## [0.2.0] - 2026-11-04

- Navegación abajo: barra flotante con Biblioteca, Buscar, Bóveda, Ajustes y el botón + fijo (ya no se corre al cambiar de estante). Arriba queda el título de cada pantalla.
- Portadas en el idioma en que buscas ("Red Rising" ya no sale con la tapa de "Amanecer rojo").
- Cambiar portada: otras ediciones de Open Library, Apple Books, un link o una imagen del teléfono (se incluye en los respaldos).
- Si Open Library no tiene portada, se busca en Apple Books.
- Editar título, autores, saga, número y año; botón para completar lo que falta desde internet.
- En la vista por autor, los libros se ordenan por saga; "Ordenar en sagas con IA" para los que no la tienen.
- Importar notas de Obsidian (.md) o listas en JSON, sin duplicar; las portadas y datos se completan después de a poco.
- Fotos de repisas: la IA revisa todos los lomos (antes se quedaba con 6), reintenta y elige la ficha más completa de Open Library.
- Las tiras horizontales de un autor ya no mueven la pantalla ni cambian de estante al deslizarlas fuerte.

## [0.1.0] - 2026-11-03

Primera versión de prueba para el teléfono.

- Biblioteca local en el teléfono (SQLite), sin cuentas: estantes Leyendo, Por leer, Deseos, Leídos y Abandonados.
- Diseño minimalista de día y de noche; la portada vuela a la ficha del libro, que se tiñe con su color.
- Agregar libros buscando en Open Library, escaneando el ISBN, desde una imagen o compartiendo desde Instagram.
- Bandeja de entrada: identifica el libro por ISBN, con IA (tu propia API key de Claude) o leyendo la imagen en el teléfono.
- Bóveda de EPUB y PDF vinculados a tus libros; se abren en el lector que tengas.
- Respaldos en ZIP (solo la biblioteca o completo) para guardar en Drive o donde quieras, y restaurar.
