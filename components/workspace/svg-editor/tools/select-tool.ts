import type { Tool, ToolContext } from './types'
import { SELECTABLE_TAGS } from './types'

/** Walk up the DOM tree from `el` to find the nearest selectable SVG element */
function findSelectable(el: Element | null, boundary: Element | null): SVGElement | null {
  while (el && el !== boundary) {
    if (SELECTABLE_TAGS.has(el.tagName.toLowerCase())) {
      return el as SVGElement
    }
    el = el.parentElement
  }
  return null
}

/** Check if the target is a Moveable handle/control element */
function isMoveableElement(el: Element | null): boolean {
  while (el) {
    const cls = el.className
    if (typeof cls === 'string' && (cls.includes('moveable-') || cls.includes('rCS'))) {
      return true
    }
    el = el.parentElement
  }
  return false
}

// Pan state for background drag
let isPanning = false
let panStartX = 0
let panStartY = 0
let panStartPanX = 0
let panStartPanY = 0
let didDrag = false

export const selectTool: Tool = {
  name: 'select',
  cursor: 'default',

  onPointerDown(e, ctx) {
    if (e.button !== 0) return

    const target = e.target as Element

    // Don't intercept Moveable handle interactions (resize/rotate)
    if (isMoveableElement(target)) return

    // Don't intercept clicks on the currently selected element (let Moveable handle drag)
    if (ctx.selectedElement && (ctx.selectedElement === target || ctx.selectedElement.contains(target))) return

    // Everything else → start panning
    isPanning = true
    didDrag = false
    panStartX = e.clientX
    panStartY = e.clientY
    panStartPanX = ctx.pan.x
    panStartPanY = ctx.pan.y
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  },

  onPointerMove(e, ctx) {
    if (!isPanning) return
    didDrag = true
    ctx.dispatch({
      type: 'SET_PAN',
      pan: {
        x: panStartPanX + (e.clientX - panStartX),
        y: panStartPanY + (e.clientY - panStartY),
      },
    })
  },

  onPointerUp(e, ctx) {
    if (isPanning) {
      isPanning = false
      // If it was just a click (no drag) on background, deselect
      if (!didDrag) {
        const target = e.target as Element
        const selectable = findSelectable(target, ctx.svgRoot?.parentElement ?? null)
        if (!selectable) {
          ctx.setSelectedElement(null)
        }
      }
      return
    }
  },

  onDeactivate() {
    isPanning = false
  },
}
