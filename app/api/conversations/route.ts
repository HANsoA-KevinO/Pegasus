import { NextRequest, NextResponse } from 'next/server'
import { listConversations } from '@/lib/db/repository'

export async function GET() {
  try {
    const conversations = await listConversations()
    return NextResponse.json(conversations)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
