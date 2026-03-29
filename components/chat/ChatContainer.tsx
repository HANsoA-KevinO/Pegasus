'use client'

import { useRef, useEffect } from 'react'
import { ChatMessage } from '@/hooks/useChat'
import { ImageAttachment } from '@/lib/types'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { NewTaskForm } from './NewTaskForm'

export interface QuotedSelection {
  path: string
  content: string
  startLine?: number
  endLine?: number
}

interface ChatContainerProps {
  messages: ChatMessage[]
  isLoading: boolean
  onSend: (message: string, images?: ImageAttachment[]) => void
  onStop: () => void
  onAnswerQuestion?: (answer: string) => void
  onConferenceChange?: (conference: string) => void
  quotedSelection?: QuotedSelection | null
  onClearQuote?: () => void
  contextUsage?: { compressible: number; threshold: number } | null
}

export function ChatContainer({
  messages,
  isLoading,
  onSend,
  onStop,
  onAnswerQuestion,
  onConferenceChange,
  quotedSelection,
  onClearQuote,
  contextUsage,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // New task form — shown when no messages yet
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-stone-200/60">
        <NewTaskForm
          onSubmit={(message, conference) => {
            if (conference) onConferenceChange?.(conference)
            onSend(message)
          }}
        />
      </div>
    )
  }

  const usagePercent = contextUsage
    ? Math.min(100, Math.round((contextUsage.compressible / contextUsage.threshold) * 100))
    : 0
  const usageColor = usagePercent > 80 ? 'bg-amber-400' : usagePercent > 60 ? 'bg-yellow-300' : 'bg-stone-300'

  return (
    <div className="flex flex-col h-full bg-white border-l border-stone-200/60">
      {/* Context usage bar */}
      {contextUsage && contextUsage.compressible > 0 && (
        <div className="flex-shrink-0 px-4 pt-2">
          <div className="flex items-center gap-2 text-[10px] text-stone-400">
            <span className="whitespace-nowrap">上下文</span>
            <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${usageColor}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <span className="whitespace-nowrap tabular-nums">
              {Math.round(contextUsage.compressible / 1000)}K / {Math.round(contextUsage.threshold / 1000)}K
            </span>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl">
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onAnswerQuestion={onAnswerQuestion}
            />
          ))}
        </div>
      </div>

      {/* Input area */}
      <ChatInput
        onSend={onSend}
        isLoading={isLoading}
        onStop={onStop}
        quotedSelection={quotedSelection}
        onClearQuote={onClearQuote}
      />
    </div>
  )
}
