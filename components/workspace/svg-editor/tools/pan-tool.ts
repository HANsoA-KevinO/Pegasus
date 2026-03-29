import type { Tool, ToolContext } from './types'

let panStartX = 0
let panStartY = 0
let panStartPanX = 0
let panStartPanY = 0
let isPanning = false

export const panTool: Tool = {
  name: 'pan',
  cursor: 'grab',

  onPointerDown(e, ctx) {
    if (e.button !== 0) return
    isPanning = true
    panStartX = e.clientX
    panStartY = e.clientY
    panStartPanX = ctx.pan.x
    panStartPanY = ctx.pan.y
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  },

  onPointerMove(e, ctx) {
    if (!isPanning) return
    ctx.dispatch({
      type: 'SET_PAN',
      pan: {
        x: panStartPanX + (e.clientX - panStartX),
        y: panStartPanY + (e.clientY - panStartY),
      },
    })
  },

  onPointerUp() {
    isPanning = false
  },

  onDeactivate() {
    isPanning = false
  },
}

/**
 * Shared pan logic for middle-click/alt-drag in any tool mode.
 * Returns true if the event was consumed for panning.
 */
export function handleMiddlePan(
  eventType: 'down' | 'move' | 'up',
  e: React.PointerEvent,
  ctx: Pick<ToolContext, 'pan' | 'dispatch'>
): boolean {
  if (eventType === 'down') {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning = true
      panStartX = e.clientX
      panStartY = e.clientY
      panStartPanX = ctx.pan.x
      panStartPanY = ctx.pan.y
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      e.preventDefault()
      return true
    }
    return false
  }

  if (eventType === 'move' && isPanning) {
    ctx.dispatch({
      type: 'SET_PAN',
      pan: {
        x: panStartPanX + (e.clientX - panStartX),
        y: panStartPanY + (e.clientY - panStartY),
      },
    })
    return true
  }

  if (eventType === 'up' && isPanning) {
    isPanning = false
    return true
  }

  return false
}
