import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

// Load environment config
config({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)) })

import { db } from '../lib/db/client'
import { sitesRepo } from '../lib/db'
import { publishPage } from '../lib/db/repos/publishing'
import { createOrUpdateAsset } from '../lib/db/repos/assets'
import { getStorageDriver } from '../lib/storage'
import { computeBinaryHash, computeContentHash } from '@wikly/domain'

async function run() {
  console.log('🌱 Seeding Phase 7 Showcase page...')

  const site = await sitesRepo.getSiteBySlug('default')
  if (!site) {
    throw new Error('Default site not found. Run db:seed first.')
  }

  // 1. Create a sample Excalidraw JSON file
  const sampleExcalidraw = {
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements: [
      {
        id: 'box-vault',
        type: 'rectangle',
        x: 60,
        y: 60,
        width: 180,
        height: 90,
        angle: 0,
        strokeColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: { type: 3 },
        seed: 101,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
      },
      {
        id: 'text-vault',
        type: 'text',
        x: 85,
        y: 95,
        width: 130,
        height: 24,
        angle: 0,
        strokeColor: '#f8fafc',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: 102,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        text: 'Obsidian Vault',
        fontSize: 18,
        fontFamily: 1,
        textAlign: 'center',
        verticalAlign: 'middle',
        baseline: 16,
      },
      {
        id: 'arrow-sync',
        type: 'arrow',
        x: 240,
        y: 105,
        width: 120,
        height: 0,
        angle: 0,
        strokeColor: '#10b981',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: 103,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        points: [
          [0, 0],
          [120, 0],
        ],
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: 'arrow',
      },
      {
        id: 'box-wikly',
        type: 'rectangle',
        x: 360,
        y: 60,
        width: 180,
        height: 90,
        angle: 0,
        strokeColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: { type: 3 },
        seed: 104,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
      },
      {
        id: 'text-wikly',
        type: 'text',
        x: 385,
        y: 95,
        width: 130,
        height: 24,
        angle: 0,
        strokeColor: '#f8fafc',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: 105,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        text: 'Wikly Public',
        fontSize: 18,
        fontFamily: 1,
        textAlign: 'center',
        verticalAlign: 'middle',
        baseline: 16,
      },
    ],
    appState: {
      viewBackgroundColor: 'transparent',
      gridSize: null,
    },
    files: {},
  }

  const excalidrawBuffer = Buffer.from(
    JSON.stringify(sampleExcalidraw, null, 2),
  )
  const excalidrawHash = computeBinaryHash(excalidrawBuffer)
  const excalidrawFilename = 'diagram-arsitektur.excalidraw'

  const storage = getStorageDriver()
  const storageKey = `sites/${site.id}/assets/${excalidrawHash}/${excalidrawFilename}`
  await storage.put(storageKey, excalidrawBuffer, 'application/json')

  await createOrUpdateAsset({
    siteId: site.id,
    hash: excalidrawHash,
    filename: excalidrawFilename,
    mimeType: 'application/json',
    sizeBytes: excalidrawBuffer.length,
    storageKey,
  })
  console.log(`✓ Uploaded Excalidraw asset: ${excalidrawFilename}`)

  // 2. Prepare Markdown body demonstrating Phase 7 capabilities
  const markdown = `# Eksplorasi Fitur Phase 7 Wikly

Halaman ini mendemonstrasikan kapabilitas lanjutan Obsidian di Wikly: matematika KaTeX, diagram Mermaid, whiteboard Excalidraw read-only, transklusi catatan, penanganan tautan rusak, dan graf relasi.

> [!tip] Uji Navigasi Alias
> Halaman ini memiliki alias **demo-phase-7**. Coba buka \`/demo-phase-7\` di browser dan perhatikan auto-redirect (307) langsung ke \`/phase-7-showcase\`!

---

## 1. Matematika KaTeX

Wikly memproses formula LaTeX secara *server-side* dengan tipografi presisi tinggi.

Formula inline: Teori relativitas menyatakan bahwa energi relativistik adalah $E = mc^2$, di mana $c \\approx 3 \\times 10^8 \\text{ m/s}$.

Identitas Euler:
$$
e^{i\\pi} + 1 = 0
$$

Integral Gauss pada ruang kontinu:
$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

Deret aritmatika standar:
$$
\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}
$$

---

## 2. Diagram Alur Mermaid

Diagram berikut di-render langsung dari sintaks markdown \`\`\`mermaid:

\`\`\`mermaid
graph TD
  A[Obsidian Vault] -->|Publish Flag| B(Wikly Plugin)
  B -->|Sync Changes| C{Server Proyeksi}
  C -->|Frontmatter Patch| D[Pending Changes Queue]
  C -->|Public Projection| E[PostgreSQL DB]
  E -->|Links & Tags| F[Graph View]
  E -->|Markdown Body| G[Web Readers]
\`\`\`

---

## 3. Whiteboard Excalidraw (Read-Only)

Sesuai spesifikasi PRD Seksi 14, berkas source \`.excalidraw\` disimpan dalam format JSON murni dan di-render sebagai SVG vektor murni yang responsif tanpa editor canvas interaktif.

![[diagram-arsitektur.excalidraw]]

---

## 4. Transklusi Catatan (Note Transclusion)

Bagian berikut menyematkan isi catatan [[getting-started]] secara utuh ke dalam kartu embed:

![[getting-started]]

---

## 5. Uji Penanganan Referensi Rusak

Ketika catatan menautkan ke halaman atau media yang belum tersedia, Wikly menampilkan indikator peringatan yang ramah dan jelas:

- Tautan ke catatan belum dibuat: [[catatan-rahasia-yang-belum-dibuat]]
- Transklusi ke catatan yang hilang:
![[dokumen-arsip-hilang]]

---

## 6. Jejaring Pengetahuan & Tautan Terkait

Catatan ini saling terhubung dua arah dengan [[home]] dan [[getting-started]]. Perhatikan diagram interaktif di bawah dan panel **Halaman Terkait** yang merekomendasikan topik berdasar kesamaan tag dan koneksi relasi!
`

  const frontmatter = {
    title: 'Eksplorasi Fitur Phase 7 Wikly',
    tags: ['guide', 'phase7', 'architecture'],
    aliases: ['demo-phase-7', 'Fitur Lanjutan Obsidian'],
    wiki: {
      id: '01JPHASE7DEMO000000000001',
      published: true,
    },
  }

  const contentHash = computeContentHash(markdown, frontmatter)

  const result = await publishPage({
    siteId: site.id,
    sourceId: 'vault/phase-7-showcase.md',
    path: 'phase-7-showcase.md',
    title: 'Eksplorasi Fitur Phase 7 Wikly',
    slug: 'phase-7-showcase',
    markdown,
    frontmatter,
    contentHash,
    assets: [
      {
        path: excalidrawFilename,
        hash: excalidrawHash,
      },
    ],
  })

  console.log(
    `✓ Published page: ${result.page.slug} (revision ${result.page.revision})`,
  )
  console.log(
    '🎉 Phase 7 test page ready at /phase-7-showcase and /demo-phase-7',
  )
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding phase 7:', err)
    process.exit(1)
  })
