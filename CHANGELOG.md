---

# Changelog

Log kerja kronologis proyek Wikly. Dokumen ini adalah ringkasan perubahan untuk
manusia maupun AI coding assistant: baca entri terbaru terlebih dahulu sebelum
melanjutkan implementasi.

## Aturan pencatatan

- Tambahkan satu entri baru pada setiap penyelesaian phase atau sesi kerja
  bermakna; letakkan entri terbaru paling atas.
- Gunakan timestamp ISO 8601 dengan zona `Asia/Jakarta` (`WIB`, UTC+07:00).
- Catat status, perubahan, validasi yang benar-benar dijalankan, keputusan
  arsitektur, dan blocker. Jangan menandai pekerjaan selesai jika belum lolos
  validasi.
- Hindari menulis secret, access token, password, atau isi file `.env`.

## Template entri

## YYYY-MM-DDTHH:mm:ss+07:00 — Phase N / nama sesi

**Status:** in progress | complete | blocked

### Changed

- Perubahan yang dibuat, termasuk file/modul bila relevan.

### Verified

- Perintah atau pemeriksaan yang benar-benar lulus.

### Decisions

- Keputusan dan alasan yang perlu diketahui pengerjaan berikutnya.

### Blockers / Next

- Risiko, kegagalan, atau langkah konkret berikutnya.

---

## 2026-09-07T12:12:00+07:00 — Phase 3 / Obsidian plugin publishing MVP

**Status:** complete

### Changed

- `@wikly/domain`: menambahkan `generateSourceId` (Crockford base32 ULID compatible), `computeContentHash` (SHA-256), `isPublishable`, `extractSourceId`, `slugify`, dan `parseWikilinks`.
- `@wikly/api-contracts`: mendefinisikan konstanta rute API (`AUTH_DEVICE_PATH`, `PUBLISH_PATH`) dan interface DTO (`DeviceAuthRequest`, `DeviceAuthResponse`, `PublishRequest`, `PublishResponse`).
- `@wikly/validation`: menambahkan schema Zod untuk validasi request device auth dan publish note (`deviceAuthRequestSchema`, `publishRequestSchema`).
- Server Backend (`apps/web`):
  - Menambahkan repository `devices.ts` untuk registrasi perangkat dan validasi token berbasis SHA-256 hash.
  - Menambahkan repository `publishing.ts` untuk pemrosesan publikasi idempotent, optimistic concurrency check (`serverRevision`), pencatatan riwayat di `page_revisions`, serta sinkronisasi otomatis relasi `tags` dan `page_links`.
  - Mengimplementasikan endpoint API `POST /api/v1/auth/device` dan `POST /api/v1/publish` dengan autentikasi header `Bearer <token>`.
- Obsidian Plugin (`plugins/obsidian-wiki`):
  - Mengimplementasikan `PublishQueue` dengan fitur debounce, deduplikasi berdasarkan `sourceId`, dan mekanisme retry backoff bertahap.
  - Mengimplementasikan `WiklyApiClient` memanfaatkan fungsi native `requestUrl` Obsidian.
  - Menambahkan frontmatter helpers untuk deteksi dan injeksi otomatis `sourceId` stabil (`wiki.id`).
  - Menghubungkan event listener Vault (`modify`, `create`, `rename`, `delete`) untuk penerbitan inkremental berbasis event.
  - Memperbarui `WiklySettingTab` dengan formulir konfigurasi koneksi, pairing perangkat, dan durasi debounce.
  - Menambahkan status bar item, ribbon icon, dan perintah command palette ("Publish active note", "Unpublish active note", "Sync now").

### Verified

- `pnpm test`: Lulus semua test suite (unit test `@wikly/domain`, `@wikly/validation`, `@wikly/obsidian-plugin`, dan integration test API di `@wikly/web`).
- `pnpm typecheck`: Lulus validasi TypeScript di seluruh 6 workspace package.
- `pnpm lint`: Lulus verifikasi ESLint tanpa error dan warning.
- `pnpm build`: Berhasil mengompilasi bundel esbuild `main.js` plugin Obsidian dan bundel produksi Next.js.

### Decisions

- Otentikasi perangkat menyimpan SHA-256 hash token di tabel `devices` (`token_hash`), mengembalikan plain token sekali untuk disimpan di pengaturan lokal plugin.
- Publikasi catatan yang kontennya tidak berubah (hash identik) diakui server dengan `changed: false` tanpa menaikkan revisi atau menambah baris di `page_revisions`.
- Saat sebuah catatan di-rename atau dipindah folder, `sourceId` di frontmatter tetap dipertahankan sehingga tidak membuat record halaman baru di database.

### Blockers / Next

- Siap lanjut ke **Phase 4 — Asset pipeline**: ekstraksi referensi aset/gambar, hash-based dedupe, presigned upload endpoint, relasi `page_assets`, dan pelacakan orphan.

---

## 2026-09-06T23:44:00+07:00 — Phase 2 / basic public wiki

**Status:** complete

### Changed

- Mengimplementasikan pipeline parsing Markdown Obsidian (`pipeline.ts`) dengan dukungan wikilinks (`[[target|label]]`), Obsidian callouts (`> [!type]`), heading anchors, dan sanitasi HTML (`sanitize-html`).
- Menambahkan repository queries di `pages.ts` dan `tags.ts`: `getPublishedPageBySlug`, `getPublishedPages`, `getPageBacklinks`, `searchPages`, `getAllTagsWithCount`, dan `getPagesByTagSlug`.
- Menambahkan komponen UI: `WikiNav.tsx` (sidebar responsif dengan pencarian instan), `Backlinks.tsx` (grafik tautan balik dua arah), dan `TableOfContents.tsx` (daftar isi otomatis).
- Mengimplementasikan rute aplikasi publik Next.js:
  - Beranda (`/`)
  - Catatan dinamis (`/[slug]`)
  - Direktori tag (`/tags`) & filter per tag (`/tags/[slug]`)
  - Pencarian artikel (`/search`)
- Mendesain ulang `globals.css` dengan tema gelap terinspirasi Obsidian, tipografi modern, styling callout berwarna, dan tata letak responsif desktop/mobile.
- Memperkaya seed database (`seed.ts`) dengan 3 catatan terkait, tag, dan grafik relasi tautan balik.
- Menambahkan unit test markdown pipeline dan integration test repositori.

### Verified

- `pnpm test` berhasil (10/10 tests lulus: unit test pipeline dan database integration test).
- `pnpm typecheck` lulus tanpa error di seluruh workspace.
- `pnpm lint` lulus tanpa peringatan.
- `pnpm format:check` 100% konsisten Prettier.
- `pnpm build` berhasil mengompilasi dan mengoptimasi seluruh paket monorepo dan aplikasi web Next.js.

### Decisions

- Routing catatan publik menggunakan pola `/[slug]`.
- Rute-rute pembacaan database diekspor dengan `dynamic = 'force-dynamic'` agar selalu menyajikan data terkini dari proyeksi PostgreSQL.
- Callouts dan wikilinks diproses sebelum pipeline Markdown `marked` agar kompatibel penuh dengan format asli Obsidian.

### Blockers / Next

- Tidak ada blocker.
- Langkah berikutnya: Phase 3 — Obsidian plugin publishing MVP (autentikasi perangkat, deteksi event perubahan Vault, hash konten, dan endpoint publish).

---

## 2026-09-06T23:20:53+07:00 — Phase 1 / database foundation

**Status:** complete

### Changed

- Menambahkan Drizzle ORM, driver `pg`, Drizzle Kit, dan konfigurasi
  [drizzle.config.ts](drizzle.config.ts).
- Menambahkan client database dan schema Drizzle di
  `apps/web/src/lib/db/`.
- Mendefinisikan 11 tabel inti: users, sites, pages, page revisions, assets,
  page-assets, page-links, tags, page-tags, pending changes, dan devices.
- Menghasilkan migrasi awal `drizzle/0000_lowly_zarda.sql`.
- Menambahkan repository layer di `apps/web/src/lib/db/repos/` (`sites.ts`, `pages.ts`, `users.ts`, dan re-export `index.ts`).
- Menambahkan database seeder `apps/web/src/lib/db/seed.ts` dan script `pnpm db:seed`.
- Menambahkan setup Vitest `apps/web/vitest.config.ts` dan database test `apps/web/src/lib/db/__tests__/repos.test.ts`.

### Verified

- Drizzle Kit berhasil membaca schema dan menghasilkan migrasi SQL.
- PostgreSQL development tersedia dan sehat pada `localhost:5433`.
- `pnpm db:migrate` berhasil menerapkan tabel ke PostgreSQL.
- `pnpm db:seed` berhasil populate default site, admin, dan page.
- `pnpm test` berhasil (semua unit & integration test repositori lulus).

### Decisions

- PostgreSQL diperlakukan sebagai proyeksi publik, bukan source of truth Vault.
- Migrations tetap versioned melalui Drizzle Kit; schema tidak diterapkan secara
  manual untuk menghindari perbedaan antara schema dan riwayat migrasi.
- Script database seed dijalankan via `tsx --env-file=../../.env` untuk memuat environment variable.

### Blockers / Next

- Tidak ada blocker aktif.
- Langkah berikutnya: Phase 2 — public rendering, page/tag/search routes, dan safe Markdown pipeline.

---

## 2026-09-06T23:13:07+07:00 — Phase 0 / repository bootstrap

**Status:** complete

### Changed

- Membuat monorepo pnpm berisi aplikasi web Next.js, shared packages, dan
  scaffold plugin Obsidian berbasis esbuild.
- Menambahkan lint, format, type-check, Vitest, dokumentasi setup, serta
  `.env.example`.
- Menambahkan Docker Compose PostgreSQL 17 dan MinIO dengan volume dan health
  check; host port PostgreSQL dikonfigurasi melalui `POSTGRES_PORT`.
- Membuat `.env` lokal dengan kredensial development acak dan
  `POSTGRES_PORT=5433`; file ini diabaikan Git.

### Verified

- `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, dan
  `pnpm build` lulus pada bootstrap awal.
- PostgreSQL sehat pada `localhost:5433`.
- MinIO sehat pada `localhost:9000`; console tersedia pada `localhost:9001`.

### Decisions

- Next.js memakai App Router dan TypeScript.
- Plugin hanya menjadi bridge publish/write-back; LiveSync tetap menangani sync
  perangkat dan Vault tetap SSOT.
- Next.js menonaktifkan `experimental.useTypeScriptCli` karena jalur CLI pada
  lingkungan ini gagal membaca output `tsc --showConfig`; type checking tetap
  berjalan melalui compiler API dan perintah `pnpm typecheck`.

### Blockers / Next

- Lanjutkan Phase 1 dengan memperbaiki `pnpm db:migrate`, kemudian tambahkan
  repository layer, seed, dan pengujian database.
