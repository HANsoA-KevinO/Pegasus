'use client'

import { useState, useCallback, useRef } from 'react'
import { ModelProvider, DisplayPart, ImageAttachment } from '@/lib/types'
import { ConversationArtifactFields } from './useWorkspaceArtifacts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarizeToolAction(tool: string, input: any, displayPath: string): string {
  switch (tool) {
    case 'Read': return `读取了 ${displayPath}`
    case 'Edit': return `修改了 ${displayPath}`
    case 'Write': return `写入了 ${displayPath}`
    case 'Glob': return `搜索了文件模式 ${input?.pattern ?? ''}`
    case 'Grep': return `搜索了内容 ${input?.pattern ?? ''}`
    case 'Skill': return `加载了 Skill: ${input?.name ?? ''}`
    case 'GenerateImage': return '生成了图片'
    case 'AnalyzeImage': return `分析了图片 ${displayPath}`
    case 'WebSearch': return `搜索了 "${input?.query ?? ''}"`
    default: return `调用了 ${tool}`
  }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** User-uploaded images (for display in the chat) */
  images?: ImageAttachment[]
  parts?: DisplayPart[]
  isStreaming?: boolean
  timestamp: Date
}

interface UseChatOptions {
  model: ModelProvider
  targetConference?: string
}

/** Per-conversation cached state — lives in a ref so background SSE streams can update it */
interface CachedState {
  messages: ChatMessage[]
  dbArtifactFields: ConversationArtifactFields | null
}

export function useChat(options: UseChatOptions) {
  // === React state (what's currently displayed) ===
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [dbArtifactFields, setDbArtifactFields] = useState<ConversationArtifactFields | null>(null)
  const [runningConversationIds, setRunningConversationIds] = useState<Set<string>>(new Set())
  const [waitingForUserIds, setWaitingForUserIds] = useState<Set<string>>(new Set())
  const [contextUsage, setContextUsage] = useState<{ compressible: number; threshold: number } | null>(null)

  // === Refs (persistent, no re-renders) ===
  // Per-conversation message cache — THE source of truth for message data
  const cacheRef = useRef(new Map<string, CachedState>())
  // Per-conversation abort controllers
  const abortsRef = useRef(new Map<string, AbortController>())
  // Which conversation key is currently displayed
  const activeKeyRef = useRef<string>('_new')

  // Cache key: real conversation ID or '_new' for unsaved conversations
  const getKey = (id: string | null) => id ?? '_new'

  /** Sync a cache entry's messages to React state (only if it's the active conversation) */
  const syncToReact = (key: string) => {
    if (activeKeyRef.current !== key) return
    const cached = cacheRef.current.get(key)
    if (cached) setMessages([...cached.messages])
  }

  // ==================== sendMessage ====================

  const sendMessage = useCallback(
    async (text: string, images?: ImageAttachment[]) => {
      if (!text.trim() || isLoading) return

      // Mutable key — migrates from '_new' to real ID when server responds
      let myKey = getKey(conversationId)

      // Clear waiting-for-user state (user is responding)
      setWaitingForUserIds(prev => {
        if (!prev.has(myKey)) return prev
        const next = new Set(prev)
        next.delete(myKey)
        return next
      })

      // Initialize cache entry if missing
      if (!cacheRef.current.has(myKey)) {
        cacheRef.current.set(myKey, { messages: [], dbArtifactFields: null })
      }

      // Helper: update messages in cache (source of truth), then sync to React if active
      const updateMsgs = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
        const cached = cacheRef.current.get(myKey)
        if (!cached) return
        cached.messages = updater(cached.messages)
        syncToReact(myKey)
      }

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        images: images?.length ? images : undefined,
        timestamp: new Date(),
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        parts: [],
        isStreaming: true,
        timestamp: new Date(),
      }

      // Write initial messages directly to cache, then sync
      const cached = cacheRef.current.get(myKey)!
      cached.messages = [...cached.messages, userMsg, assistantMsg]
      cached.dbArtifactFields = null
      syncToReact(myKey)

      if (activeKeyRef.current === myKey) {
        setIsLoading(true)
        setDbArtifactFields(null)
      }

      const abortController = new AbortController()
      abortsRef.current.set(myKey, abortController)
      setRunningConversationIds(prev => new Set([...prev, myKey]))

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            message: text,
            images: images?.length ? images : undefined,
            settings: {
              orchestrator_model: options.model,
              target_conference: options.targetConference,
            },
          }),
          signal: abortController.signal,
        })

        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`HTTP ${res.status}: ${errorText}`)
        }
        if (!res.body) throw new Error('No response body')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            let data: Record<string, unknown>
            try {
              data = JSON.parse(line.slice(6))
            } catch {
              continue
            }

            const evtType = data.type as string
            if (!evtType) continue

            // Handle conversation_id from server — migrate key for new conversations
            if ((evtType === 'conversation_started' || evtType === 'done' || evtType === 'waiting_for_user') && data.conversation_id) {
              const realId = data.conversation_id as string

              if (myKey === '_new' && realId) {
                // Migrate cache entry
                const cachedEntry = cacheRef.current.get('_new')
                if (cachedEntry) {
                  cacheRef.current.set(realId, cachedEntry)
                  cacheRef.current.delete('_new')
                }
                // Migrate abort controller
                const ac = abortsRef.current.get('_new')
                if (ac) {
                  abortsRef.current.set(realId, ac)
                  abortsRef.current.delete('_new')
                }
                // Update running IDs
                setRunningConversationIds(prev => {
                  const next = new Set(prev)
                  next.delete('_new')
                  next.add(realId)
                  return next
                })
                // Update active key if still viewing this conversation
                if (activeKeyRef.current === '_new') {
                  activeKeyRef.current = realId
                }
                myKey = realId
              }

              if (activeKeyRef.current === myKey) {
                setConversationId(realId)
              }
            }

            // Track waiting-for-user state for sidebar indicator
            if (evtType === 'waiting_for_user') {
              setWaitingForUserIds(prev => new Set([...prev, myKey]))
            }

            // Token usage — update context progress bar (only for active conversation)
            if (evtType === 'token_usage' && activeKeyRef.current === myKey) {
              const total = data.total_input_tokens as number
              const overhead = data.overhead_tokens as number
              const compressible = Math.max(0, total - overhead)
              const threshold = Math.max(1, 140_000 - overhead)
              setContextUsage({ compressible, threshold })
            }

            // Process SSE event into messages
            updateMsgs(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (!last || last.role !== 'assistant') return prev

              const parts = [...(last.parts ?? [])]
              let content = last.content

              switch (evtType) {
                case 'text_delta': {
                  const text = data.text as string
                  content += text
                  const lastPart = parts[parts.length - 1]
                  if (lastPart && lastPart.type === 'text') {
                    parts[parts.length - 1] = { ...lastPart, text: lastPart.text + text }
                  } else {
                    parts.push({ type: 'text', text })
                  }
                  break
                }

                case 'tool_start': {
                  parts.push({
                    type: 'tool_call',
                    tool: data.tool as string,
                    pending: true,
                  })
                  break
                }

                case 'tool_done': {
                  for (let i = parts.length - 1; i >= 0; i--) {
                    const p = parts[i]
                    if (p.type === 'tool_call' && p.pending && p.tool === data.tool) {
                      parts[i] = {
                        ...p,
                        pending: false,
                        file_path: data.file_path as string | undefined,
                        action: data.action as string | undefined,
                        is_error: data.is_error as boolean | undefined,
                        content: data.content as string | undefined,
                      }
                      break
                    }
                  }
                  break
                }

                case 'thinking_delta': {
                  const text = data.text as string
                  const lastPart = parts[parts.length - 1]
                  if (lastPart && lastPart.type === 'thinking') {
                    parts[parts.length - 1] = { ...lastPart, text: lastPart.text + text, pending: true }
                  } else {
                    parts.push({ type: 'thinking', text, pending: true })
                  }
                  break
                }

                case 'redacted_thinking': {
                  parts.push({ type: 'redacted_thinking', pending: false })
                  break
                }

                case 'ask_user': {
                  parts.push({
                    type: 'ask_user',
                    question: data.question as string,
                    options: data.options as string[] | undefined,
                    answered: false,
                  })
                  break
                }

                case 'image': {
                  const imgJson = JSON.stringify({
                    success: true,
                    base64: data.base64,
                    mime_type: data.mime_type ?? 'image/png',
                    output_filename: data.output_filename,
                  })
                  parts.push({
                    type: 'tool_call',
                    tool: 'GenerateImage',
                    pending: false,
                    action: '生成了图片',
                    content: imgJson,
                  })
                  break
                }

                case 'done':
                case 'waiting_for_user': {
                  for (let i = 0; i < parts.length; i++) {
                    const p = parts[i]
                    if (p.type === 'thinking' && p.pending) {
                      parts[i] = { ...p, pending: false }
                    }
                  }
                  break
                }

                case 'compaction_start': {
                  parts.push({
                    type: 'tool_call',
                    tool: 'Compaction',
                    action: '正在压缩上下文...',
                    pending: true,
                  })
                  break
                }

                case 'compaction_done': {
                  // Find the pending compaction part and mark it done
                  for (let i = parts.length - 1; i >= 0; i--) {
                    const p = parts[i]
                    if (p.type === 'tool_call' && p.tool === 'Compaction' && p.pending) {
                      parts[i] = { ...p, pending: false, action: '上下文压缩完成' }
                      break
                    }
                  }
                  break
                }

                case 'error': {
                  content += `\n\n**错误**: ${data.message}`
                  break
                }
              }

              updated[updated.length - 1] = { ...last, content, parts }
              return updated
            })
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          updateMsgs(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (!last || last.role !== 'assistant') return prev
            updated[updated.length - 1] = {
              ...last,
              content: last.content + `\n\n**错误**: ${(err as Error).message}`,
            }
            return updated
          })
        }
      } finally {
        // Mark stream as finished
        updateMsgs(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (!last || last.role !== 'assistant') return prev
          updated[updated.length - 1] = { ...last, isStreaming: false }
          return updated
        })
        abortsRef.current.delete(myKey)
        setRunningConversationIds(prev => {
          const next = new Set(prev)
          next.delete(myKey)
          return next
        })
        if (activeKeyRef.current === myKey) {
          setIsLoading(false)
        }

        // Refetch conversation from DB to get complete artifact fields
        // (images from ImageProcessor, icons, etc. not available during streaming)
        if (myKey !== '_new') {
          try {
            const res = await fetch(`/api/conversations/${myKey}`)
            if (res.ok) {
              const data = await res.json()
              const cached = cacheRef.current.get(myKey)
              if (cached) {
                cached.dbArtifactFields = { analysis: data.analysis, output: data.output }
              }
              if (activeKeyRef.current === myKey) {
                setDbArtifactFields({ analysis: data.analysis, output: data.output })
              }
            }
          } catch {
            // Non-critical — artifacts will still show from streaming data
          }
        }
      }
    },
    [conversationId, isLoading, options.model, options.targetConference]
  )

  // ==================== stopGeneration ====================

  const stopGeneration = useCallback(() => {
    const key = activeKeyRef.current
    abortsRef.current.get(key)?.abort()
  }, [])

  // ==================== answerQuestion ====================

  const answerQuestion = useCallback(
    (answer: string) => {
      // Mark the ask_user part as answered — cache-first
      const key = activeKeyRef.current
      const cached = cacheRef.current.get(key)
      if (cached) {
        const updated = [...cached.messages]
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === 'assistant' && updated[i].parts) {
            const parts = [...updated[i].parts!]
            for (let j = parts.length - 1; j >= 0; j--) {
              const p = parts[j]
              if (p.type === 'ask_user' && !p.answered) {
                parts[j] = { ...p, answered: true }
                break
              }
            }
            updated[i] = { ...updated[i], parts }
            break
          }
        }
        cached.messages = updated
        syncToReact(key)
      }
      sendMessage(answer)
    },
    [sendMessage]
  )

  // ==================== loadConversation ====================

  const loadConversation = useCallback(async (id: string) => {
    const targetKey = id

    // Switch active key (cache already has current conversation's latest state — no need to save from closure)
    activeKeyRef.current = targetKey

    // Check if target has a cached state (e.g., a background-running conversation)
    const cached = cacheRef.current.get(targetKey)
    if (cached && cached.messages.length > 0) {
      setMessages([...cached.messages])
      setDbArtifactFields(cached.dbArtifactFields)
      setConversationId(id)
      setIsLoading(abortsRef.current.has(targetKey))
      return
    }

    // No cache — fetch from DB
    setMessages([])
    setIsLoading(false)
    setDbArtifactFields(null)
    setContextUsage(null)
    setConversationId(id)

    try {
      const res = await fetch(`/api/conversations/${id}`)
      if (!res.ok) return
      const data = await res.json()

      // Guard: user may have switched again while we were fetching
      if (activeKeyRef.current !== targetKey) return

      setConversationId(data.conversation_id)
      setDbArtifactFields({
        analysis: data.analysis,
        output: data.output,
      })

      // Reconstruct chat messages from DB conversation messages
      const chatMessages: ChatMessage[] = []
      const dbMessages = data.messages ?? []

      const toolUseMap = new Map<string, { name: string; input: Record<string, unknown> }>()
      for (const msg of dbMessages) {
        for (const block of msg.content ?? []) {
          if (block.type === 'tool_use') {
            toolUseMap.set(block.id, { name: block.name, input: block.input })
          }
        }
      }

      let i = 0
      while (i < dbMessages.length) {
        const msg = dbMessages[i]

        if (msg.role === 'user') {
          const hasToolResult = msg.content?.some((c: { type: string }) => c.type === 'tool_result')
          if (!hasToolResult) {
            const textContent = msg.content
              ?.filter((c: { type: string }) => c.type === 'text')
              .map((c: { text: string }) => c.text)
              .join('')
            // Extract image blocks for display
            const imageBlocks = msg.content
              ?.filter((c: { type: string }) => c.type === 'image')
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((c: any) => ({ base64: c.source.data, mimeType: c.source.media_type }))
            if (textContent || imageBlocks?.length) {
              chatMessages.push({
                id: `user-${chatMessages.length}`,
                role: 'user',
                content: textContent || '',
                images: imageBlocks?.length ? imageBlocks : undefined,
                timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
              })
            }
            i++
            continue
          }
          i++
          continue
        }

        const parts: DisplayPart[] = []
        let fullText = ''
        const startTimestamp = msg.timestamp

        while (i < dbMessages.length) {
          const cur = dbMessages[i]

          if (cur.role === 'assistant') {
            for (const block of cur.content ?? []) {
              if (block.type === 'text') {
                parts.push({ type: 'text', text: block.text })
                fullText += block.text
              } else if (block.type === 'thinking') {
                parts.push({ type: 'thinking', text: block.thinking, pending: false })
              } else if (block.type === 'redacted_thinking') {
                parts.push({ type: 'redacted_thinking', pending: false })
              } else if (block.type === 'tool_use') {
                const displayPath = (block.input?.file_path as string)?.replace(/^\/workspace\//, '') || ''
                parts.push({
                  type: 'tool_call',
                  tool: block.name,
                  file_path: block.input?.file_path as string | undefined,
                  action: summarizeToolAction(block.name, block.input, displayPath),
                  pending: false,
                })
              }
            }
            i++

            if (i < dbMessages.length && dbMessages[i].role === 'user') {
              const nextContent = dbMessages[i].content ?? []
              const isToolResult = nextContent.some((c: { type: string }) => c.type === 'tool_result')
              if (isToolResult) {
                for (const block of nextContent) {
                  if (block.type === 'tool_result' && block.is_error) {
                    const toolInfo = toolUseMap.get(block.tool_use_id)
                    if (toolInfo) {
                      for (let j = parts.length - 1; j >= 0; j--) {
                        const p = parts[j]
                        if (p.type === 'tool_call' && p.tool === toolInfo.name && !p.is_error) {
                          parts[j] = { ...p, is_error: true }
                          break
                        }
                      }
                    }
                  }
                }
                i++
                continue
              }
            }
            break
          } else {
            break
          }
        }

        chatMessages.push({
          id: `assistant-${chatMessages.length}`,
          role: 'assistant',
          content: fullText,
          parts,
          timestamp: startTimestamp ? new Date(startTimestamp) : new Date(),
        })
      }

      // Guard again after message reconstruction
      if (activeKeyRef.current !== targetKey) return

      setMessages(chatMessages)
      // Also cache the DB-loaded state
      cacheRef.current.set(targetKey, { messages: chatMessages, dbArtifactFields: { analysis: data.analysis, output: data.output } })
    } catch {
      // ignore
    }
  }, [])  // No closure dependencies — all state comes from refs

  // ==================== resetChat (new chat without page reload) ====================

  const resetChat = useCallback(() => {
    // Cache already has current conversation's latest state — no need to save from closure
    activeKeyRef.current = '_new'
    setMessages([])
    setIsLoading(false)
    setConversationId(null)
    setDbArtifactFields(null)
    setContextUsage(null)
  }, [])  // No closure dependencies

  return {
    messages,
    isLoading,
    conversationId,
    dbArtifactFields,
    runningConversationIds,
    waitingForUserIds,
    contextUsage,
    sendMessage,
    stopGeneration,
    loadConversation,
    answerQuestion,
    resetChat,
  }
}
