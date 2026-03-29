import { ToolResult } from '../types'
import { WorkspaceInstance } from '../workspace/types'

interface WriteInput {
  file_path: string
  content: string
}

export async function executeWrite(
  input: WriteInput,
  workspace: WorkspaceInstance
): Promise<ToolResult> {
  try {
    await workspace.write(input.file_path, input.content)
    return { content: `Successfully wrote to ${input.file_path}` }
  } catch (err) {
    return {
      content: `Failed to write ${input.file_path}: ${(err as Error).message}`,
      is_error: true,
    }
  }
}
