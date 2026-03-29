import type { Dispatch } from 'react'
import type { EditorAction, ToolName } from '../EditorContext'

export interface ToolContext {
  svgRoot: SVGSVGElement
  zoom: number
  pan: { x: number; y: number }
  selectedElement: SVGElement | null
  screenToSvg: (clientX: number, clientY: number) => { x: number; y: number }
  commitChanges: () => void
  setSelectedElement: (el: SVGElement | null) => void
  dispatch: Dispatch<EditorAction>
}

export interface Tool {
  name: ToolName
  cursor: string
  onPointerDown?(e: React.PointerEvent, ctx: ToolContext): void
  onPointerMove?(e: React.PointerEvent, ctx: ToolContext): void
  onPointerUp?(e: React.PointerEvent, ctx: ToolContext): void
  onClick?(e: React.MouseEvent, ctx: ToolContext): void
  /** Called when tool is deactivated */
  onDeactivate?(): void
}

/** SVG namespace — required for creating SVG elements programmatically */
export const SVG_NS = 'http://www.w3.org/2000/svg'
export const XLINK_NS = 'http://www.w3.org/1999/xlink'

/** Tags we allow the user to select / manipulate */
export const SELECTABLE_TAGS = new Set([
  'rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline',
  'text', 'image', 'g', 'use',
])
