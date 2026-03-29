import { NextRequest, NextResponse } from 'next/server'
import { getMemory, updateMemory, deleteMemory } from '@/lib/db/memory-repository'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const memory = await getMemory(id)
  if (!memory) {
    return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
  }
  return NextResponse.json({
    memory_id: memory.memory_id,
    name: memory.name,
    description: memory.description,
    type: memory.type,
    content: memory.content,
    tags: memory.tags,
    access_count: memory.access_count,
    last_accessed_at: memory.last_accessed_at,
    created_at: memory.created_at,
    updated_at: memory.updated_at,
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { name, description, type, content, tags } = body

  const updated = await updateMemory(id, {
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(type !== undefined && { type }),
    ...(content !== undefined && { content }),
    ...(tags !== undefined && { tags }),
  })

  if (!updated) {
    return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
  }

  return NextResponse.json({
    memory_id: updated.memory_id,
    name: updated.name,
    description: updated.description,
    type: updated.type,
    content: updated.content,
    tags: updated.tags,
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const deleted = await deleteMemory(id)
  if (!deleted) {
    return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
