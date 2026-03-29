import { ToolResult } from '../types'
import { WorkspaceInstance } from '../workspace/types'

interface GlobInput {
  pattern: string
}

export async function executeGlob(
  input: GlobInput,
  workspace: WorkspaceInstance
): Promise<ToolResult> {
  const matches = workspace.list(input.pattern)
  if (matches.length === 0) {
    return { content: `No files matched pattern: ${input.pattern}` }
  }
  return { content: matches.join('\n') }
}
