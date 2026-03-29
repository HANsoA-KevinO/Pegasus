'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { ModelProvider } from '@/lib/types'
import { useChat } from '@/hooks/useChat'
import { useWorkspaceArtifacts, buildArtifactsFromDB } from '@/hooks/useWorkspaceArtifacts'
import { ChatContainer, QuotedSelection } from '@/components/chat/ChatContainer'
import { WorkspacePanel } from '@/components/workspace/WorkspacePanel'
import { Sidebar } from '@/components/sidebar/Sidebar'

export default function Home() {
  const [model, setModel] = useState<ModelProvider>('anthropic/claude-opus-4-6')
  const [targetConference, setTargetConference] = useState('')
  const [quotedSelection, setQuotedSelection] = useState<QuotedSelection | null>(null)

  const {
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
  } = useChat({ model, targetConference })

  // Collect artifact-producing parts from ALL assistant messages (not just the latest).
  const allAssistantParts = useMemo(() => {
    const parts: typeof messages[0]['parts'] = []
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.parts) {
        parts.push(...msg.parts)
      }
    }
    return parts ?? []
  }, [messages])

  const timelineArtifacts = useWorkspaceArtifacts(allAssistantParts)

  // Build artifacts from DB fields (for loaded conversations)
  const dbArtifacts = useMemo(() => {
    if (!dbArtifactFields) return []
    return buildArtifactsFromDB(dbArtifactFields)
  }, [dbArtifactFields])

  // Prefer DB artifacts when available and richer (includes ImageProcessor results, icons, etc.)
  // During streaming, timeline artifacts are the only source; after stream ends, DB has the full picture
  const artifacts = dbArtifacts.length >= timelineArtifacts.length && dbArtifacts.length > 0
    ? dbArtifacts
    : timelineArtifacts.length > 0
      ? timelineArtifacts
      : dbArtifacts

  // Show workspace panel when there are artifacts or agent is working
  const showWorkspace = artifacts.length > 0 || isLoading

  const handleNewChat = useCallback(() => {
    resetChat()
  }, [resetChat])

  const handleDeleteConversation = useCallback((id: string) => {
    if (id === conversationId) {
      resetChat()
    }
  }, [conversationId, resetChat])

  const handleQuoteSelection = useCallback((selection: QuotedSelection) => {
    setQuotedSelection(selection)
  }, [])

  // Persist SVG editor changes to DB (debounced)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleArtifactUpdate = useCallback((path: string, content: string) => {
    if (!conversationId) return
    // Debounce DB writes
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      }).catch(console.error)
    }, 500)
  }, [conversationId])

  return (
    <div className="flex h-screen bg-stone-50/30">
      <Sidebar
        model={model}
        onModelChange={setModel}
        onSelectConversation={loadConversation}
        onDeleteConversation={handleDeleteConversation}
        onNewChat={handleNewChat}
        currentConversationId={conversationId}
        runningConversationIds={runningConversationIds}
        waitingForUserIds={waitingForUserIds}
      />

      {/* Workspace panel — left side, appears when agent produces artifacts */}
      {showWorkspace && (
        <div className="transition-all duration-300 ease-out flex-1 min-w-0 h-full overflow-hidden">
          <WorkspacePanel
            artifacts={artifacts}
            isStreaming={isLoading}
            onQuoteSelection={handleQuoteSelection}
            quotedSelection={quotedSelection}
            onArtifactUpdate={handleArtifactUpdate}
          />
        </div>
      )}

      {/* Chat panel — right side */}
      <main className={`
        flex-shrink-0 transition-all duration-300 ease-out
        ${showWorkspace ? 'w-[480px]' : 'flex-1'}
      `}>
        <ChatContainer
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
          onStop={stopGeneration}
          onAnswerQuestion={answerQuestion}
          onConferenceChange={setTargetConference}
          quotedSelection={quotedSelection}
          onClearQuote={() => setQuotedSelection(null)}
          contextUsage={contextUsage}
        />
      </main>
    </div>
  )
}
