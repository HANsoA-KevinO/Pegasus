import { ToolResult } from '../types'
import { WorkspaceInstance } from '../workspace/types'

interface AssembleSVGInput {
  svg_path: string
  manifest_path: string
  output_path?: string
}

/**
 * Read SVG template + icon manifest, replace placeholders with embedded icon images.
 *
 * Matching strategy (3-level fallback, inspired by AutoFigure-Edit):
 * 1. Match by `id` attribute: <rect id="icon_1" ...> or <g id="icon_1">
 * 2. Match by `data-icon` attribute: <rect data-icon="1" ...>
 * 3. Match by approximate coordinates (±15px tolerance)
 */
export async function executeAssembleSVG(
  input: AssembleSVGInput,
  workspace: WorkspaceInstance
): Promise<ToolResult> {
  const { svg_path, manifest_path, output_path } = input
  const finalPath = output_path || svg_path

  console.log(`[assemble-svg] SVG: ${svg_path} | manifest: ${manifest_path} | output: ${finalPath}`)

  try {
    const svgContent = await workspace.read(svg_path)
    if (!svgContent) {
      return { content: `SVG file not found: ${svg_path}`, is_error: true }
    }

    const manifestContent = await workspace.read(manifest_path)
    if (!manifestContent) {
      return { content: `Manifest not found: ${manifest_path}`, is_error: true }
    }

    const manifest = JSON.parse(manifestContent)
    const regions: Array<{
      id: number
      x: number
      y: number
      width: number
      height: number
      icon_path: string
    }> = manifest.regions

    if (!regions || regions.length === 0) {
      return { content: 'Manifest contains no regions', is_error: true }
    }

    let svg = svgContent
    let replacedCount = 0
    let appendedCount = 0
    const results: string[] = []

    for (const region of regions) {
      const iconBase64 = await workspace.read(region.icon_path)
      if (!iconBase64) {
        results.push(`icon_${region.id}: SKIP (file not found: ${region.icon_path})`)
        continue
      }

      let matched = false

      // Strategy 1: Match by id attribute
      // Look for <rect id="icon_1" ...> or <g id="icon_1">...</g>
      const idPatterns = [
        new RegExp(`<rect[^>]*\\bid=["']?icon_${region.id}["']?[^>]*/?>`, 'i'),
        new RegExp(`<g[^>]*\\bid=["']?icon_${region.id}["']?[^>]*>[\\s\\S]*?</g>`, 'i'),
      ]

      for (const pattern of idPatterns) {
        const match = svg.match(pattern)
        if (match) {
          // Extract position/size from the matched SVG element (not the manifest)
          const coords = extractRectAttrs(match[0])
          const imageTag = buildImageTag(
            region.id,
            coords?.x ?? region.x,
            coords?.y ?? region.y,
            coords?.width ?? region.width,
            coords?.height ?? region.height,
            iconBase64
          )
          svg = svg.replace(match[0], imageTag)
          results.push(`icon_${region.id}: replaced (id match, pos=${coords ? 'svg' : 'manifest'})`)
          matched = true
          replacedCount++
          break
        }
      }

      if (matched) continue

      // Strategy 2: Match by data-icon attribute
      const dataIconPattern = new RegExp(
        `<rect[^>]*\\bdata-icon=["']?${region.id}["']?[^>]*/?>`, 'i'
      )
      const dataMatch = svg.match(dataIconPattern)
      if (dataMatch) {
        const coords = extractRectAttrs(dataMatch[0])
        const imageTag = buildImageTag(
          region.id,
          coords?.x ?? region.x,
          coords?.y ?? region.y,
          coords?.width ?? region.width,
          coords?.height ?? region.height,
          iconBase64
        )
        svg = svg.replace(dataMatch[0], imageTag)
        results.push(`icon_${region.id}: replaced (data-icon match, pos=${coords ? 'svg' : 'manifest'})`)
        replacedCount++
        continue
      }

      // Strategy 3: Approximate coordinate match (±15px tolerance)
      const tolerance = 15
      const rectPattern = /<rect[^>]*\bx=["']?([\d.]+)["']?[^>]*\by=["']?([\d.]+)["']?[^>]*\bwidth=["']?([\d.]+)["']?[^>]*\bheight=["']?([\d.]+)["']?[^>]*\/?>/gi
      let coordMatch: RegExpExecArray | null
      let bestMatch: { match: string; dist: number; x: number; y: number; w: number; h: number } | null = null

      // Reset lastIndex
      rectPattern.lastIndex = 0
      while ((coordMatch = rectPattern.exec(svg)) !== null) {
        const rx = parseFloat(coordMatch[1])
        const ry = parseFloat(coordMatch[2])
        const rw = parseFloat(coordMatch[3])
        const rh = parseFloat(coordMatch[4])
        const dx = Math.abs(rx - region.x)
        const dy = Math.abs(ry - region.y)
        if (dx <= tolerance && dy <= tolerance) {
          const dist = dx + dy
          if (!bestMatch || dist < bestMatch.dist) {
            bestMatch = { match: coordMatch[0], dist, x: rx, y: ry, w: rw, h: rh }
          }
        }
      }

      if (bestMatch) {
        // Use the matched rect's coordinates from the SVG
        const imageTag = buildImageTag(region.id, bestMatch.x, bestMatch.y, bestMatch.w, bestMatch.h, iconBase64)
        svg = svg.replace(bestMatch.match, imageTag)
        results.push(`icon_${region.id}: replaced (coord match, dist=${bestMatch.dist.toFixed(0)})`)
        replacedCount++
        continue
      }

      // Fallback: append before </svg> using manifest coordinates
      const imageTag = buildImageTag(region.id, region.x, region.y, region.width, region.height, iconBase64)
      svg = svg.replace('</svg>', `  ${imageTag}\n</svg>`)
      results.push(`icon_${region.id}: appended (no placeholder found)`)
      appendedCount++
    }

    await workspace.write(finalPath, svg)

    const summary = `Assembly complete: ${replacedCount} replaced, ${appendedCount} appended, ${regions.length} total icons`
    console.log(`[assemble-svg] ${summary}`)
    for (const r of results) {
      console.log(`  ${r}`)
    }

    return {
      content: `${summary}\n\nDetails:\n${results.join('\n')}\n\nSaved to ${finalPath}`,
    }
  } catch (err) {
    const errMsg = (err as Error).message
    console.error('[assemble-svg] Error:', errMsg)
    return { content: `AssembleSVG error: ${errMsg}`, is_error: true }
  }
}

/** Extract x, y, width, height from a matched SVG element string */
function extractRectAttrs(elStr: string): { x: number; y: number; width: number; height: number } | null {
  const xM = elStr.match(/\bx=["']?([\d.]+)/)
  const yM = elStr.match(/\by=["']?([\d.]+)/)
  const wM = elStr.match(/\bwidth=["']?([\d.]+)/)
  const hM = elStr.match(/\bheight=["']?([\d.]+)/)
  if (xM && yM && wM && hM) {
    return {
      x: parseFloat(xM[1]),
      y: parseFloat(yM[1]),
      width: parseFloat(wM[1]),
      height: parseFloat(hM[1]),
    }
  }
  return null
}

function buildImageTag(
  id: number,
  x: number,
  y: number,
  width: number,
  height: number,
  base64: string
): string {
  return `<image id="icon_${id}" x="${x}" y="${y}" width="${width}" height="${height}" href="data:image/png;base64,${base64}" xlink:href="data:image/png;base64,${base64}" preserveAspectRatio="xMidYMid meet"/>`
}
