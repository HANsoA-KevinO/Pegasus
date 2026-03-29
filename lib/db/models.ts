import mongoose, { Schema, Document } from 'mongoose'
import { ConversationDoc } from '../types'

export interface ConversationDocument extends Omit<ConversationDoc, 'messages'>, Document {
  messages: unknown[]
}

const ConversationSchema = new Schema<ConversationDocument>(
  {
    conversation_id: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: '新对话' },
    settings: {
      orchestrator_model: { type: String, default: 'google/gemini-2.5-flash' },
      target_conference: { type: String, default: '' },
      image_size: { type: String, default: '1K' },
    },
    user_input: { type: String, default: '' },
    analysis: {
      domain_classification: { type: String, default: '' },
      logic_structure: { type: String, default: '' },
      style_guide: { type: String, default: '' },
      visual_spec: { type: String, default: '' },
    },
    output: {
      draw_prompt: { type: String, default: '' },
      image_base64: { type: String, default: '' },
      diagram_xml: { type: String, default: '' },
      // Icon extraction pipeline
      image_icons_only_base64: { type: String, default: '' },
      icons_transparent_base64: { type: String, default: '' },
      icons_manifest: { type: String, default: '' },
      diagram_svg: { type: String, default: '' },
      // Individual icon slots (1-20)
      ...Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`icon_${i + 1}_base64`, { type: String, default: '' }])
      ),
    },
    messages: { type: [Schema.Types.Mixed], default: [] },
    /** Compacted messages for API use — when non-empty, used instead of messages for LLM calls */
    compacted_messages: { type: [Schema.Types.Mixed], default: [] },
    /** Number of times compaction has been performed */
    compaction_count: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

export const Conversation =
  mongoose.models.Conversation ||
  mongoose.model<ConversationDocument>('Conversation', ConversationSchema)
