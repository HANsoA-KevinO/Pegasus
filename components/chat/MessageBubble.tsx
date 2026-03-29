'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatMessage } from '@/hooks/useChat'
import { DisplayPart } from '@/lib/types'

// ==================== Dot Color ====================

function dotColor(part: DisplayPart): string {
  if (part.type === 'text') return 'bg-stone-400'
  if (part.type === 'thinking') {
    if (part.pending) return 'bg-amber-400 animate-pulse'
    return 'bg-amber-300'
  }
  if (part.type === 'redacted_thinking') return 'bg-purple-300'
  if (part.type === 'ask_user') {
    return part.answered ? 'bg-emerald-500' : 'bg-violet-500 animate-pulse'
  }
  if (part.type === 'tool_call') {
    if (part.pending) return 'bg-blue-400 animate-pulse'
    if (part.is_error) return 'bg-red-500'
    return 'bg-emerald-500'
  }
  return 'bg-stone-400'
}

// ==================== Thinking Part View ====================

function ThinkingPartView({ part }: { part: { type: 'thinking'; text: string; pending?: boolean } }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] font-mono py-0.5 text-amber-600 hover:text-amber-700 transition-colors"
      >
        {part.pending ? (
          <svg className="animate-spin h-2.5 w-2.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : expanded ? (
          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        ) : (
          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
        <span>{part.pending ? '思考中...' : '思考过程'}</span>
        {!part.pending && (
          <span className="text-stone-400">({part.text.length} chars)</span>
        )}
      </button>
      {(expanded || part.pending) && (
        <div className="mt-1 max-h-48 overflow-y-auto rounded bg-amber-50 border border-amber-100 px-2 py-1.5">
          <div className="text-[11px] text-stone-500 italic leading-relaxed whitespace-pre-wrap font-mono">
            {part.text}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== AskUser Part View ====================

function AskUserPartView({
  part,
  onAnswer,
}: {
  part: { type: 'ask_user'; question: string; options?: string[]; answered?: boolean }
  onAnswer?: (answer: string) => void
}) {
  const [customInput, setCustomInput] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  if (part.answered) {
    return (
      <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
        <p className="text-xs text-stone-500">
          <span className="text-violet-600 font-medium">提问</span>：{part.question}
        </p>
        <p className="text-[10px] text-stone-400 mt-0.5">已回答</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2.5 space-y-2">
      <p className="text-sm text-stone-700 font-medium">{part.question}</p>

      {/* Option buttons */}
      {part.options && part.options.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {part.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => onAnswer?.(opt)}
              className="text-left text-xs px-3 py-2 rounded-md border border-violet-200 bg-white hover:border-violet-400 hover:bg-violet-50 transition-colors text-stone-700"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Custom input toggle + field */}
      {!showCustom ? (
        <button
          onClick={() => setShowCustom(true)}
          className="text-[11px] text-violet-500 hover:text-violet-700 transition-colors"
        >
          自定义回答...
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && customInput.trim()) {
                onAnswer?.(customInput.trim())
              }
            }}
            placeholder="输入你的回答..."
            className="flex-1 text-xs px-3 py-1.5 rounded-md border border-violet-200 bg-white focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-300"
            autoFocus
          />
          <button
            onClick={() => {
              if (customInput.trim()) onAnswer?.(customInput.trim())
            }}
            disabled={!customInput.trim()}
            className="text-xs px-3 py-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors"
          >
            发送
          </button>
        </div>
      )}
    </div>
  )
}

// ==================== Message Bubble ====================

interface MessageBubbleProps {
  message: ChatMessage
  onAnswerQuestion?: (answer: string) => void
}

export function MessageBubble({ message, onAnswerQuestion }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="mb-4 flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-[11px] font-semibold">U</span>
        </div>
        <div className="flex-1 min-w-0">
          {/* User-uploaded images */}
          {message.images && message.images.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {message.images.map((img, i) => (
                <img
                  key={i}
                  src={`data:${img.mimeType};base64,${img.base64}`}
                  alt={`用户图片 ${i + 1}`}
                  className="max-h-48 max-w-xs rounded-lg border border-stone-200 object-contain"
                />
              ))}
            </div>
          )}
          <div className="text-sm text-stone-800 whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    )
  }

  const parts = message.parts ?? []

  // Fallback: if no parts but has content, show just the text
  if (parts.length === 0 && message.content) {
    return (
      <div className="mb-5 flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-[11px] font-semibold">A</span>
        </div>
        <div className="flex-1 min-w-0">
          {message.isStreaming && (
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-xs text-stone-500">等待响应...</span>
            </div>
          )}
          <div className="prose prose-sm prose-stone max-w-none leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-white text-[11px] font-semibold">A</span>
      </div>
      <div className="flex-1 min-w-0">
        {/* Streaming indicator when no parts yet */}
        {message.isStreaming && parts.length === 0 && (
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="text-xs text-stone-500">等待响应...</span>
          </div>
        )}

        {/* Timeline parts with dots and connecting lines */}
        <div className="relative pl-4">
          {parts.map((part, i) => (
            <div key={i} className="relative pb-2 last:pb-0">
              {/* Vertical connecting line */}
              {i < parts.length - 1 && (
                <div className="absolute left-[-10px] top-[14px] bottom-0 w-px bg-stone-200" />
              )}
              {/* Dot */}
              <div className={`absolute left-[-13px] top-1.5 w-[7px] h-[7px] rounded-full ${dotColor(part)}`} />

              {part.type === 'text' ? (
                <div className="prose prose-sm prose-stone max-w-none leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {part.text}
                  </ReactMarkdown>
                </div>
              ) : part.type === 'thinking' ? (
                <ThinkingPartView part={part} />
              ) : part.type === 'redacted_thinking' ? (
                <div className="flex items-center gap-1.5 text-[10px] font-mono py-0.5 text-purple-400">
                  <span>加密思考内容 (signature)</span>
                </div>
              ) : part.type === 'ask_user' ? (
                <AskUserPartView part={part} onAnswer={onAnswerQuestion} />
              ) : part.type === 'image' ? (
                <img
                  src={`data:${part.mimeType};base64,${part.base64}`}
                  alt="生成的图片"
                  className="max-h-48 max-w-xs rounded-lg border border-stone-200 object-contain"
                />
              ) : (
                // tool_call
                <div className="flex items-center gap-1.5 text-[10px] font-mono py-0.5">
                  {part.pending && (
                    <svg className="animate-spin h-2.5 w-2.5 text-blue-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {part.pending ? (
                    <>
                      <span className="text-stone-500">{part.tool}</span>
                      <span className="text-blue-500">{part.file_path?.split('/').pop() || ''}</span>
                    </>
                  ) : (
                    <span className={part.is_error ? 'text-red-500' : 'text-stone-500'}>
                      {part.action || `${part.tool} ${part.file_path?.split('/').pop() || ''}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
