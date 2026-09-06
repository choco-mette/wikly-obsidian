import type { TocItem } from '../lib/markdown/pipeline'

interface TableOfContentsProps {
  toc: TocItem[]
}

export function TableOfContents({ toc }: TableOfContentsProps) {
  if (toc.length < 2) return null

  return (
    <aside className="toc-container" aria-label="Table of contents">
      <div className="toc-card">
        <h3 className="toc-title">Daftar Isi</h3>
        <nav>
          <ul className="toc-list">
            {toc.map((item) => (
              <li
                key={item.id}
                className={`toc-item toc-level-${item.level}`}
                style={{ paddingLeft: `${(item.level - 1) * 0.75}rem` }}
              >
                <a href={`#${item.id}`} className="toc-link">
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  )
}
