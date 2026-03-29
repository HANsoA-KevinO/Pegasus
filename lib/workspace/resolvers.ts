import { ConversationDoc, ResolverRef } from '../types'

/**
 * Read a value from the conversation document using a resolver reference.
 */
export function resolveRead(
  resolver: ResolverRef,
  conversation: ConversationDoc
): string | null {
  switch (resolver.type) {
    case 'static':
      return resolver.content ?? null

    case 'field': {
      if (!resolver.field) return null
      return getNestedField(conversation, resolver.field) ?? null
    }

    case 'generated': {
      // Generated files (like images) are stored as base64 in a field
      if (!resolver.field) return null
      return getNestedField(conversation, resolver.field) ?? null
    }

    default:
      return null
  }
}

/**
 * Determine which field in the conversation document to update for a write operation.
 * Returns null if the resolver is read-only (static).
 */
export function resolveWriteField(resolver: ResolverRef): string | null {
  switch (resolver.type) {
    case 'static':
      return null // read-only
    case 'field':
    case 'generated':
      return resolver.field ?? null
    default:
      return null
  }
}

/**
 * Get a nested field from an object using dot-notation path.
 * e.g., getNestedField(obj, 'analysis.domain_classification')
 */
function getNestedField(obj: object, path: string): string | undefined {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}
