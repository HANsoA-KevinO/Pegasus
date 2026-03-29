import { ToolResult, SkillDefinition } from '../types'
import { WorkspaceInstance } from '../workspace/types'

interface ReadInput {
  file_path: string
  offset?: number
  limit?: number
}

export async function executRead(
  input: ReadInput,
  workspace: WorkspaceInstance,
  skills: Map<string, SkillDefinition>
): Promise<ToolResult> {
  const { file_path, offset, limit } = input

  // Check if reading a skill reference file: /skills/<name>/references/<file>
  const skillRefMatch = file_path.match(/^\/skills\/([^/]+)\/references\/(.+)$/)
  if (skillRefMatch) {
    const [, skillName, refFile] = skillRefMatch
    const skill = skills.get(skillName)
    if (!skill) {
      return { content: `Skill not found: ${skillName}`, is_error: true }
    }

    // Read the reference file from disk
    const fs = await import('fs/promises')
    const path = await import('path')
    const refPath = path.join(skill.dirPath, 'references', refFile)

    try {
      const content = await fs.readFile(refPath, 'utf-8')
      return { content: formatWithLineNumbers(content, offset, limit) }
    } catch {
      return { content: `Reference file not found: ${refFile}`, is_error: true }
    }
  }

  // Otherwise read from workspace
  const content = await workspace.read(file_path)
  if (content === null) {
    return { content: `File not found: ${file_path}`, is_error: true }
  }

  // If the file is an image, return base64 in images[] field
  // so it's sent as an image content block (pixel-based token counting ~258 tokens)
  // instead of as text (~230K tokens for a typical image)
  const ext = file_path.split('.').pop()?.toLowerCase()
  const IMAGE_EXTS: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  }
  const mimeType = ext ? IMAGE_EXTS[ext] : undefined

  if (mimeType && mimeType !== 'image/svg+xml') {
    return {
      content: `[Image file: ${file_path}, ${Math.round(content.length / 1024)}KB base64]`,
      images: [{ base64: content, mimeType }],
    }
  }

  // For SVG files with embedded base64 images (post-assembly), truncate the
  // base64 data to prevent blowing up the LLM context window.
  // A typical assembled SVG can be 500KB-1MB+ due to embedded icon PNGs.
  if (ext === 'svg' && content.includes('data:image/png;base64,')) {
    const truncated = content.replace(
      /data:image\/[^;]+;base64,[A-Za-z0-9+/=]{200,}/g,
      (match) => {
        const prefix = match.slice(0, 60)
        return `${prefix}...[base64 truncated]`
      }
    )
    return { content: formatWithLineNumbers(truncated, offset, limit) }
  }

  return { content: formatWithLineNumbers(content, offset, limit) }
}

function formatWithLineNumbers(content: string, offset?: number, limit?: number): string {
  const lines = content.split('\n')
  const start = (offset ?? 1) - 1
  const end = limit ? start + limit : lines.length

  return lines
    .slice(start, end)
    .map((line, i) => `${String(start + i + 1).padStart(6)}\t${line}`)
    .join('\n')
}
