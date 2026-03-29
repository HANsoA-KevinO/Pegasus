import { ToolResult, SkillDefinition } from '../types'

interface SkillInput {
  name: string
  args?: string
}

export async function executeSkill(
  input: SkillInput,
  skills: Map<string, SkillDefinition>
): Promise<ToolResult> {
  const skill = skills.get(input.name)
  if (!skill) {
    const available = Array.from(skills.keys()).join(', ')
    return {
      content: `Skill "${input.name}" not found. Available skills: ${available}`,
      is_error: true,
    }
  }

  // Format aligned with Claude Code's Skill tool return:
  // "Launching skill" + "Base directory" + full SKILL.md content
  const argsLine = input.args ? `\n\nArguments: ${input.args}` : ''
  return {
    content: `Launching skill: ${skill.name}${argsLine}\n\nBase directory for this skill: /skills/${skill.name}\n\n${skill.body}`,
  }
}
