import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight, Network, Share2 } from 'lucide-react'
import { sitesRepo, pagesRepo } from '@/lib/db'
import { GraphView } from '@/components/GraphView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Graf Relasi Catatan',
  description:
    'Visualisasi interaktif graf relasi antar catatan dalam vault Obsidian',
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
            <Link href="/">Beranda</Link>
            <ChevronRight size={14} />
            <span>Graf Relasi</span>
          </nav>
          <div className="graph-page-title-row">
            <div>
              <h1 className="page-title">Graf Pengetahuan Vault</h1>
              <p className="page-subtitle">
                Visualisasi interaktif peta keterhubungan dan jejaring pemikiran
                antar catatan
              </p>
            </div>
            <div className="graph-stats-badges">
              <span className="stat-badge">
                <Network size={14} />
                <strong>{graphData.nodes.length}</strong> Catatan
              </span>
              <span className="stat-badge">
                <Share2 size={14} />
                <strong>{graphData.links.length}</strong> Tautan
              </span>
            </div>
          </div>
        </header>

        <div className="graph-viewport-wrapper">
          <GraphView
            initialData={graphData}
            height={640}
            title="Peta Relasi Seluruh Vault"
          />
        </div>
      </div>
    </div>
  )
}
