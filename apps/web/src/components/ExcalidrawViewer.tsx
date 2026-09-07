'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Maximize2, Minimize2 } from 'lucide-react'

interface ExcalidrawPayload {
  type?: string
  version?: number
  source?: string
  elements?: unknown[]
  appState?: Record<string, unknown>
  files?: Record<string, unknown>
}

export function ExcalidrawViewer() {
  const [fullscreenId, setFullscreenId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function renderExcalidrawEmbeds() {
      const embeds = document.querySelectorAll<HTMLElement>('.excalidraw-embed')
      if (embeds.length === 0) return

      for (let i = 0; i < embeds.length; i++) {
        const container = embeds[i]
        if (!container || container.getAttribute('data-rendered') === 'true') {
          continue
        }

        const src = container.getAttribute('data-src')
        const title = container.getAttribute('data-title') || 'Diagram'
        const embedId = `excalidraw-embed-${i}`
        container.setAttribute('id', embedId)

        if (!src) continue

        try {
          const res = await fetch(src)
          if (!res.ok) {
            throw new Error(`Gagal memuat berkas (${res.status})`)
          }

          const rawData: unknown = await res.json()
          if (!rawData || typeof rawData !== 'object') {
            throw new Error('Format Excalidraw tidak valid')
          }

          const excalidraw = rawData as ExcalidrawPayload
          const utilsModule = await import('@excalidraw/utils')
          const exportToSvg = utilsModule.exportToSvg

          // Generate read-only SVG
          const svg = await exportToSvg({
            elements: (excalidraw.elements || []) as never[],
            appState: {
              ...(excalidraw.appState || {}),
              exportWithDarkMode: true,
              exportBackground: false,
            },
            files: (excalidraw.files || null) as never,
          })

          if (!isMounted) return

          svg.classList.add('excalidraw-svg')
          svg.setAttribute('role', 'img')
          svg.setAttribute('aria-label', title)

          // Clear loading and append SVG
          container.innerHTML = ''
          container.appendChild(svg)
          container.setAttribute('data-rendered', 'true')
        } catch (err) {
          if (!isMounted) return
          const msg = err instanceof Error ? err.message : 'Gagal merender'
          container.innerHTML = `
            <div class="excalidraw-error">
              <span class="excalidraw-error-icon">⚠️</span>
              <div>
                <strong>Gagal memuat Excalidraw: ${title}</strong>
                <div class="excalidraw-error-msg">${msg}</div>
              </div>
            </div>
          `
        }
      }
    }

    renderExcalidrawEmbeds()

    return () => {
      isMounted = false
    }
  }, [])

  return null
}
