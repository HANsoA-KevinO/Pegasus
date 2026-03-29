import type { Tool } from './types'
import { SVG_NS } from './types'

let createdEl: SVGLineElement | null = null

export const lineTool: Tool = {
  name: 'line',
  cursor: 'crosshair',

  onPointerDown(e, ctx) {
    if (e.button !== 0) return
    const pos = ctx.screenToSvg(e.clientX, e.clientY)

    const line = document.createElementNS(SVG_NS, 'line') as SVGLineElement
    line.setAttribute('x1', String(pos.x))
    line.setAttribute('y1', String(pos.y))
    line.setAttribute('x2', String(pos.x))
    line.setAttribute('y2', String(pos.y))
    line.setAttribute('stroke', '#2C5F8A')
    line.setAttribute('stroke-width', '2')
    line.setAttribute('stroke-linecap', 'round')

    ctx.svgRoot.appendChild(line)
    createdEl = line
    ctx.dispatch({ type: 'SET_DRAWING', isDrawing: true, start: pos })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  },

  onPointerMove(e, ctx) {
    if (!createdEl) return
    const pos = ctx.screenToSvg(e.clientX, e.clientY)
    createdEl.setAttribute('x2', String(pos.x))
    createdEl.setAttribute('y2', String(pos.y))
  },

  onPointerUp(e, ctx) {
    if (!createdEl) return

    // If too small, remove
    const x1 = parseFloat(createdEl.getAttribute('x1') || '0')
    const y1 = parseFloat(createdEl.getAttribute('y1') || '0')
    const pos = ctx.screenToSvg(e.clientX, e.clientY)
    const dist = Math.sqrt((pos.x - x1) ** 2 + (pos.y - y1) ** 2)
    if (dist < 3) {
      createdEl.remove()
      createdEl = null
      ctx.dispatch({ type: 'SET_DRAWING', isDrawing: false, start: null })
      return
    }

    ctx.commitChanges()
    ctx.setSelectedElement(createdEl as unknown as SVGElement)
    ctx.dispatch({ type: 'SET_DRAWING', isDrawing: false, start: null })
    ctx.dispatch({ type: 'SET_TOOL', tool: 'select' })
    createdEl = null
  },

  onDeactivate() {
    if (createdEl) {
      createdEl.remove()
      createdEl = null
    }
  },
}
