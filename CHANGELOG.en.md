# Changes

English version of [CHANGELOG.md](CHANGELOG.md). The app shows this one in What's new when it is in English: keep both with the same versions.

## [Unreleased]

- What’s new after an update now follows the app’s language (it was always in Spanish).

## [0.8.0] - 2026-11-04

- New shelves: Reading · Shelf · Read · DNF. The Shelf has all your books, with a status filter.
- Up next (inside Reading): your queue of what to read next. Add books from their page, by long-pressing them or from “What should I read next?”, and order them by hand.
- A book’s page has two tabs: My notes (status, rating, pages read, start and finish dates, note, priority, tags) and Info (what Open Library says: average rating and votes, genres, publisher, languages, editions and what it’s about).
- Long-press a book for quick actions: start, mark as read, Up next, change cover, share, rate, move or remove.
- Discover (new tab): more books by your favorite authors and in the genres you read, Apple Books bestsellers in your country (by category) and this week’s trends. Tap one to see what it’s about and add it.
- Closing a book’s page by dragging it now keeps it moving down (it used to bounce up while fading), and the book you tap right after always opens (a tap was sometimes lost).
- A book’s page closes with a back arrow, top left.
- Vibration can be turned off in Settings.
- CSV backup (Settings → Backup): with Goodreads columns, to take your library to StoryGraph, Goodreads or a spreadsheet.
- What’s new: after each update, the app shows what changed once.
- The wishlist is gone: those books are now in To read.

## [0.7.0] - 2026-11-04

- Import from CSV: Goodreads and StoryGraph exports (with series, rating, note, pages and the date you finished) or any spreadsheet with a title column. No duplicates.
- Export to Obsidian (Settings → Organize): a .md note with your books by author and series, with status, rating, priority, notes and tags as #tags. It can be imported back without losing anything or duplicating.
- Your year in books (in Read): books finished, pages, average rating, month by month, authors, top rated and series finished. Share it as a story image.
- In “Edit details” of a read book you can set the date you finished it (useful for imported books, which don’t have it).
- Settings → Support the app: a link to buy me a coffee on Ko-fi (only in the GitHub version; Google Play doesn’t allow donation links).
- The title bar at the top is now opaque: text no longer shows behind the title when scrolling.

## [0.6.0] - 2026-11-04

- What should I read next?: three instant picks (the next one in series you started, must-reads, authors you liked, short reads), each with its reason and a button to start it. With the AI connected, Claude can choose based on what you have read and how you rated it.
- Series progress: in the author view each series shows how many you have read and marks the next book; on a book’s page, the progress and a shortcut to the next one.

## [0.5.0] - 2026-11-04

- Colors: five palettes (Library, Chai, Forest, Dusk, Mist) and “Device”, which uses your wallpaper colors (Android 12+). All with day and night versions; the system bars follow the palette.
- Each book’s page shows what it’s about (in the title’s language when Apple Books has it; otherwise Open Library) and fills in the page count.
- The + button no longer has a shadow.

## [0.4.0] - 2026-11-04

- ✕ button to close a book’s page (besides swiping down or tapping outside).
- After closing a book’s page you can tap another book right away (the app used to feel stuck for a few seconds).
- If the book changed shelf, its cover fades when closing instead of staying still.
- “Abandoned” is now called “DNF” (“Sin terminar” in Spanish).
- Offline covers (Settings, optional): keeps a small copy of each cover on the phone. About 17 KB per book (≈9 MB for 500 covers).

## [0.3.0] - 2026-11-04

- The app is half the size: the APK goes from 81 to 41 MB and starts lighter (the AI loads only when used).
- With hundreds of books, filling in covers no longer redraws the library for every book.
- Tidier repo: GPL-3.0 license, new README, decisions in docs/ and no leftovers from the old web app.
- Navigation bar: Search is now the colored circle of the bar, and the + sits outside on the right, always at the same distance.

## [0.2.0] - 2026-11-04

- Navigation at the bottom: a floating bar with Library, Search, Vault, Settings and a fixed + button (it no longer moves when changing shelf). Each screen’s title stays at the top.
- Covers in the language you search in (“Red Rising” no longer shows the “Amanecer rojo” cover).
- Change cover: other Open Library editions, Apple Books, a link or an image from the phone (included in backups).
- If Open Library has no cover, Apple Books is used.
- Edit title, authors, series, number and year; a button to fill in what’s missing from the web.
- In the author view, books are ordered by series; “Sort into series with AI” for the ones without one.
- Import Obsidian notes (.md) or JSON lists without duplicates; covers and details are filled in gradually.
- Shelf photos: the AI checks every spine (it used to stop at 6), retries and picks the most complete Open Library record.
- An author’s horizontal strips no longer move the screen or change shelf when swiped hard.

## [0.1.0] - 2026-11-03

First test version for the phone.

- Local library on the phone (SQLite), no accounts: Reading, To read, Wishlist, Read and Abandoned shelves.
- Minimal day and night design; the cover flies into the book’s page, which takes on its color.
- Add books by searching Open Library, scanning the ISBN, from an image or by sharing from Instagram.
- Inbox: identifies the book by ISBN, with AI (your own Claude API key) or by reading the image on the phone.
- Vault of EPUBs and PDFs linked to your books; they open in the reader you have.
- ZIP backups (library only or full) to save on Drive or anywhere, and restore.
