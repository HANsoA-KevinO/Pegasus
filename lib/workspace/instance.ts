import { WorkspaceDefinition, FileDeclaration, ConversationDoc } from '../types'
import { WorkspaceInstance, WorkspaceInstanceOptions } from './types'
import { resolveRead, resolveWriteField } from './resolvers'

/**
 * Create a WorkspaceInstance backed by a conversation document.
 * File reads resolve from the conversation doc via resolvers.
 * File writes are immediately persisted via the onWrite callback.
 */
export function createWorkspaceInstance(
  definition: WorkspaceDefinition,
  conversation: ConversationDoc,
  options?: WorkspaceInstanceOptions
): WorkspaceInstance {
  // In-memory cache for reads-after-writes within the same session
  const writeCache: Record<string, string> = {}

  // Build a lookup map: workspace path → FileDeclaration
  const fileMap = new Map<string, FileDeclaration>()
  for (const file of definition.files) {
    fileMap.set(normalizePath(file.path), file)
  }

  return {
    definition,

    async read(path: string): Promise<string | null> {
      const normalized = normalizePath(path)
      const decl = fileMap.get(normalized)
      if (!decl) return null

      // Check write cache first (writes during this session)
      const writeField = resolveWriteField(decl.resolver)
      if (writeField && writeCache[writeField] !== undefined) {
        return writeCache[writeField]
      }

      return resolveRead(decl.resolver, conversation)
    },

    async write(path: string, content: string): Promise<void> {
      const normalized = normalizePath(path)
      const decl = fileMap.get(normalized)

      if (!decl) {
        throw new Error(`File not declared in workspace: ${path}`)
      }

      if (decl.readOnly) {
        throw new Error(`File is read-only: ${path}`)
      }

      const field = resolveWriteField(decl.resolver)
      if (!field) {
        throw new Error(`File resolver does not support writes: ${path}`)
      }

      // Cache for subsequent reads within this session
      writeCache[field] = content

      // Immediately persist to DB via callback
      if (options?.onWrite) {
        await options.onWrite(field, content)
      }
    },

    list(pattern?: string): string[] {
      const paths = Array.from(fileMap.keys())
      if (!pattern) return paths

      // Simple glob matching: support * and **
      const regex = globToRegex(pattern)
      return paths.filter(p => regex.test(p))
    },

    exists(path: string): boolean {
      return fileMap.has(normalizePath(path))
    },

    getFileDeclaration(path: string): FileDeclaration | undefined {
      return fileMap.get(normalizePath(path))
    },
  }
}

function normalizePath(path: string): string {
  // Remove leading /workspace/ prefix if present, normalize to consistent format
  return path
    .replace(/^\/workspace\//, '')
    .replace(/^workspace\//, '')
    .replace(/\/+/g, '/')
    .replace(/^\//, '')
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*')
  return new RegExp(`^${escaped}$`)
}
