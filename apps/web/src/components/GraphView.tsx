'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import type {
  GraphDataDto,
  GraphNodeDto,
  GraphResponse,
} from '@wikly/api-contracts'

export interface GraphViewProps {
  currentSlug?: string
  initialData?: GraphDataDto
  depth?: number
  compact?: boolean
  height?: number | string
  title?: string
}

interface SimNode extends SimulationNodeDatum {
  id: string
  slug: string
  title: string
  isCurrent?: boolean
  linkCount: number
  radius: number
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode
  target: string | SimNode
}

export function GraphView({
  currentSlug,
  initialData,
  depth = 1,
  compact = false,
  height = compact ? 300 : 500,
  title = 'Note Relations',
}: GraphViewProps) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [fetchedData, setFetchedData] = useState<GraphDataDto | null>(null)
  const graphData = initialData || fetchedData
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)

  // Transform state for pan and zoom
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const [zoomLevel, setZoomLevel] = useState(1)

  // Simulation & interaction refs
  const simulationRef = useRef<ReturnType<
    typeof forceSimulation<SimNode>
  > | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const linksRef = useRef<SimLink[]>([])
  const hoveredNodeRef = useRef<SimNode | null>(null)
  const draggedNodeRef = useRef<SimNode | null>(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })

  // 1. Fetch graph data if not provided
  useEffect(() => {
    if (initialData) {
      return
    }

    let isMounted = true
    async function fetchGraph() {
      setLoading(true)
      setError(null)
      try {
        const queryParams = new URLSearchParams()
        if (currentSlug) queryParams.set('slug', currentSlug)
        if (depth) queryParams.set('depth', depth.toString())

        const res = await fetch(`/api/v1/graph?${queryParams.toString()}`)
        if (!res.ok) throw new Error('Failed to load note relationships')
        const json: GraphResponse = await res.json()
        if (!json.success || !json.data) {
          throw new Error(json.error || 'Graph data is empty')
        }

        if (isMounted) {
          setFetchedData(json.data)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Network error')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchGraph()

    return () => {
      isMounted = false
    }
  }, [currentSlug, depth, initialData])

  // 2. Initialize and run force simulation
  useEffect(() => {
    if (!graphData || !canvasRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const container = containerRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = container.clientWidth || 600
    const heightPx = typeof height === 'number' ? height : 400

    // High-DPI screen support
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = heightPx * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${heightPx}px`

    // Reset pan/zoom
    transformRef.current = { x: width / 2, y: heightPx / 2, k: 1 }
    setZoomLevel(1)

    // Prepare nodes with radius based on degree
    const nodes: SimNode[] = graphData.nodes.map((n) => ({
      ...n,
      radius: Math.max(5, Math.min(18, 6 + n.linkCount * 1.5)),
    }))

    // Prepare links
    const links: SimLink[] = graphData.links.map((l) => ({
      source: l.source,
      target: l.target,
    }))

    nodesRef.current = nodes
    linksRef.current = links

    // Stop previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop()
    }

    const sim = forceSimulation<SimNode>(nodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(compact ? 45 : 75),
      )
      .force('charge', forceManyBody().strength(compact ? -120 : -180))
      .force('center', forceCenter(0, 0))
      .force(
        'collision',
        forceCollide<SimNode>().radius((d) => d.radius + 6),
      )
      .alphaDecay(0.02)

    simulationRef.current = sim

    const render = () => {
      ctx.save()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)

      const { x: tx, y: ty, k } = transformRef.current
      ctx.translate(tx, ty)
      ctx.scale(k, k)

      const hoveredNode = hoveredNodeRef.current

      // Draw links
      for (const link of links) {
        const source = link.source as SimNode
        const target = link.target as SimNode
        if (
          !source ||
          !target ||
          source.x === undefined ||
          target.x === undefined
        ) {
          continue
        }

        const isHighlighted =
          hoveredNode &&
          (source.id === hoveredNode.id || target.id === hoveredNode.id)

        ctx.beginPath()
        ctx.moveTo(source.x, source.y || 0)
        ctx.lineTo(target.x, target.y || 0)
        ctx.lineWidth = isHighlighted ? 2 / k : 1 / k
        ctx.strokeStyle = isHighlighted
          ? 'rgba(147, 197, 253, 0.9)'
          : 'rgba(148, 163, 184, 0.25)'
        ctx.stroke()
      }

      // Draw nodes
      for (const node of nodes) {
        if (node.x === undefined || node.y === undefined) continue

        const isHovered = hoveredNode?.id === node.id
        const isCurrent = node.isCurrent === true
        const isNeighbor =
          hoveredNode &&
          links.some((l) => {
            const s = l.source as SimNode
            const t = l.target as SimNode
            return (
              (s.id === hoveredNode.id && t.id === node.id) ||
              (t.id === hoveredNode.id && s.id === node.id)
            )
          })

        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI)

        if (isCurrent) {
          ctx.fillStyle = '#60a5fa' // bright blue for current page
        } else if (isHovered) {
          ctx.fillStyle = '#38bdf8' // cyan for hover
        } else if (isNeighbor) {
          ctx.fillStyle = '#93c5fd'
        } else {
          ctx.fillStyle = '#94a3b8' // slate for other nodes
        }
        ctx.fill()

        // Highlight ring
        if (isCurrent || isHovered) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, node.radius + 3 / k, 0, 2 * Math.PI)
          ctx.strokeStyle = isCurrent ? '#3b82f6' : '#38bdf8'
          ctx.lineWidth = 2 / k
          ctx.stroke()
        }

        // Draw node title text
        if (
          !compact ||
          isCurrent ||
          isHovered ||
          isNeighbor ||
          (k > 1.2 && node.linkCount > 1)
        ) {
          ctx.font = `${Math.max(9, Math.min(13, 10 / k + 2))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
          ctx.fillStyle = isCurrent || isHovered ? '#f8fafc' : '#cbd5e1'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(node.title, node.x, node.y + node.radius + 3)
        }
      }

      ctx.restore()
    }

    sim.on('tick', render)

    return () => {
      sim.stop()
    }
  }, [graphData, compact, height])

  // Mouse coordinate helper
  const getSimCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const { x: tx, y: ty, k } = transformRef.current
    return {
      x: (mouseX - tx) / k,
      y: (mouseY - ty) / k,
      rawX: mouseX,
      rawY: mouseY,
    }
  }, [])

  const findNodeAt = useCallback(
    (simX: number, simY: number): SimNode | null => {
      for (const node of nodesRef.current) {
        if (node.x === undefined || node.y === undefined) continue
        const dx = node.x - simX
        const dy = node.y - simY
        if (Math.hypot(dx, dy) <= node.radius + 3) {
          return node
        }
      }
      return null
    },
    [],
  )

  // Event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getSimCoords(e)
    const node = findNodeAt(coords.x, coords.y)

    if (node) {
      draggedNodeRef.current = node
      node.fx = node.x
      node.fy = node.y
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart()
      }
    } else {
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX, y: e.clientY }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getSimCoords(e)

    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = coords.x
      draggedNodeRef.current.fy = coords.y
      return
    }

    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      panStartRef.current = { x: e.clientX, y: e.clientY }
      transformRef.current.x += dx
      transformRef.current.y += dy
      simulationRef.current?.restart()
      return
    }

    const hitNode = findNodeAt(coords.x, coords.y)
    if (hoveredNodeRef.current !== hitNode) {
      hoveredNodeRef.current = hitNode
      const canvas = canvasRef.current
      if (canvas) {
        canvas.style.cursor = hitNode ? 'pointer' : 'grab'
      }
      simulationRef.current?.restart()
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeRef.current) {
      const dragged = draggedNodeRef.current
      dragged.fx = null
      dragged.fy = null
      draggedNodeRef.current = null
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0)
      }
      return
    }

    if (isPanningRef.current) {
      isPanningRef.current = false
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getSimCoords(e)
    const node = findNodeAt(coords.x, coords.y)
    if (node && node.slug) {
      router.push(`/${node.slug}` as Route<string>)
    }
  }

  // Non-passive wheel event listener on container to zoom towards mouse and prevent page scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const { x: tx, y: ty, k } = transformRef.current

      // Calculate graph coordinates under cursor
      const simX = (mouseX - tx) / k
      const simY = (mouseY - ty) / k

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85
      const newK = Math.max(0.25, Math.min(3.5, k * zoomFactor))

      // Zoom towards mouse cursor position
      transformRef.current = {
        x: mouseX - simX * newK,
        y: mouseY - simY * newK,
        k: newK,
      }

      setZoomLevel(newK)
      simulationRef.current?.restart()
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [])

  const resetView = () => {
    const container = containerRef.current
    if (!container) return
    const width = container.clientWidth
    const heightPx = typeof height === 'number' ? height : 400
    transformRef.current = { x: width / 2, y: heightPx / 2, k: 1 }
    setZoomLevel(1)
    simulationRef.current?.restart()
  }

  const zoomIn = () => {
    transformRef.current.k = Math.min(3, transformRef.current.k * 1.25)
    setZoomLevel(transformRef.current.k)
    simulationRef.current?.restart()
  }

  const zoomOut = () => {
    transformRef.current.k = Math.max(0.3, transformRef.current.k * 0.8)
    setZoomLevel(transformRef.current.k)
    simulationRef.current?.restart()
  }

  return (
    <div
      className={`graph-container ${compact ? 'graph-compact' : ''}`}
      ref={containerRef}
    >
      <div className="graph-header">
        <h3 className="graph-title">{title}</h3>
        <div className="graph-controls">
          <button
            type="button"
            className="graph-btn"
            onClick={zoomIn}
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            className="graph-btn"
            onClick={zoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            className="graph-btn"
            onClick={resetView}
            title="Reset View"
            aria-label="Reset View"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="graph-status">
          <span className="graph-spinner" />
          <span>Loading note relationships...</span>
        </div>
      )}

      {error && (
        <div className="graph-status graph-error">
          <span>⚠️ {error}</span>
        </div>
      )}

      {!loading && !error && graphData && graphData.nodes.length === 0 && (
        <div className="graph-status">
          <span>No connected notes</span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="graph-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        role="img"
        aria-label="Note relationship graph navigation"
      />

      <div className="graph-legend">
        <div className="legend-item">
          <span className="legend-dot dot-current" />
          <span>Current Note</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot dot-linked" />
          <span>Connected Notes</span>
        </div>
      </div>
    </div>
  )
}
