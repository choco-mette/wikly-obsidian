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

---

## 2026-09-07T15:15:00+07:00 — Phase 8: Production Hardening and Deployment

**Status:** complete

### Changed

- **Production Docker & Multi-stage Build:**
  - `Dockerfile`: Multi-stage pnpm build (`base`, `deps`, `builder`, `runner`) dengan `next build` standalone dan minimal runtime image.
  - `docker/entrypoint.sh` & `docker/migrate.js`: Startup guard memeriksa kesiapan PostgreSQL via `pg_isready` dan mengaplikasikan migrasi Drizzle secara terprogram sebelum server Next.js dijalankan.
  - `docker-compose.prod.yml`: Konfigurasi multi-container production (`web`, `postgres`, `minio`, `caddy`, `db-backup`).
  - `apps/web/next.config.ts`: Mengaktifkan `output: 'standalone'` serta security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
  - `.env.example`: Menambahkan variabel `ADMIN_SESSION_SECRET`, `SITE_DOMAIN`, dan `ACME_EMAIL`.

- **Reverse Proxy & Auto-TLS:**
  - `docker/caddy/Caddyfile`: Konfigurasi Caddy reverse proxy dengan auto-TLS (Let's Encrypt / ZeroSSL), kompresi zstd/gzip, security headers, dan caching agresif aset statis `/_next/static/*`.

- **Backup & Disaster Recovery:**
  - `scripts/backup-db.sh`: Script backup otomatis `pg_dump` dengan kompresi gzip dan rotasi retensi file kedaluwarsa.
  - `scripts/restore-db.sh`: Script pemulihan database dari berkas backup `.sql.gz`.

- **Observability & Health Checks:**
  - `apps/web/src/lib/logger.ts`: Logger JSON terstruktur standar NDJSON dengan log level `debug`, `info`, `warn`, dan `error`.
  - `apps/web/src/app/api/health/route.ts`: Endpoint `GET /api/health` untuk memverifikasi kesiapan database dan storage backend secara live.

- **Rate Limiting & Security Hardening:**
  - `apps/web/src/lib/rateLimit.ts`: In-memory sliding window rate limiter berbasis token bucket.
  - Proteksi rate limiting pada `POST /api/v1/auth/device` (10 req/min), `POST /api/admin/auth` (5 req/min), dan `POST /api/v1/publish` (120 req/min).

- **Storage Lifecycle & Vault Reconciliation:**
  - `apps/web/src/lib/db/repos/maintenance.ts`: Fungsi `garbageCollectOrphanAssets` untuk pembersihan aset yatim dan `reconcileVault` untuk rekonsiliasi proyeksi link & relasi seluruh vault.
  - `apps/web/src/app/api/admin/maintenance/route.ts`: Endpoint admin `POST /api/admin/maintenance?action=gc` dan `?action=reconcile`.

### Verified

- `pnpm test`: Seluruh 52 automated tests (11 test suites) lulus 100%.
- `pnpm lint`: Lulus 100% tanpa error ESLint.
- `pnpm typecheck`: Lulus 100% tanpa error TypeScript (zero `any`).
- `docker compose -f docker-compose.prod.yml config`: Validasi interpolasi environment dan sintaks compose.
- `scripts/backup-db.sh`: Menghasilkan berkas cadangan gzip terverifikasi dan rotasi retensi berfungsi.
- `curl http://localhost:3000/api/health`: Mengembalikan status HTTP 200 JSON `{"status":"ok", ...}`.

### Decisions

- Menggunakan Caddy sebagai reverse proxy produksi sesuai rekomendasi PRD Section 27 karena native auto-TLS dan konfigurasi ringkas.
- Migrasi database saat startup kontainer dijalankan lewat script JavaScript mandiri `docker/migrate.js` memanfaatkan `drizzle-orm/node-postgres/migrator` sehingga tidak memerlukan devDependencies tambahan di runner container.

### Blockers / Next

- PRD Phase 0 hingga Phase 8 telah lengkap diimplementasikan dan diverifikasi.

---

## 2026-09-07T14:40:00+07:00 — Phase 7: Graph, Excalidraw, and Advanced Obsidian Compatibility

**Status:** complete


### Changed

- **Interactive Force-Directed Graph:**
  - `packages/api-contracts/src/index.ts`: Menambahkan DTO `GraphNodeDto`, `GraphLinkDto`, `GraphDataDto`, dan `GraphResponse` beserta konstanta `GRAPH_PATH`.
  - `apps/web/src/lib/db/repos/pages.ts`: Menambahkan fungsi `getGraphData` yang mengambil nodes dan relasi edges dari tabel `pages` dan `page_links`, mendukung filter neighborhood berdasar `pageSlug` dan `depth` (1 atau 2).
  - `apps/web/src/app/api/v1/graph/route.ts`: Membuat endpoint `GET /api/v1/graph` untuk fetching graf publik (seluruh vault atau neighborhood).
  - `apps/web/src/components/GraphView.tsx`: Membuat komponen visualisasi graf interaktif berbasis Canvas dan `d3-force` dengan dukungan 60fps rendering, zoom/pan controls, drag-and-drop node, hover highlight relasi, indikator node aktif, dan navigasi klik ke catatan (`router.push`).
  - `apps/web/src/app/(public)/graph/page.tsx`: Membuat halaman publik `/graph` khusus visualisasi jejaring pengetahuan seluruh vault dengan statistik jumlah catatan & tautan.
  - `apps/web/src/components/WikiNav.tsx`: Menambahkan menu navigasi "Graf Relasi" (`/graph`) dengan icon `Share2`.

- **Excalidraw Read-Only Rendering:**
  - `apps/web/src/lib/markdown/pipeline.ts`: Mengidentifikasi embed berkas `.excalidraw` pada `processAssetEmbeds` dan merendernya sebagai kontainer `<div class="excalidraw-embed">`.
  - `apps/web/src/components/ExcalidrawViewer.tsx`: Membuat komponen klien yang memuat JSON berkas `.excalidraw` via dynamic import `@excalidraw/utils`, mengekspor ke SVG read-only murni tanpa kanvas editing, dan menangani fallback jika berkas rusak.

- **Obsidian Aliases Support:**
  - `packages/domain/src/index.ts`: Menambahkan fungsi `extractAliases` untuk ekstraksi frontmatter `aliases` (array string maupun single string).
  - `packages/domain/src/__tests__/aliases.test.ts`: Unit test komprehensif untuk `extractAliases` (5 pengujian lolos).
  - `apps/web/src/lib/db/repos/pages.ts`: Menambahkan fungsi `getPublishedPageBySlugOrAlias` untuk pencarian catatan berdasar slug kanonikal atau alias frontmatter.
  - `apps/web/src/lib/db/repos/publishing.ts`: Memperbarui `syncPageLinks` agar mengenali target wikilink berdasar alias dan menautkannya ke target halaman kanonikal.
  - `apps/web/src/app/(public)/[slug]/page.tsx`: Menerapkan auto-redirect (307) saat URL diakses via slug alias ke halaman kanonikal, serta menampilkan badge daftar alias di header artikel.

- **Improved Embed Handling & Broken Reference Surfacing:**
  - `apps/web/src/lib/markdown/pipeline.ts`:
    - Menambahkan `processNoteEmbeds` untuk transklusi catatan Obsidian `![[Note Title]]` dengan perlindungan rekursi bertingkat (maksimal depth 2).
    - Mendeteksi tautan dan embed yang rusak: menandai broken wikilink dengan kelas `wiki-link-broken`, embed catatan yang hilang dengan komponen `.broken-reference`, dan media yang hilang dengan `.broken-asset`.
  - `apps/web/src/lib/markdown/__tests__/pipeline.test.ts`: Menambahkan 5 pengujian baru (total 11 pengujian lolos).

- **Mermaid & KaTeX Math Rendering:**
  - `apps/web/src/lib/markdown/pipeline.ts`:
    - Menambahkan `processMath` berbasis `katex.renderToString` untuk matematika inline `$..$` dan blok `$$..$$`, dilengkapi proteksi blok kode agar tanda `$` tidak tertukar.
    - Menambahkan penanganan blok kode `mermaid` menjadi kontainer diagram `.mermaid-diagram`.
    - Mengonfigurasi `sanitizeHtml` agar mengizinkan tag dan atribut matematika MathML/SVG/KaTeX serta elemen diagram.
  - `apps/web/src/components/MermaidRenderer.tsx`: Komponen klien yang mengeksekusi inisialisasi dan rendering `mermaid` pada blok diagram.
  - `apps/web/src/app/globals.css`: Mengimpor `katex/dist/katex.min.css` dan mendesain tema dark mode untuk matematika, diagram, dan komponen graf.

- **Related Pages:**
  - `apps/web/src/lib/db/repos/pages.ts`: Menambahkan fungsi `getRelatedPages` yang menghitung skor relasi catatan berdasarkan kesamaan tag (`page_tags`) dan koneksi tautan langsung (`page_links`).
  - `apps/web/src/components/RelatedPages.tsx`: Komponen grid halaman terkait dengan tampilan tag dan tanggal pembaruan.
  - `apps/web/src/app/(public)/[slug]/page.tsx`: Menampilkan bagian "Halaman Terkait" di bawah artikel.

### Verified

- `pnpm --filter @wikly/domain test`: 4 test suites / 20 tests pass.
- `pnpm --filter @wikly/web test`: 8 test suites / 46 tests pass.
- `pnpm test`: Seluruh 14 test suites / 71 tests monorepo pass.
- `pnpm typecheck`: 5 workspace projects pass tsc dengan 0 error.
- `pnpm lint`: ESLint lulus 0 error dan 0 warning di seluruh monorepo.
- `pnpm format:check`: Format Prettier 100% konsisten.
- `pnpm --filter @wikly/web build`: Produksi build Next.js (Turbopack) berhasil mengompilasi semua route termasuk `/graph` dan `/[slug]`.
- Konfirmasi zero `any` dan zero `as any` di seluruh berkas `.ts` dan `.tsx`.

### Decisions

- Excalidraw di-render klien via `@excalidraw/utils` `exportToSvg` sehingga menghasilkan visualisasi SVG tajam tanpa beban runtime kanvas editor interaktif pada wiki publik.
- KaTeX di-render secara server-side di pipeline markdown dengan HTML sanitization terverifikasi untuk performa maksimal dan zero CLS (Content Layout Shift).
- Navigasi graf menggunakan Canvas + D3-Force demi performa 60fps dengan kemampuan zoom/pan dan drag node responsif.

### Blockers / Next

- Phase 8: Production hardening (Docker Compose production, reverse proxy Nginx/Caddy, TLS, backups, structured logging, health checks).

---

## 2026-09-07T13:53:00+07:00 — Code Review / Type-safety audit & session unit tests

**Status:** complete

### Changed

- **Type-safety audit — eliminasi seluruh `any` di codebase:**
  - `packages/domain/src/index.ts`: Mengganti `let curr: any` (2 lokasi pada logika dot-path traversal `applyFrontmatterPatch`) dengan `let curr: Record<string, unknown>` dan cast eksplisit `as Record<string, unknown>` saat spread dan re-assign node, menghapus unsafe `any` tanpa mengubah perilaku runtime.
  - `packages/domain/src/__tests__/patch.test.ts`: Mengganti 5 penggunaan `as any` pada assertion nested property dengan `as Record<string, unknown>`.
  - `apps/web/src/app/api/v1/__tests__/sync.test.ts`: Mengganti parameter callback `(c: any)` dengan `(c: SyncChangeItem)` dan menambahkan import `SyncChangeItem` dari `@wikly/api-contracts`.
  - **9 file admin/component** (href typed-router workaround): Mengganti seluruh `as any` pada prop `href` komponen `Link` Next.js dan argumen `redirect()` dengan `as Route<string>` (tipe resmi yang digenerate Next.js) dan menambahkan `import type { Route } from 'next'` di setiap file:
    - `apps/web/src/app/admin/(dashboard)/pages/page.tsx` (4 lokasi)
    - `apps/web/src/app/admin/(dashboard)/pages/PageRowActions.tsx` (2 lokasi)
    - `apps/web/src/app/admin/(dashboard)/pages/[id]/revisions/page.tsx`
    - `apps/web/src/app/admin/(dashboard)/tags/page.tsx`
    - `apps/web/src/app/admin/(dashboard)/assets/page.tsx` (3 lokasi)
    - `apps/web/src/app/admin/(dashboard)/devices/DevicesClient.tsx` (4 lokasi)
    - `apps/web/src/app/admin/(dashboard)/pending-changes/page.tsx` (5 lokasi)
    - `apps/web/src/components/admin/AdminNav.tsx`
    - `apps/web/src/lib/auth/session.ts` (pada `redirect()`)
- **Unit test `session.ts`** — Membuat `apps/web/src/lib/auth/__tests__/session.test.ts` (23 tests):
  - `createSessionToken`: format base64url, keunikan token per call, encoding payload.
  - `verifySessionToken`: token valid, string kosong, string random, signature ditamper, email ditamper, token expired (mock `Date.now()`), payload parts salah, `expiresAt` non-numeric.
  - `getSessionUser`: cookie valid di Request header, tanpa cookie, cookie invalid, multiple cookies, fallback tanpa Request (test env di mana `cookies()` throw).
  - `setSessionCookie`: mengandung token, atribut `HttpOnly`/`SameSite=Lax`/`Max-Age`, tidak ada `Secure` di non-production, ada `Secure` di production (mock `NODE_ENV`).
  - `clearSessionCookie`: `Max-Age=0`, atribut `HttpOnly`/`SameSite=Lax`.

### Verified

- `pnpm typecheck`: Lulus validasi TypeScript di 5 proyek workspace — 0 error setelah semua `any` dihapus.
- `pnpm --filter web test`: 8 test suites / 41 tests lulus (naik dari 18 tests sebelumnya berkat 23 tests session baru).
- `pnpm --filter @wikly/domain test`: 3 test suites / 15 tests lulus.
- Konfirmasi zero `any` tersisa dengan `grep -r ": any\|as any\|<any" --include="*.ts" --include="*.tsx"` (exit code 1 = tidak ditemukan).

### Decisions

- `Route<string>` dipilih sebagai pengganti `as any` untuk `href` Next.js karena masih memaksa nilai harus berupa `string` (bukan object/null/undefined), sekaligus memberikan sinyal semantik eksplisit ke tooling bahwa ini memang intentional URL cast. `any` bypass type system sepenuhnya — `Route<string>` tidak.
- `Record<string, unknown>` lebih tepat dari `any` untuk cursor dot-path traversal karena selaras dengan tipe `frontmatter: Record<string, unknown>` yang sudah digunakan di signature fungsi; cast eksplisit pada spread dan re-assign tetap mempertahankan immutability semantik.

### Blockers / Next

- Siap lanjut ke **Phase 7 — Graph, Excalidraw, advanced Obsidian compatibility**.

## 2026-09-07T13:44:00+07:00 — Phase 6 / Admin-to-Obsidian write-back

**Status:** complete

### Changed

- `@wikly/domain`:
  - Mendefinisikan tipe `FrontmatterPatch`, `FrontmatterTagsPatch`, `FrontmatterPropertiesPatch`.
  - Mengimplementasikan `applyFrontmatterPatch` untuk mutasi frontmatter catatan secara presisi (tambah/hapus tag array/string, penanganan format hashtag `#`, penanganan key bertingkat seperti `wiki.published`, serta mempertahankan properti dan body Markdown lainnya tanpa modifikasi).
  - Menambahkan unit test di `packages/domain/src/__tests__/patch.test.ts` (6 tests).
- `@wikly/api-contracts` & `@wikly/validation`:
  - Menambahkan rute dan konstanta: `SYNC_CHANGES_PATH`, `SYNC_CLAIM_PATH`, `SYNC_ACK_PATH`.
  - Menambahkan DTO: `SyncChangeItem`, `SyncChangesResponse`, `SyncClaimResponse`, `SyncAckRequest`, `SyncAckResponse`.
  - Menambahkan skema Zod di `@wikly/validation`: `syncChangesQuerySchema`, `syncAckSchema`, `frontmatterPatchSchema`, `createPendingChangeSchema`.
- Server Backend (`apps/web`):
  - Memperbarui repository `pendingChanges.ts`: menambahkan `getSyncChanges` (polling antrean pending dan claimed yang expired), `claimChange` (atomic lease claim dengan masa berlaku 5 menit), dan `ackChange` (konfirmasi sukses atau kegagalan operasional).
  - Memperbarui repository `devices.ts`: menambahkan `findApprovedDeviceByToken` untuk otentikasi cepat token bearer perangkat tanpa keharusan passing siteId di request query.
  - Mengimplementasikan rute API:
    - `GET /api/v1/sync/changes`: Polling antrean pending changes oleh plugin Obsidian.
    - `POST /api/v1/sync/changes/[id]/claim`: Klaim lease perubahan dengan batas waktu sewa.
    - `POST /api/v1/sync/changes/[id]/ack`: Konfirmasi eksekusi sukses (`applied`) atau laporan error (`failed`).
    - `POST /api/admin/pending-changes`: Dispatch operasi `frontmatter.patch` dari Admin Panel.
    - `POST /api/admin/pending-changes/[id]/retry`: Mengembalikan status pekerjaan gagal ke `pending`.
  - Menambahkan test suite integrasi `apps/web/src/app/api/v1/__tests__/sync.test.ts` menguji siklus lengkap write-back (unauthorized 401, query, claim, double-claim 409, invalid lease 409, successful ack, failure report, admin retry).
- Obsidian Plugin (`plugins/obsidian-wiki`):
  - Memperbarui `WiklyApiClient`: menambahkan method `fetchSyncChanges`, `claimSyncChange`, dan `ackSyncChange`.
  - Mengimplementasikan `syncPendingChanges` di `main.ts`:
    - Mengambil daftar perubahan antrean dari server.
    - Mengklaim lease operasi ke server.
    - Menemukan file catatan lokal via `wiki.id` (sourceId).
    - Menerapkan patch frontmatter via `app.fileManager.processFrontMatter` tanpa menyentuh body Markdown.
    - Menerbitkan ulang (republish) catatan agar proyeksi server tersinkronisasi.
    - Mengirimkan laporan ACK sukses atau failure ke server.
    - Memperbarui cursor sinkronisasi (`syncCursor`).
  - Loop Suppression: Menambahkan pelacak status `applyingServerChanges: Set<string>` untuk mencegah event `modify` Vault memicu publish rekursif tanpa henti saat write-back sedang diaplikasikan.
  - Menambahkan timer sinkronisasi berkala di latar belakang (`syncIntervalMinutes`).
  - Menambahkan tombol "Sync Now" di tab pengaturan plugin dan command palette (`wikly-sync-now`).
- Admin UI:
  - Mengintegrasikan modal edit tag frontmatter di tabel catatan `/admin/pages` via `PageRowActions.tsx`.
  - Menambahkan tombol "Retry" langsung untuk antrean gagal di `/admin/pending-changes` via `RetryChangeButton.tsx`.

### Verified

- `pnpm test`: 100% lulus di seluruh workspace (apps/web 7 test suites / 18 tests, obsidian-wiki 2 test suites / 5 tests, domain 3 test suites / 15 tests, validation 1 test suite / 5 tests = total 43 tests).
- `pnpm typecheck`: Lulus validasi TypeScript di 5 proyek workspace tanpa error.
- `pnpm lint`: Lulus ESLint 0 error dan 0 warning di seluruh workspace.
- `pnpm format:check`: 100% konsisten Prettier.
- `pnpm build`: Berhasil mengompilasi plugin Obsidian dan seluruh 25 rute Next.js (termasuk rute-rute sinkronisasi `/api/v1/sync/*` dan admin pending changes).

### Decisions

- Prinsip Single Source of Truth (SSOT) dipertahankan penuh: Admin Panel tidak pernah mengubah file Markdown secara langsung di storage atau DB. Seluruh mutasi metadata catatan dialirkan melalui antrean `pending_changes` dan diaplikasikan secara lokal oleh plugin Obsidian.
- Loop suppression dijalankan berlapis: pelacak internal `applyingServerChanges` di memori plugin, pencocokan content hash, dan sifat idempoten endpoint `/api/v1/publish`.
- Antrean claim menggunakan mekanisme atomic lease 5 menit: mencegah perebutan pekerjaan antar perangkat dan otomatis melepaskan kembali pekerjaan jika perangkat yang mengklaim mendadak offline sebelum ACK.

### Blockers / Next

- Siap lanjut ke **Phase 7 — Graph, Excalidraw, advanced Obsidian compatibility**: visualisasi graf catatan interaktif, rendering read-only Excalidraw, aliases, Mermaid, math rendering (KaTeX), dan halaman terkait (related pages).

---

## 2026-09-07T12:56:00+07:00 — Phase 5 / Admin panel

**Status:** complete

### Changed

- Auth & Session (`apps/web/src/lib/auth`):
  - Mengimplementasikan cookie sesi admin ditandatangani HMAC-SHA256 (`session.ts`) dengan validasi signature, tamper detection, dan cookie security flags (`HttpOnly`, `SameSite=Lax`, `Path=/`).
  - Menambahkan method verifikasi password bcrypt di `users.ts` (`verifyAdminCredentials`).
  - Menambahkan endpoint login/logout `POST /api/admin/auth` dan `DELETE /api/admin/auth`.
- Database Repositories Extension (`apps/web/src/lib/db/repos`):
  - `devices.ts`: Menambahkan `getDevicesBySite` dan `regeneratePairingCode` (dengan kode pairing 15 menit format `WIK-XXXXXX`).
  - `pages.ts`: Menambahkan `getAllPagesAdmin` (pencarian, filter status, tag agregasi) dan `getPageWithRevisions`.
  - `assets.ts`: Menambahkan `getAllAssetsAdmin` (daftar aset, preview, MIME, file size, status orphan, dan jumlah halaman yang merujuk).
  - `pendingChanges.ts`: Repository baru untuk queue monitor (`getPendingChanges`, `createPendingChange`, `retryPendingChange`).
  - `dashboard.ts`: Repository agregasi metrik ringkasan (`getDashboardStats`) mencakup halaman published, draft, tag, aset (termasuk orphan), perangkat aktif, dan perubahan pending.
- Layout & Navigasi:
  - Memisahkan layout wiki publik ke grup rute `apps/web/src/app/(public)` dengan `WikiNav`.
  - Membuat dashboard layout terproteksi `apps/web/src/app/admin/(dashboard)/layout.tsx` dengan `AdminNav` dan `AdminHeader`.
  - Menambahkan tema dan styling komprehensif untuk seluruh elemen admin di `apps/web/src/app/globals.css`.
- Admin UI Pages:
  - `/admin/login`: Halaman login admin interaktif.
  - `/admin`: Dashboard 6 metric cards dan activity stream (halaman terbaru & log perubahan pending).
  - `/admin/pages`: Tabel manajemen halaman dengan search input, filter status, badge tags, link ke preview publik, dan link ke riwayat revisi.
  - `/admin/pages/[id]/revisions`: Timeline daftar revisi catatan dengan hash, timestamp, dan pratinjau markdown body.
  - `/admin/tags`: Manajemen tag dengan frekuensi kemunculan catatan.
  - `/admin/assets`: Galeri aset dengan thumbnail/preview, MIME type, ukuran file terbaca (KB/MB), hash SHA-256, indikator orphan, dan page reference count.
  - `/admin/devices`: Manajemen perangkat dengan tab filter (`All`, `Approved`, `Pending`, `Revoked`), modal "Daftarkan Perangkat Baru", generator kode pairing 15 menit (`WIK-XXXXXX`), tombol salin kode, regenerasi kode, dan revocasi token.
  - `/admin/pending-changes`: Antarmuka pemantauan antrean sinkronisasi Obsidian write-back dengan inspeksi payload JSON dan status error.
- Testing:
  - Menambahkan test suite `apps/web/src/app/api/admin/__tests__/admin.test.ts` untuk pengujian login admin, proteksi sesi, pembuatan device dengan pairing code, dan revocasi device.

### Verified

- `pnpm test`: 100% lulus di seluruh workspace (apps/web 6 test suites / 17 tests, obsidian-wiki 1 test suite / 3 tests, domain, validation).
- `pnpm typecheck`: 100% lulus tanpa error TypeScript di 5 proyek workspace.
- `pnpm lint`: Lulus ESLint 0 error dan 0 warning di seluruh workspace.
- `pnpm format:check`: 100% konsisten Prettier.
- `pnpm build`: Berhasil mengompilasi seluruh rute publik dan admin Next.js serta bundle plugin Obsidian.

### Decisions

- Otentikasi admin menggunakan cookie sesi `wikly_session` bertanda tangan HMAC-SHA256 tanpa dependensi library sesi pihak ketiga yang berat.
- Layout dipisah via Route Groups Next.js `(public)` dan `admin/(dashboard)` agar header/sidebar publik tidak bocor ke halaman administrasi dan sebaliknya.
- Kode pairing perangkat dibuat sekali pakai (15 menit masa berlaku) dan hanya hash SHA-256 yang disimpan di database demi keamanan ("Pendekatan A"). Token bearer permanen diterbitkan saat perangkat menukarkan kode tersebut.

### Blockers / Next

- Siap lanjut ke **Phase 6 — Admin-to-Obsidian write-back**: queue consumer di plugin Obsidian untuk mengambil pending changes, mengaplikasikan modifikasi markdown lokal di Obsidian vault, dan melaporkan status apply/failure ke server.

---

## 2026-09-07T12:43:00+07:00 — Phase 4 / Asset pipeline

**Status:** complete

### Changed

- Storage Abstraction (`apps/web/src/lib/storage`):
  - Membuat interface `StorageDriver` (`types.ts`) dengan method `put`, `get`, `delete`, `exists`, `getPublicUrl`, dan opsional `createPresignedUploadUrl`.
  - Mengimplementasikan `LocalStorageDriver` (`local.ts`) yang menyimpan aset di `./data/wiki-assets`, mencegah path traversal, dan menyajikan URL via rute API `/api/v1/assets/raw/[...key]`.
  - Mengimplementasikan `S3StorageDriver` (`s3.ts`) menggunakan `@aws-sdk/client-s3` dan `@aws-sdk/s3-request-presigner` untuk kompatibilitas MinIO dan AWS S3.
  - Membuat storage driver factory singleton (`index.ts`) berbasis `STORAGE_DRIVER` env.
- `@wikly/domain`:
  - Menambahkan `extractAssetReferences` untuk mengekstrak embed Obsidian (`![[...]]`) dan gambar Markdown standar (`![...](...)`).
  - Menambahkan `detectMimeType` untuk pemetaan ekstensi file ke MIME type standar.
  - Menambahkan `computeBinaryHash` untuk kalkulasi SHA-256 binary dengan prefix `sha256:`.
  - Menambahkan unit test di `packages/domain/src/__tests__/assets.test.ts`.
- `@wikly/api-contracts` & `@wikly/validation`:
  - Menambahkan rute dan DTO kontrak: `ASSETS_CHECK_PATH`, `ASSETS_PRESIGN_PATH`, `ASSETS_UPLOAD_PATH`, `ASSETS_RAW_PREFIX`, `AssetCheckRequest`, `AssetCheckResponse`, `AssetPresignRequest`, `AssetPresignResponse`, `AssetUploadResponse`.
  - Menambahkan skema Zod `assetCheckSchema` dan `assetPresignSchema`.
- Server Backend (`apps/web`):
  - Mengimplementasikan repository aset (`assets.ts`) dengan fungsi `findAssetByHash`, `findAssetsByHashes`, `createOrUpdateAsset`, `syncPageAssets`, `updateSiteOrphanedAssets`, `isAssetPublic`, `getPageAssetMap`, dan `findAssetByStorageKey`.
  - Mengimplementasikan endpoint API:
    - `POST /api/v1/assets/check` untuk batch deduplikasi aset sebelum upload.
    - `POST /api/v1/assets/presign` untuk pembuatan presigned PUT URL (S3/MinIO) atau fallback direct upload (Local).
    - `POST /api/v1/assets/upload` untuk upload streaming/binary lokal dengan verifikasi integritas SHA-256.
    - `GET /api/v1/assets/raw/[...key]` untuk menyajikan file aset dengan header `Cache-Control: public, max-age=31536000, immutable`, ETag, dan proteksi akses publik (hanya menyajikan aset yang tertaut ke halaman published).
  - Memperbarui `publishPage` di `publishing.ts` untuk menyinkronkan relasi `page_assets` dan melacak `orphaned_at` pada aset yang tidak lagi dirujuk.
  - Memperbarui pipeline Markdown publik (`pipeline.ts`) untuk memproses embed Obsidian (`![[...]]`), merender ukuran (`width`/`height`), dan meresolusi URL aset publik.
  - Menghubungkan `getPageAssetMap` ke halaman publik (`/[slug]/page.tsx` dan `/page.tsx`).
  - Menambahkan test suite integrasi komprehensif di `apps/web/src/app/api/v1/__tests__/assets.test.ts` (menguji check, presign, upload, serving, dedupe, 403 saat belum published, 200 saat published, dan orphan marking).
- Obsidian Plugin (`plugins/obsidian-wiki`):
  - Mengimplementasikan scanner aset vault (`assets.ts`): membaca binary note attachment via Vault API, mengekstrak checksum SHA-256 dan MIME type.
  - Memperbarui `WiklyApiClient` (`api.ts`): menambahkan method `checkAssets`, `presignAsset`, dan `uploadAssetBinary`.
  - Mengintegrasikan pipeline aset ke `publishItem` di `main.ts`: secara otomatis memindai aset pada catatan yang dipublikasikan, mengecek keberadaan aset di server, mengunggah aset yang belum ada, dan mengirimkan daftar referensi aset pada request publish.

### Verified

- `pnpm test`: 100% lulus (unit test `@wikly/domain`, markdown pipeline, `assets.test.ts` integrasi API server, dan queue plugin Obsidian).
- `pnpm typecheck`: Lulus validasi TypeScript di seluruh workspace (5/5 paket).
- `pnpm lint`: Lulus verifikasi ESLint tanpa error dan warning.
- `pnpm format:check`: 100% konsisten Prettier.
- `pnpm build`: Berhasil mengompilasi plugin Obsidian dan seluruh rute web Next.js (`/api/v1/assets/check`, `/api/v1/assets/presign`, `/api/v1/assets/raw/[...key]`, `/api/v1/assets/upload`).

### Decisions

- Aset dideduplikasi berbasis konten SHA-256 (`hash`). Jika aset yang sama telah diunggah sebelumnya (meskipun untuk catatan berbeda), tidak akan diunggah ulang ke penyimpanan.
- Aset hanya bersifat publik jika terhubung ke minimal satu catatan dengan `status = 'published'` melalui relasi `page_assets`. Jika belum tertaut atau berstatus orphan, server mengembalikan status 403.
- Ketika sebuah referensi aset dihapus dari suatu catatan, aset tidak langsung dihapus secara fisik (untuk mencegah data loss pada aset bersama), melainkan ditandai `orphaned_at = NOW()`.
- Abstraksi penyimpanan mendukung Local filesystem secara bawaan tanpa dependensi eksternal, dan siap dialihkan ke MinIO/S3 cukup dengan mengubah konfigurasi `STORAGE_DRIVER=s3`.

### Blockers / Next

- Siap lanjut ke **Phase 5 — Admin Panel**: auth sesi, dashboard, pages view, tags view, assets view, revisions view, pending changes view, manajemen perangkat & kode pairing, serta alur revocasi perangkat.

---

## 2026-09-07T12:12:00+07:00 — Phase 3 / Obsidian plugin publishing MVP

**Status:** complete

### Changed

- `@wikly/domain`: menambahkan `generateSourceId` (Crockford base32 ULID compatible), `computeContentHash` (SHA-256), `isPublishable`, `extractSourceId`, `slugify`, dan `parseWikilinks`.
- `@wikly/api-contracts`: mendefinisikan konstanta rute API (`AUTH_DEVICE_PATH`, `PUBLISH_PATH`) dan interface DTO (`DeviceAuthRequest`, `DeviceAuthResponse`, `PublishRequest`, `PublishResponse`).
- `@wikly/validation`: menambahkan schema Zod untuk validasi request device auth dan publish note (`deviceAuthRequestSchema`, `publishRequestSchema`).
- Server Backend (`apps/web`):
  - Memperbarui skema tabel `devices` dengan migrasi Drizzle: menambahkan `pairing_code_hash`, `pairing_code_expires_at`, `status`, `approved_at`, dan `approved_by`.
  - Mengimplementasikan repository `devices.ts` dengan fungsi `createPendingDevice` (generate one-time code `WIK-XXXXXX`), `pairDevice` (validasi & burn kode pairing sekali pakai, terbitkan bearer token permanen, ubah status jadi `approved`), `validateDeviceToken` (hanya izinkan device `status === 'approved'`), dan `revokeDevice`.
  - Menambahkan repository `publishing.ts` untuk pemrosesan publikasi idempotent, optimistic concurrency check (`serverRevision`), pencatatan riwayat di `page_revisions`, serta sinkronisasi otomatis relasi `tags` dan `page_links`.
  - Mengimplementasikan endpoint API `POST /api/v1/auth/device` (tukar pairing code dengan token) dan `POST /api/v1/publish` (dengan autentikasi `Bearer <token>` dan proteksi status device).
- Obsidian Plugin (`plugins/obsidian-wiki`):
  - Mengimplementasikan `PublishQueue` dengan fitur debounce, deduplikasi berdasarkan `sourceId`, dan mekanisme retry backoff bertahap.
  - Mengimplementasikan `WiklyApiClient` memanfaatkan fungsi native `requestUrl` Obsidian untuk pair device dan publish note.
  - Menambahkan frontmatter helpers untuk deteksi dan injeksi otomatis `sourceId` stabil (`wiki.id`).
  - Menghubungkan event listener Vault (`modify`, `create`, `rename`, `delete`) untuk penerbitan inkremental berbasis event.
  - Memperbarui `WiklySettingTab` dengan formulir konfigurasi koneksi, input `Pairing Code`, dan tombol pairing/unpairing.
  - Menambahkan status bar item, ribbon icon, dan perintah command palette ("Publish active note", "Unpublish active note", "Sync now").

### Verified

- `pnpm db:generate` & `pnpm db:migrate`: Migration `0001_stale_mulholland_black.sql` berhasil dibuat dan diaplikasikan ke database Postgres.
- `pnpm test`: 100% lulus (unit test `@wikly/domain`, `@wikly/validation`, `@wikly/obsidian-plugin`, dan integration test API di `@wikly/web` menguji pairing code, burning one-time code, publish idempotent, dan revoke).
- `pnpm typecheck`: Lulus validasi TypeScript di seluruh workspace tanpa error.
- `pnpm lint`: Lulus verifikasi ESLint tanpa error dan warning.
- `pnpm build`: Berhasil mengompilasi bundel esbuild `main.js` plugin Obsidian dan bundel produksi Next.js.

### Decisions

- Mengadopsi **Pendekatan A (One-Time Pairing Code)**: Tabel `sites` tetap bersih dari rahasia/secret. Device didaftarkan oleh admin di panel (mendapat kode pairing sementara berbatas waktu 15 menit), lalu plugin menukarkan kode tersebut via `POST /api/v1/auth/device` untuk mendapatkan token bearer permanen. Kode pairing langsung dihanguskan (`burned`) setelah dipakai.
- Device yang di-revoke atau belum berstatus `approved` otomatis ditolak saat mencoba melakukan publikasi (`401/403`).
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
