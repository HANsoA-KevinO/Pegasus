// Anthropic Messages API streaming via OpenRouter

import type { ContentBlock, TokenUsage } from '../types'

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_API_KEY = process.env.OPENROUTER_API_KEY || ''

interface AnthropicRequest {
  model: string
  max_tokens: number
  temperature?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  system: any[]
  tools: { name: string; description: string; input_schema: Record<string, unknown> }[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[]
  thinking?: { type: 'enabled'; budget_tokens: number }
}

export interface StreamResult {
  content: ContentBlock[]
  stop_reason: string
  usage: TokenUsage
}

export async function callAnthropicAPIStream(
  request: AnthropicRequest,
  baseUrl?: string,
  apiKey?: string,
  onTextDelta?: (text: string) => void,
  onToolUseStart?: (toolName: string) => void,
  onThinkingDelta?: (text: string) => void,
  onRedactedThinking?: () => void,
): Promise<StreamResult> {
  const url = `${baseUrl || DEFAULT_BASE_URL}/messages`
  const key = apiKey || DEFAULT_API_KEY
  const streamRequest = { ...request, stream: true }

  const bodyJson = JSON.stringify(streamRequest)
  console.log(`[llm-api] Sending request: model=${request.model}, messages=${request.messages.length}, bodySize=${(bodyJson.length / 1024).toFixed(0)}KB`)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://pegasus.local',
        'X-Title': 'Pegasus',
      },
      body: bodyJson,
    })
  } catch (fetchErr) {
    const cause = (fetchErr as Error).cause
    console.error('[llm-api] fetch failed. Cause:', cause ?? (fetchErr as Error).message)
    throw fetchErr
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${errText}`)
  }

  // Parse SSE stream
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  // Accumulate state — index-based Map for interleaved blocks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks = new Map<number, any>()
  const toolInputs = new Map<number, string>()
  let stopReason = 'end_turn'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let usage: any = {}

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue

      let event
      try {
        event = JSON.parse(data)
      } catch {
        continue
      }

      const idx: number = event.index ?? -1

      switch (event.type) {
        case 'message_start':
          if (event.message?.usage) {
            usage = { ...usage, ...event.message.usage }
          }
          break

        case 'content_block_start':
          if (event.content_block?.type === 'text') {
            blocks.set(idx, { type: 'text', text: '' })
          } else if (event.content_block?.type === 'tool_use') {
            blocks.set(idx, {
              type: 'tool_use',
              id: event.content_block.id,
              name: event.content_block.name,
              input: {},
            })
            toolInputs.set(idx, '')
            onToolUseStart?.(event.content_block.name)
          } else if (event.content_block?.type === 'thinking') {
            blocks.set(idx, { type: 'thinking', thinking: '', signature: '' })
          } else if (event.content_block?.type === 'redacted_thinking') {
            const blockData = event.content_block.data || ''
            // Skip OpenRouter-injected redacted_thinking (non-Anthropic native)
            if (typeof blockData === 'string' && blockData.startsWith('openrouter.reasoning:')) {
              blocks.set(idx, { type: 'redacted_thinking', data: blockData, _skip: true })
            } else {
              blocks.set(idx, { type: 'redacted_thinking', data: blockData })
              onRedactedThinking?.()
            }
          }
          break

        case 'content_block_delta': {
          const block = blocks.get(idx)
          if (!block) break

          if (event.delta?.type === 'text_delta' && block.type === 'text') {
            block.text += event.delta.text
            onTextDelta?.(event.delta.text)
          } else if (event.delta?.type === 'input_json_delta' && block.type === 'tool_use') {
            toolInputs.set(idx, (toolInputs.get(idx) || '') + event.delta.partial_json)
          } else if (event.delta?.type === 'thinking_delta' && block.type === 'thinking') {
            block.thinking += event.delta.thinking
            onThinkingDelta?.(event.delta.thinking)
          } else if (event.delta?.type === 'signature_delta') {
            if (block.type === 'thinking') {
              block.signature = (block.signature || '') + event.delta.signature
            } else if (block.type === 'redacted_thinking') {
              block.data = (block.data || '') + event.delta.signature
            }
          }
          break
        }

        case 'content_block_stop': {
          const block = blocks.get(idx)
          if (block?.type === 'tool_use') {
            const jsonStr = toolInputs.get(idx) || ''
            if (jsonStr) {
              try {
                block.input = JSON.parse(jsonStr)
              } catch {
                block.input = {}
              }
            }
          }
          break
        }

        case 'message_delta':
          if (event.delta?.stop_reason) {
            stopReason = event.delta.stop_reason
          }
          if (event.usage) {
            usage = { ...usage, ...event.usage }
          }
          break
      }
    }
  }

  // Assemble final content blocks sorted by index, filter OpenRouter-injected redacted_thinking
  const contentBlocks: ContentBlock[] = [...blocks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, block]) => block)
    .filter((block: { _skip?: boolean }) => !block._skip)

  return {
    content: contentBlocks,
    stop_reason: stopReason,
    usage: {
      input_tokens: usage.input_tokens || 0,
      output_tokens: usage.output_tokens || 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens: usage.cache_read_input_tokens || 0,
    },
  }
}
