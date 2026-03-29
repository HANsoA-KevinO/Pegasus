import { ToolResult } from '../types'
import { WorkspaceInstance } from '../workspace/types'

interface GrepInput {
  pattern: string
  path?: string
}

export async function executeGrep(
  input: GrepInput,
  workspace: WorkspaceInstance
): Promise<ToolResult> {
  const { pattern, path } = input
  const regex = new RegExp(pattern, 'gi')

  const files = path ? [path] : workspace.list()
  const results: string[] = []

  for (const filePath of files) {
    const content = await workspace.read(filePath)
    if (!content) continue

    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        results.push(`${filePath}:${i + 1}: ${lines[i]}`)
      }
      regex.lastIndex = 0 // Reset regex state
    }
  }

  if (results.length === 0) {
    return { content: `No matches found for: ${pattern}` }
  }
  return { content: results.join('\n') }
}
