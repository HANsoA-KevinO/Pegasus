import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Cache the model list in memory (server-side) for 10 minutes
let cachedModels: { id: string; name: string }[] | null = null
let cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000

export async function GET() {
  const now = Date.now()
  if (cachedModels && now - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedModels)
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'HTTP-Referer': 'https://pegasus.local',
      },
    })

    if (!res.ok) {
      throw new Error(`OpenRouter API error: ${res.status}`)
    }

    const data = await res.json()
    const models = (data.data ?? [])
      .map((m: { id: string; name: string }) => ({
        id: m.id,
        name: m.name,
      }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))

    cachedModels = models
    cacheTime = now

    return NextResponse.json(models)
  } catch (err) {
    console.error('[models] Failed to fetch from OpenRouter:', err)
    // Return a fallback list if the API fails
    return NextResponse.json([
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1' },
      { id: 'openai/o4-mini', name: 'o4-mini' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
    ])
  }
}
