'use client'

import { useState, useRef, useCallback, KeyboardEvent, ChangeEvent } from 'react'
import { QuotedSelection } from './ChatContainer'
import { ImageAttachment } from '@/lib/types'

interface ChatInputProps {
  onSend: (message: string, images?: ImageAttachment[]) => void
  isLoading: boolean
  onStop: () => void
  quotedSelection?: QuotedSelection | null
  onClearQuote?: () => void
}

/** Max file size: 5MB (Claude's image limit) */
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export function ChatInput({ onSend, isLoading, onStop, quotedSelection, onClearQuote }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    if ((input.trim() || pendingImages.length > 0) && !isLoading) {
      let message = input.trim() || '请分析这张图片'

      // Prepend quoted selection context
      if (quotedSelection) {
        const lines = quotedSelection.startLine && quotedSelection.endLine
          ? ` lines="${quotedSelection.startLine}-${quotedSelection.endLine}"`
          : ''
        message = `<quoted-selection path="${quotedSelection.path}"${lines}>\n${quotedSelection.content}\n</quoted-selection>\n\n${message}`
        onClearQuote?.()
      }

      onSend(message, pendingImages.length > 0 ? pendingImages : undefined)
      setInput('')
      setPendingImages([])
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }
  }

  const processFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) return
    if (file.size > MAX_FILE_SIZE) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Extract base64 from data URL: "data:image/png;base64,..."
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        setPendingImages(prev => [...prev, { base64: match[2], mimeType: match[1] }])
      }
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      processFile(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) processFile(file)
      }
    }
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer?.files
    if (!files) return
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        processFile(file)
      }
    }
  }, [processFile])

  const removeImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div
      className="border-t border-gray-200 bg-white p-4"
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
    >
      <div className="mx-auto max-w-3xl">
        {/* Quoted selection preview */}
        {quotedSelection && (
          <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-blue-700">
                {quotedSelection.path}
                {quotedSelection.startLine && quotedSelection.endLine && (
                  <span className="text-blue-500 ml-1">
                    :{quotedSelection.startLine}-{quotedSelection.endLine}
                  </span>
                )}
              </span>
              <button
                onClick={onClearQuote}
                className="text-blue-400 hover:text-blue-600 transition-colors p-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-blue-600/80 line-clamp-3 whitespace-pre-wrap font-mono">
              {quotedSelection.content}
            </div>
          </div>
        )}

        {/* Pending image previews */}
        {pendingImages.length > 0 && (
          <div className="mb-2 flex gap-2 flex-wrap">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative group">
                <img
                  src={`data:${img.mimeType};base64,${img.base64}`}
                  alt={`上传图片 ${i + 1}`}
                  className="h-16 w-16 object-cover rounded-lg border border-stone-200"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-stone-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 items-end">
          {/* Image upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="rounded-xl border border-gray-300 p-3 text-stone-500 hover:text-stone-700 hover:border-stone-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="上传图片 (PNG, JPG, GIF, WebP)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onPaste={handlePaste}
            placeholder={pendingImages.length > 0 ? '描述你想要的操作...' : quotedSelection ? '描述你想要的修改...' : '描述你想要生成的科研图表...'}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              onClick={onStop}
              className="rounded-xl bg-red-500 px-4 py-3 text-sm font-medium text-white hover:bg-red-600 transition-colors"
            >
              停止
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && pendingImages.length === 0}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
