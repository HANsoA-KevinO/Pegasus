import { ToolResult } from '../types'

interface WebSearchInput {
  query: string
}

const SEARCH_MODEL = 'google/gemini-2.5-flash'

/**
 * Search the web using OpenRouter with Gemini model.
 * Uses OpenRouter's web search plugin for grounded results.
 */
export async function executeWebSearch(
  input: WebSearchInput
): Promise<ToolResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return { content: 'OPENROUTER_API_KEY is not set', is_error: true }
  }

  console.log(`[web-search] Query: "${input.query.slice(0, 80)}"`)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://pegasus.local',
        'X-Title': 'Pegasus',
      },
      body: JSON.stringify({
        model: SEARCH_MODEL,
        messages: [
          {
            role: 'user',
            content: input.query,
          },
        ],
        plugins: [{ id: 'web', max_results: 5 }],
        temperature: 0.5,
        max_tokens: 4096,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`OpenRouter API error ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content

    if (!text) {
      return { content: 'No search results returned', is_error: true }
    }

    console.log(`[web-search] Result: ${text.length} chars`)
    return { content: text }
  } catch (err) {
    const errMsg = (err as Error).message
    console.error('[web-search] Error:', errMsg)
    return {
      content: `Web search error: ${errMsg}`,
      is_error: true,
    }
  }
}
