import sharp from 'sharp'
import { ToolResult } from '../types'
import { WorkspaceInstance } from '../workspace/types'

interface ImageProcessorInput {
  operation: 'remove_white_background' | 'crop' | 'detect_regions'
  image_path: string
  output_path?: string
  bbox?: { x: number; y: number; width: number; height: number }
  threshold?: number
}

export async function executeImageProcessor(
  input: ImageProcessorInput,
  workspace: WorkspaceInstance
): Promise<ToolResult> {
  const { operation, image_path, output_path, bbox, threshold = 240 } = input

  console.log(`[image-processor] ${operation} | input: ${image_path}`)

  try {
    switch (operation) {
      case 'remove_white_background':
        return await removeWhiteBackground(workspace, image_path, output_path!, threshold)
      case 'crop':
        return await cropImage(workspace, image_path, output_path!, bbox!)
      case 'detect_regions':
        return await detectRegions(workspace, image_path)
      default:
        return { content: `Unknown operation: ${operation}`, is_error: true }
    }
  } catch (err) {
    const errMsg = (err as Error).message
    console.error(`[image-processor] Error in ${operation}:`, errMsg)
    return { content: `ImageProcessor error: ${errMsg}`, is_error: true }
  }
}

// ==================== Remove White Background ====================

async function removeWhiteBackground(
  workspace: WorkspaceInstance,
  imagePath: string,
  outputPath: string,
  threshold: number
): Promise<ToolResult> {
  const base64 = await workspace.read(imagePath)
  if (!base64) {
    return { content: `File not found: ${imagePath}`, is_error: true }
  }

  const buffer = Buffer.from(base64, 'base64')
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.length)

  let transparentCount = 0
  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    if (r > threshold && g > threshold && b > threshold) {
      pixels[i + 3] = 0 // set alpha to 0
      transparentCount++
    }
  }

  const totalPixels = width * height
  const percentage = ((transparentCount / totalPixels) * 100).toFixed(1)
  console.log(`[image-processor] remove_white_bg: ${transparentCount}/${totalPixels} pixels (${percentage}%) → transparent`)

  const outputBuffer = await sharp(Buffer.from(pixels.buffer), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer()

  const outputBase64 = outputBuffer.toString('base64')
  await workspace.write(outputPath, outputBase64)

  console.log(`[image-processor] Saved to ${outputPath} (${(outputBuffer.length / 1024).toFixed(0)}KB)`)

  return {
    content: `Background removed: ${transparentCount} pixels (${percentage}%) made transparent. Saved to ${outputPath}`,
    images: [{ base64: outputBase64, mimeType: 'image/png' }],
  }
}

// ==================== Crop ====================

async function cropImage(
  workspace: WorkspaceInstance,
  imagePath: string,
  outputPath: string,
  bbox: { x: number; y: number; width: number; height: number }
): Promise<ToolResult> {
  const base64 = await workspace.read(imagePath)
  if (!base64) {
    return { content: `File not found: ${imagePath}`, is_error: true }
  }

  const buffer = Buffer.from(base64, 'base64')
  const outputBuffer = await sharp(buffer)
    .extract({
      left: Math.round(bbox.x),
      top: Math.round(bbox.y),
      width: Math.round(bbox.width),
      height: Math.round(bbox.height),
    })
    .png()
    .toBuffer()

  const outputBase64 = outputBuffer.toString('base64')
  await workspace.write(outputPath, outputBase64)

  console.log(`[image-processor] Cropped ${bbox.width}x${bbox.height} at (${bbox.x},${bbox.y}) → ${outputPath}`)

  return {
    content: `Cropped region (${bbox.x}, ${bbox.y}, ${bbox.width}x${bbox.height}) saved to ${outputPath}`,
    images: [{ base64: outputBase64, mimeType: 'image/png' }],
  }
}

// ==================== Detect Regions (Connected Component Analysis) ====================

interface Region {
  id: number
  x: number
  y: number
  width: number
  height: number
  area: number
  icon_path: string
}

async function detectRegions(
  workspace: WorkspaceInstance,
  imagePath: string
): Promise<ToolResult> {
  const base64 = await workspace.read(imagePath)
  if (!base64) {
    return { content: `File not found: ${imagePath}`, is_error: true }
  }

  const buffer = Buffer.from(base64, 'base64')
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.length)

  // Build binary foreground mask (alpha > 0)
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i++) {
    mask[i] = pixels[i * channels + 3] > 0 ? 1 : 0
  }

  // Connected component labeling via BFS (8-connectivity)
  const labels = new Int32Array(width * height)
  let nextLabel = 1
  const offsets = [-1, 0, 1, -1, 1, -1, 0, 1]
  const offsetsY = [-1, -1, -1, 0, 0, 1, 1, 1]

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = py * width + px
      if (mask[idx] === 0 || labels[idx] !== 0) continue

      const label = nextLabel++
      const queue: number[] = [idx]
      labels[idx] = label

      while (queue.length > 0) {
        const ci = queue.pop()!
        const cx = ci % width
        const cy = (ci - cx) / width

        for (let d = 0; d < 8; d++) {
          const nx = cx + offsets[d]
          const ny = cy + offsetsY[d]
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const ni = ny * width + nx
          if (mask[ni] === 1 && labels[ni] === 0) {
            labels[ni] = label
            queue.push(ni)
          }
        }
      }
    }
  }

  // Scan labels to build bounding boxes for each component
  const components = new Map<number, { minX: number; minY: number; maxX: number; maxY: number; area: number }>()
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const label = labels[py * width + px]
      if (label === 0) continue
      const c = components.get(label)
      if (!c) {
        components.set(label, { minX: px, minY: py, maxX: px, maxY: py, area: 1 })
      } else {
        if (px < c.minX) c.minX = px
        if (px > c.maxX) c.maxX = px
        if (py < c.minY) c.minY = py
        if (py > c.maxY) c.maxY = py
        c.area++
      }
    }
  }

  // Filter small regions (noise) and build sorted output
  const MIN_AREA = 100
  const regions: Region[] = []
  let regionId = 1

  const sortedComponents = Array.from(components.entries())
    .filter(([, c]) => c.area >= MIN_AREA)
    .sort(([, a], [, b]) => {
      // Sort top-to-bottom, then left-to-right
      const rowA = Math.floor(a.minY / 50) // group by ~50px rows
      const rowB = Math.floor(b.minY / 50)
      if (rowA !== rowB) return rowA - rowB
      return a.minX - b.minX
    })

  for (const [, c] of sortedComponents) {
    const padding = 2
    const rx = Math.max(0, c.minX - padding)
    const ry = Math.max(0, c.minY - padding)
    const rw = Math.min(width, c.maxX + padding + 1) - rx
    const rh = Math.min(height, c.maxY + padding + 1) - ry

    regions.push({
      id: regionId,
      x: rx,
      y: ry,
      width: rw,
      height: rh,
      area: c.area,
      icon_path: `output/icons/icon_${regionId}.png`,
    })
    regionId++
  }

  console.log(`[image-processor] detect_regions: ${components.size} components found, ${regions.length} after filtering (min area: ${MIN_AREA})`)
  for (const r of regions) {
    console.log(`  icon_${r.id}: (${r.x}, ${r.y}) ${r.width}x${r.height} area=${r.area}`)
  }

  // Write manifest
  const manifest = { image_size: { width, height }, regions }
  await workspace.write('output/icons/manifest.json', JSON.stringify(manifest, null, 2))

  return {
    content: JSON.stringify(manifest, null, 2),
  }
}
