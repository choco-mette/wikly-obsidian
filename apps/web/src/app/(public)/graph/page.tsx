import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight, Network, Share2 } from 'lucide-react'
import { sitesRepo, pagesRepo } from '@/lib/db'
import { GraphView } from '@/components/GraphView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Vault Graph View',
  description:
    'Interactive graph visualization of note relationships in this Obsidian vault',
}

export default async function GraphPage() {
  const site = await sitesRepo.getSiteBySlug('default')
  if (!site) return null

  const graphData = await pagesRepo.getGraphData(site.id)

  return (
    <div className="content-inner graph-page-inner">
      <div className="graph-page-container">
        <header className="page-header">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <ChevronRight size={14} />
            <span>Graph View</span>
          </nav>
          <div className="graph-page-title-row">
            <div>
              <h1 className="page-title">Vault Knowledge Graph</h1>
              <p className="page-subtitle">
                Interactive knowledge graph exploring connections between notes
                across the vault
              </p>
            </div>
            <div className="graph-stats-badges">
              <span className="stat-badge">
                <Network size={14} />
                <strong>{graphData.nodes.length}</strong> Notes
              </span>
              <span className="stat-badge">
                <Share2 size={14} />
                <strong>{graphData.links.length}</strong> Relations
              </span>
            </div>
          </div>
        </header>

        <div className="graph-viewport-wrapper">
          <GraphView
            initialData={graphData}
            height={640}
            title="Full Vault Relationship Graph"
          />
        </div>
      </div>
    </div>
  )
}
