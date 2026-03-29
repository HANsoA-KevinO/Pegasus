import type { Tool } from './types'
import type { ToolName } from '../EditorContext'
import { selectTool } from './select-tool'
import { panTool } from './pan-tool'
import { rectTool, circleTool, ellipseTool } from './shape-tool'
import { lineTool } from './line-tool'
import { arrowTool } from './arrow-tool'
import { textTool } from './text-tool'
import { imageTool } from './image-tool'

export { handleMiddlePan } from './pan-tool'
export { SELECTABLE_TAGS } from './types'

const toolMap: Record<ToolName, Tool> = {
  select: selectTool,
  pan: panTool,
  rect: rectTool,
  circle: circleTool,
  ellipse: ellipseTool,
  line: lineTool,
  arrow: arrowTool,
  text: textTool,
  image: imageTool,
}

export function getTool(name: ToolName): Tool {
  return toolMap[name]
}
