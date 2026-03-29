import { connectDB } from './mongodb'
import { Memory, MemoryDocument, MemoryType } from './memory-models'
import { randomUUID } from 'crypto'

export async function createMemory(data: {
  name: string
  description?: string
  type: MemoryType
  content: string
  tags?: string[]
}): Promise<MemoryDocument> {
  await connectDB()
  return Memory.create({
    memory_id: randomUUID(),
    name: data.name,
    description: data.description ?? '',
    type: data.type,
    content: data.content,
    tags: data.tags ?? [],
  })
}

export async function getMemory(memoryId: string): Promise<MemoryDocument | null> {
  await connectDB()
  return Memory.findOne({ memory_id: memoryId })
}

export async function listMemories(filter?: {
  type?: MemoryType
}): Promise<MemoryDocument[]> {
  await connectDB()
  const query: Record<string, unknown> = {}
  if (filter?.type) query.type = filter.type
  return Memory.find(query).sort({ updated_at: -1 })
}

export async function updateMemory(
  memoryId: string,
  updates: Partial<Pick<MemoryDocument, 'name' | 'description' | 'type' | 'content' | 'tags'>>
): Promise<MemoryDocument | null> {
  await connectDB()
  return Memory.findOneAndUpdate(
    { memory_id: memoryId },
    { $set: updates },
    { new: true }
  )
}

export async function deleteMemory(memoryId: string): Promise<boolean> {
  await connectDB()
  const result = await Memory.deleteOne({ memory_id: memoryId })
  return result.deletedCount > 0
}

/**
 * Search memories using MongoDB text index.
 * Returns results sorted by text search relevance score.
 */
export async function searchMemories(
  query: string,
  limit = 10
): Promise<MemoryDocument[]> {
  await connectDB()
  if (!query.trim()) return listMemories()
  return Memory.find(
    { $text: { $search: query } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
}

/**
 * Increment access_count and update last_accessed_at for selected memories.
 */
export async function markMemoriesAccessed(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return
  await connectDB()
  await Memory.updateMany(
    { memory_id: { $in: memoryIds } },
    { $inc: { access_count: 1 }, $set: { last_accessed_at: new Date() } }
  )
}
