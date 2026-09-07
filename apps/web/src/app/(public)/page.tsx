import Link from 'next/link'
import { Calendar, Hash } from 'lucide-react'
import { sitesRepo, pagesRepo, assetsRepo } from '@/lib/db'
import { renderMarkdown } from '@/lib/markdown/pipeline'
import { Backlinks } from '@/components/Backlinks'
import { TableOfContents } from '@/components/TableOfContents'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const site = await sitesRepo.getSiteBySlug('default')

  if (!site) {
    return (
      <div className="content-inner">
        <div className="article-container">
          <h1 className="page-title">Wikly</h1>
          <p>
            Situs belum dikonfigurasi. Jalankan seeder database terlebih dahulu.
          </p>
        </div>
      </div>
    )
  }

  const page = await pagesRepo.getPublishedPageBySlug(site.id, 'home')

  if (!page) {
    return (
      <div className="content-inner">
        <div className="article-container">
          <h1 className="page-title">{site.name}</h1>
          <p>Belum ada halaman &lsquo;home&rsquo; yang dipublikasikan.</p>
        </div>
      </div>
    )
  }

  const assetMap = await assetsRepo.getPageAssetMap(page.id)
  const { html, toc } = await renderMarkdown(page.markdown, { assetMap })
  const backlinks = await pagesRepo.getPageBacklinks(page.id)

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
  }).format(page.updatedAt)

  return (
    <div className="content-inner">
      <article className="article-container">
        <header className="page-header">
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
