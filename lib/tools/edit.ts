import { ToolResult } from '../types'
import { WorkspaceInstance } from '../workspace/types'

interface EditInput {
  file_path: string
  old_string: string
  new_string: string
}

export async function executeEdit(
  input: EditInput,
  workspace: WorkspaceInstance
): Promise<ToolResult> {
  const { file_path, old_string, new_string } = input

  const content = await workspace.read(file_path)
  if (content === null) {
    return { content: `File not found: ${file_path}`, is_error: true }
  }

  if (old_string === new_string) {
    return { content: 'old_string and new_string are identical', is_error: true }
  }

  const occurrences = content.split(old_string).length - 1
  if (occurrences === 0) {
    return {
      content: `old_string not found in ${file_path}. Make sure it matches exactly.`,
      is_error: true,
    }
  }
  if (occurrences > 1) {
    return {
      content: `old_string found ${occurrences} times in ${file_path}. Provide more context to make it unique.`,
      is_error: true,
    }
  }

  const newContent = content.replace(old_string, new_string)
  try {
    await workspace.write(file_path, newContent)
    return { content: `Successfully edited ${file_path}`, updatedContent: newContent }
  } catch (err) {
    return {
      content: `Failed to edit ${file_path}: ${(err as Error).message}`,
      is_error: true,
    }
  }
}
