import type { App, TFile } from 'obsidian'
import {
  computeBinaryHash,
  detectMimeType,
  extractAssetReferences,
} from '@wikly/domain'

export interface VaultAsset {
  file: TFile
  path: string
  hash: string
  mimeType: string
  sizeBytes: number
  data: ArrayBuffer
}

/**
 * Scan markdown for asset references and resolve binary vault files and checksums.
 */
export async function scanNoteAssets(
  app: App,
  markdown: string,
  sourcePath: string,
): Promise<VaultAsset[]> {
  const refs = extractAssetReferences(markdown)
  if (refs.length === 0) {
    return []
  }

  const assets: VaultAsset[] = []
  const seenPaths = new Set<string>()

  for (const ref of refs) {
    // Resolve linkpath using Obsidian's metadata cache resolver
    let targetFile = app.metadataCache.getFirstLinkpathDest(
      ref.path,
      sourcePath,
    )

    // Fallback: direct vault lookup
    if (!targetFile) {
      const file = app.vault.getAbstractFileByPath(ref.path)
      if (file && 'stat' in file) {
        targetFile = file as TFile
      }
    }

    if (!targetFile || seenPaths.has(targetFile.path)) {
      continue
    }

    seenPaths.add(targetFile.path)

    try {
      const data = await app.vault.readBinary(targetFile)
      const hash = computeBinaryHash(new Uint8Array(data))
      const mimeType = detectMimeType(targetFile.name)

      assets.push({
        file: targetFile,
        path: targetFile.path,
        hash,
        mimeType,
        sizeBytes: targetFile.stat.size || data.byteLength,
        data,
      })
    } catch {
      // Ignore if file read fails
    }
  }

  return assets
}
