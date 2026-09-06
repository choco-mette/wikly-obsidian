import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Calendar, ChevronRight, Hash } from 'lucide-react'
import { sitesRepo, pagesRepo } from '../../lib/db'
import { renderMarkdown } from '../../lib/markdown/pipeline'
import { Backlinks } from '../../components/Backlinks'
import { TableOfContents } from '../../components/TableOfContents'

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

  const page = await pagesRepo.getPublishedPageBySlug(site.id, slug)
  if (!page) return { title: 'Catatan Tidak Ditemukan' }

  return {
    title: page.title,
    description: `Catatan ${page.title} di ${site.name}`,
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params
  const site = await sitesRepo.getSiteBySlug('default')
  if (!site) notFound()

  const page = await pagesRepo.getPublishedPageBySlug(site.id, slug)
  if (!page) notFound()

  const { html, toc } = await renderMarkdown(page.markdown)
  const backlinks = await pagesRepo.getPageBacklinks(page.id)

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
  }).format(page.updatedAt)

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
          <div className="page-meta">
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Calendar size={15} />
              <span>Diperbarui {formattedDate}</span>
            </div>
            {page.tags.length > 0 && (
              <div className="tags-group">
                {page.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/tags/${tag.slug}`}
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

        <div
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <Backlinks backlinks={backlinks} />
      </article>

      <TableOfContents toc={toc} />
    </div>
  )
}
