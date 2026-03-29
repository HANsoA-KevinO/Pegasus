import { connectDB } from './mongodb'
import { Conversation, ConversationDocument } from './models'
import { ConversationDoc, ConversationMessage } from '../types'
import { randomUUID } from 'crypto'

export async function createConversation(
  settings?: Partial<ConversationDoc['settings']>
): Promise<ConversationDocument> {
  await connectDB()
  const doc = await Conversation.create({
    conversation_id: randomUUID(),
    settings: {
      orchestrator_model: settings?.orchestrator_model ?? 'anthropic/claude-opus-4-6',
      target_conference: settings?.target_conference ?? '',
      image_size: settings?.image_size ?? '1K',
    },
  })
  return doc
}

export async function getConversation(
  conversationId: string
): Promise<ConversationDocument | null> {
  await connectDB()
  return Conversation.findOne({ conversation_id: conversationId })
}

export async function listConversations(): Promise<ConversationDocument[]> {
  await connectDB()
  return Conversation.find()
    .select('conversation_id title settings created_at updated_at')
    .sort({ updated_at: -1 })
    .limit(50)
}

export async function updateConversationFields(
  conversationId: string,
  fields: Record<string, string>
): Promise<void> {
  await connectDB()
  const update: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    update[key] = value
  }
  await Conversation.updateOne({ conversation_id: conversationId }, { $set: update })
}

export async function appendMessages(
  conversationId: string,
  messages: ConversationMessage[]
): Promise<void> {
  await connectDB()
  await Conversation.updateOne(
    { conversation_id: conversationId },
    { $push: { messages: { $each: messages } } }
  )
}

export async function deleteConversation(
  conversationId: string
): Promise<boolean> {
  await connectDB()
  const result = await Conversation.deleteOne({ conversation_id: conversationId })
  return result.deletedCount > 0
}

export async function updateTitle(
  conversationId: string,
  title: string
): Promise<void> {
  await connectDB()
  await Conversation.updateOne(
    { conversation_id: conversationId },
    { $set: { title } }
  )
}

/**
 * Replace compacted messages and increment compaction count.
 * compacted_messages is used instead of messages for LLM API calls.
 */
export async function replaceCompactedMessages(
  conversationId: string,
  compactedMessages: ConversationMessage[]
): Promise<void> {
  await connectDB()
  await Conversation.updateOne(
    { conversation_id: conversationId },
    {
      $set: { compacted_messages: compactedMessages },
      $inc: { compaction_count: 1 },
    }
  )
}
