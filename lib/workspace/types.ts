import { WorkspaceDefinition, FileDeclaration, ResolverRef, ConversationDoc } from '../types'

/**
 * WorkspaceInstance wraps a conversation document and provides
 * file-system-like operations backed by MongoDB field resolvers.
 */
export interface WorkspaceInstanceOptions {
  /** Called on every write with the resolved DB field path and content.
   *  Used for immediate persistence to MongoDB. */
  onWrite?: (field: string, value: string) => Promise<void>
}

export interface WorkspaceInstance {
  /** Read a file from the workspace */
  read(path: string): Promise<string | null>

  /** Write content to a file in the workspace */
  write(path: string, content: string): Promise<void>

  /** List all files in the workspace (optionally filtered by glob pattern) */
  list(pattern?: string): string[]

  /** Check if a file exists */
  exists(path: string): boolean

  /** Get file declaration metadata */
  getFileDeclaration(path: string): FileDeclaration | undefined

  /** The underlying workspace definition */
  definition: WorkspaceDefinition
}
