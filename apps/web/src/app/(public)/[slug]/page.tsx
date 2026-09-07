import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata, Route } from 'next'
import { Calendar, ChevronRight, Hash, Tag } from 'lucide-react'
import { extractAliases, slugify } from '@wikly/domain'
import { sitesRepo, pagesRepo, assetsRepo } from '@/lib/db'
import { renderMarkdown } from '@/lib/markdown/pipeline'
import { Backlinks } from '@/components/Backlinks'
import { RelatedPages } from '@/components/RelatedPages'
import { TableOfContents } from '@/components/TableOfContents'
import { GraphView } from '@/components/GraphView'
import { MermaidRenderer } from '@/components/MermaidRenderer'
import { ExcalidrawViewer } from '@/components/ExcalidrawViewer'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const site = await sitesRepo.getSiteBySlug('default')
  if (!site) return { title: 'Wikly' }

  const res = await pagesRepo.getPublishedPageBySlugOrAlias(site.id, slug)
  if (!res) return { title: 'Catatan Tidak Ditemukan' }

  return {
    title: res.page.title,
    description: `Catatan ${res.page.title} di ${site.name}`,
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params
  const site = await sitesRepo.getSiteBySlug('default')
  if (!site) notFound()

  // 1. Resolve page or alias
  const resolution = await pagesRepo.getPublishedPageBySlugOrAlias(
    site.id,
    slug,
  )
  if (!resolution) notFound()

  // If accessed via alias, redirect to canonical slug
  if (resolution.isAlias) {
    redirect(`/${resolution.canonicalSlug}` as Route<string>)
  }

  const page = resolution.page

  // 2. Fetch published pages pool for transclusion and broken links resolution
  const allPublished = await pagesRepo.getPublishedPages(site.id, 500)
  const knownSlugs = new Set(allPublished.map((p) => p.slug))
  const publishedMap = new Map(allPublished.map((p) => [p.slug, p]))

  // Also index by alias
  for (const p of allPublished) {
    const pAliases = extractAliases(p.frontmatter as Record<string, unknown>)
    for (const a of pAliases) {
      publishedMap.set(slugify(a), p)
    }
  }

  // 3. Render markdown with transclusions, math, mermaid, and asset embeds
  const assetMap = await assetsRepo.getPageAssetMap(page.id)
  const { html, toc } = await renderMarkdown(page.markdown, {
    assetMap,
    knownSlugs,
    getNoteContent: (target) => {
      const targetSlug = slugify(target)
      const found = publishedMap.get(targetSlug)
      if (found) {
        return {
          title: found.title,
          markdown: found.markdown,
          slug: found.slug,
        }
      }
      return null
    },
  })

  // 4. Fetch backlinks and related pages
  const backlinks = await pagesRepo.getPageBacklinks(page.id)
  const relatedPages = await pagesRepo.getRelatedPages(site.id, page.id, 4)

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
  }).format(page.updatedAt)

  const aliases = extractAliases(page.frontmatter as Record<string, unknown>)

  return (
    <div className="content-inner">
      <article className="article-container">
        <header className="page-header">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Beranda</Link>
            <ChevronRight size={14} />
            <span>{page.title}</span>
          </nav>
          <h1 className="page-title">{page.title}</h1>

          {aliases.length > 0 && (
            <div className="page-aliases" title="Nama alternatif catatan ini">
              <span className="aliases-label">Juga dikenal sebagai:</span>
              <div className="aliases-list">
                {aliases.map((alias) => (
                  <span key={alias} className="alias-chip">
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="page-meta">
            <div className="meta-date">
              <Calendar size={14} />
              <span>Diperbarui {formattedDate}</span>
            </div>

            {page.tags.length > 0 && (
              <div className="tags-group">
                {page.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/tags/${tag.slug}` as Route<string>}
                    className="tag-badge"
                  >
                    <Hash size={12} />
                    <span>{tag.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Client Renderers */}
        <MermaidRenderer />
        <ExcalidrawViewer />

        <div
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Backlinks */}
        <Backlinks backlinks={backlinks} />

        {/* Related Pages */}
        <RelatedPages pages={relatedPages} />

        {/* Neighborhood Note Graph */}
        <section className="article-graph-section">
          <GraphView
            compact
            currentSlug={page.slug}
            depth={1}
            title="Graf Lingkungan Catatan"
            height={320}
          />
        </section>
      </article>

      <TableOfContents toc={toc} />
    </div>
  )
}
