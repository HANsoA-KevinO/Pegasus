import puppeteer from 'puppeteer'
import { ToolResult } from '../types'
import { WorkspaceInstance } from '../workspace/types'

interface RenderSvgInput {
  svg_path: string
  output_path?: string
  scale?: number
}

/**
 * Render an SVG file to PNG using Puppeteer (headless Chrome).
 * Handles embedded base64 <image> elements correctly, unlike sharp/librsvg.
 */
export async function executeRenderSvg(
  input: RenderSvgInput,
  workspace: WorkspaceInstance
): Promise<ToolResult> {
  const { svg_path, scale = 1 } = input
  const output_path = input.output_path || svg_path.replace(/\.svg$/i, '.png')

  console.log(`[render-svg] Rendering ${svg_path} → ${output_path} (scale=${scale})`)

  let browser
  try {
    const svgText = await workspace.read(svg_path)
    if (!svgText) {
      return { content: `SVG file not found: ${svg_path}`, is_error: true }
    }

    if (!svgText.trim().startsWith('<svg') && !svgText.trim().startsWith('<?xml')) {
      return { content: `File does not appear to be SVG: ${svg_path}`, is_error: true }
    }

    // Extract width/height from SVG for viewport sizing
    const wMatch = svgText.match(/width="(\d+(?:\.\d+)?)"/)
    const hMatch = svgText.match(/height="(\d+(?:\.\d+)?)"/)
    const svgWidth = wMatch ? Math.ceil(parseFloat(wMatch[1])) : 1024
    const svgHeight = hMatch ? Math.ceil(parseFloat(hMatch[1])) : 768

    const viewportWidth = Math.ceil(svgWidth * scale)
    const viewportHeight = Math.ceil(svgHeight * scale)

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.setViewport({ width: viewportWidth, height: viewportHeight, deviceScaleFactor: scale })

    // Build an HTML page that renders the SVG at exact size with no margin
    const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  body { width: ${svgWidth}px; height: ${svgHeight}px; overflow: hidden; }
  body > svg { display: block; }
</style></head>
<body>${svgText}</body></html>`

    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pngBuffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: svgWidth, height: svgHeight },
      omitBackground: false,
    })

    await browser.close()
    browser = undefined

    // Puppeteer 24+ returns Uint8Array, not Buffer — must convert
    const pngBuf = Buffer.from(pngBuffer)
    const pngBase64 = pngBuf.toString('base64')
    const sizeKB = (pngBuf.length / 1024).toFixed(0)

    await workspace.write(output_path, pngBase64)

    console.log(`[render-svg] Saved ${output_path} (${svgWidth}x${svgHeight}, ${sizeKB}KB)`)

    return {
      content: `SVG rendered to PNG: ${output_path} (${svgWidth}×${svgHeight}, ${sizeKB}KB)`,
      images: [{ base64: pngBase64, mimeType: 'image/png' as const }],
    }
  } catch (err) {
    const errMsg = (err as Error).message
    console.error('[render-svg] Error:', errMsg)
    return {
      content: `RenderSvg error: ${errMsg}`,
      is_error: true,
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}
