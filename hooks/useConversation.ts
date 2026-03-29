'use client'

import { useState, useEffect, useCallback } from 'react'

interface ConversationSummary {
  conversation_id: string
  title: string
  updated_at: string
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const deleteConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.conversation_id !== id))
      }
      return res.ok
    } catch {
      return false
    }
  }, [])

  return { conversations, isLoading, refresh, deleteConversation }
}
