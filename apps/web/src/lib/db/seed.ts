import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
config({ path: fileURLToPath(new URL('../../../../../.env', import.meta.url)) })

import { db } from './client'
import { pageLinks, pages, pageTags, sites, tags, users } from './schema'
import crypto from 'crypto'

async function seed() {
  console.log('Seeding database with rich Phase 2 wiki content...')

  // Clear existing data in correct FK order
  await db.delete(pageLinks)
  await db.delete(pageTags)
  await db.delete(tags)
  await db.delete(pages)
  await db.delete(sites)
  await db.delete(users)

  // Seed Admin User
  const adminEmail = 'admin@wikly.local'
  const passwordHash = crypto
    .createHash('sha256')
    .update('password123')
    .digest('hex')
  await db.insert(users).values({
    email: adminEmail,
    passwordHash,
  })
  console.log(`✓ Created admin user: ${adminEmail}`)

  // Seed Default Site
  const [site] = await db
    .insert(sites)
    .values({
      name: 'Wikly Documentation',
      slug: 'default',
    })
    .returning()
  console.log(`✓ Created site: ${site.name} (${site.slug})`)

  // Seed Tags
  const [tagGuide, tagObsidian, tagArch] = await db
    .insert(tags)
    .values([
      { siteId: site.id, name: 'Guide', slug: 'guide' },
      { siteId: site.id, name: 'Obsidian', slug: 'obsidian' },
      { siteId: site.id, name: 'Architecture', slug: 'architecture' },
    ])
    .returning()
  console.log(`✓ Created tags: Guide, Obsidian, Architecture`)

  // Seed Pages
  const [homePage, gettingStartedPage, archPage] = await db
    .insert(pages)
    .values([
      {
        siteId: site.id,
        sourceId: 'vault/home.md',
        path: 'home.md',
        title: 'Selamat Datang di Wikly',
        slug: 'home',
        markdown: `# Selamat Datang di Wikly

Wikly menerbitkan catatan terpilih dari **Obsidian Vault** menjadi situs Wiki publik berkinerja tinggi.

> [!note] Single Source of Truth
> Obsidian Vault Anda selalu menjadi sumber kebenaran (*source of truth*). Database PostgreSQL hanyalah proyeksi publik yang dapat dibangun ulang kapan saja.

## Fitur Utama

- **Wikilinks Otomatis**: Jelajahi catatan seperti [[Getting Started]] atau [[Architecture Guide|Panduan Arsitektur]].
- **Obsidian Callouts**: Mendukung format catatan peringatan, info, dan tips bawaan Obsidian.
- **Hubungan Dua Arah (Backlinks)**: Hubungan antar catatan terekam secara otomatis di footer setiap halaman.

Pelajari langkah instalasi di [[Getting Started]].`,
        frontmatter: {
          title: 'Selamat Datang di Wikly',
          tags: ['guide', 'obsidian'],
        },
        status: 'published',
        contentHash: 'hash-home-v1',
        revision: 1,
        publishedAt: new Date(),
      },
      {
        siteId: site.id,
        sourceId: 'vault/getting-started.md',
        path: 'getting-started.md',
        title: 'Getting Started',
        slug: 'getting-started',
        markdown: `# Memulai dengan Wikly

Panduan ringkas untuk menghubungkan Obsidian dan menerbitkan catatan pertama Anda.

> [!tip] Praktik Terbaik
> Berikan flag \`published: true\` pada frontmatter catatan Anda di Obsidian sebelum memicu proses publish.

## Konfigurasi Plugin

Jalankan perintah build plugin lokal:

\`\`\`bash
pnpm dev:plugin
\`\`\`

Setelah plugin terpasang, sinkronisasi catatan akan diproyeksikan ke publik.

Kembali ke [[Home|Halaman Utama]] atau pelajari [[Architecture Guide]].`,
        frontmatter: { title: 'Getting Started', tags: ['guide'] },
        status: 'published',
        contentHash: 'hash-gs-v1',
        revision: 1,
        publishedAt: new Date(),
      },
      {
        siteId: site.id,
        sourceId: 'vault/architecture-guide.md',
        path: 'architecture-guide.md',
        title: 'Architecture Guide',
        slug: 'architecture-guide',
        markdown: `# Panduan Arsitektur Wikly

Wikly dibangun dengan arsitektur monorepo modular untuk performa dan isolasi tanggung jawab yang aman.

> [!warning] Batasan Keamanan
> Plugin Obsidian tidak memiliki akses langsung ke database; semua interaksi melewati authenticated HTTP API.

## Komponen Sistem

| Komponen | Peran |
| --- | --- |
| \`apps/web\` | Next.js Wiki publik & admin workspace |
| \`plugins/obsidian-wiki\` | Jembatan penerbitan di dalam Obsidian |
| \`packages/domain\` | Aturan bisnis independen framework |

Tautan terkait: lihat [[Getting Started]] dan [[Home]].`,
        frontmatter: {
          title: 'Architecture Guide',
          tags: ['architecture', 'guide'],
        },
        status: 'published',
        contentHash: 'hash-arch-v1',
        revision: 1,
        publishedAt: new Date(),
      },
    ])
    .returning()
  console.log(
    `✓ Created 3 published pages: Home, Getting Started, Architecture Guide`,
  )

  // Associate Page Tags
  await db.insert(pageTags).values([
    { pageId: homePage.id, tagId: tagGuide.id },
    { pageId: homePage.id, tagId: tagObsidian.id },
    { pageId: gettingStartedPage.id, tagId: tagGuide.id },
    { pageId: archPage.id, tagId: tagArch.id },
    { pageId: archPage.id, tagId: tagGuide.id },
  ])
  console.log(`✓ Associated page tags`)

  // Associate Page Links for Backlinks
  await db.insert(pageLinks).values([
    {
      sourcePageId: homePage.id,
      targetPageId: gettingStartedPage.id,
      linkText: 'Getting Started',
    },
    {
      sourcePageId: homePage.id,
      targetPageId: archPage.id,
      linkText: 'Panduan Arsitektur',
    },
    {
      sourcePageId: gettingStartedPage.id,
      targetPageId: homePage.id,
      linkText: 'Halaman Utama',
    },
    {
      sourcePageId: gettingStartedPage.id,
      targetPageId: archPage.id,
      linkText: 'Architecture Guide',
    },
    { sourcePageId: archPage.id, targetPageId: homePage.id, linkText: 'Home' },
    {
      sourcePageId: archPage.id,
      targetPageId: gettingStartedPage.id,
      linkText: 'Getting Started',
    },
  ])
  console.log(`✓ Created page link graph for backlinks`)

  console.log('Seeding complete successfully!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
