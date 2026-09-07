'use client'

import { useEffect } from 'react'

export function MermaidRenderer() {
  useEffect(() => {
    let isMounted = true

    async function renderDiagrams() {
      const elements = document.querySelectorAll<HTMLElement>('pre.mermaid')
      if (elements.length === 0) return

      try {
        const mermaidModule = await import('mermaid')
        const mermaid = mermaidModule.default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'inherit',
        })

        if (isMounted) {
          await mermaid.run({
            nodes: Array.from(elements),
          })
        }
      } catch (err) {
        console.warn('Failed to render mermaid diagram:', err)
      }
    }

    renderDiagrams()

    return () => {
      isMounted = false
    }
  }, [])

  return null
}
