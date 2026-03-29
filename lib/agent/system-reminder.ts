// System Reminder — injects skill metadata and memories into user messages
// Follows Claude Code's pattern: lightweight skill index always present,
// full content loaded on-demand via Skill tool.

import type { MemoryDocument } from '../db/memory-models'

export interface SkillMetadata {
  name: string
  description: string
}

/**
 * Build a <system-reminder> block listing available skills.
 * Injected into the last user message's content array on every turn.
 */
export function buildSkillReminder(skillMetadata: SkillMetadata[]): string {
  if (skillMetadata.length === 0) return ''

  const skillList = skillMetadata
    .map(s => `- ${s.name}: ${s.description}`)
    .join('\n\n')

  return `<system-reminder>
The following skills are available for use with the Skill tool:

${skillList}
</system-reminder>`
}

const MEMORY_TYPE_LABELS: Record<string, string> = {
  user: '用户偏好',
  feedback: '反馈与修正',
  project: '项目知识',
  reference: '外部参考',
}

/**
 * Build a <system-reminder> block containing selected cross-conversation memories.
 * Injected into the last user message alongside the skill reminder.
 */
export function buildMemoryReminder(memories: MemoryDocument[]): string {
  if (memories.length === 0) return ''

  const sections = memories.map(m => {
    const label = MEMORY_TYPE_LABELS[m.type] ?? m.type
    return `### ${m.name} (${label})\n${m.content}`
  })

  return `<system-reminder>
## 跨会话记忆

以下是从之前的对话中积累的记忆，请参考这些信息来更好地服务用户。

${sections.join('\n\n---\n\n')}
</system-reminder>`
}
