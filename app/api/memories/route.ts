import { NextRequest, NextResponse } from 'next/server'
import { listMemories, createMemory } from '@/lib/db/memory-repository'
import type { MemoryType } from '@/lib/db/memory-models'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') as MemoryType | null
  const filter = type ? { type } : undefined
  const memories = await listMemories(filter)
  return NextResponse.json(memories.map(m => ({
    memory_id: m.memory_id,
    name: m.name,
    description: m.description,
    type: m.type,
    content: m.content,
    tags: m.tags,
    access_count: m.access_count,
    last_accessed_at: m.last_accessed_at,
    created_at: m.created_at,
    updated_at: m.updated_at,
  })))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, description, type, content, tags } = body as {
    name: string
    description?: string
    type: MemoryType
    content: string
    tags?: string[]
  }

  if (!name || !type || !content) {
    return NextResponse.json({ error: 'name, type, and content are required' }, { status: 400 })
  }

  const memory = await createMemory({ name, description, type, content, tags })
  return NextResponse.json({
    memory_id: memory.memory_id,
    name: memory.name,
    description: memory.description,
    type: memory.type,
    content: memory.content,
    tags: memory.tags,
  }, { status: 201 })
}
