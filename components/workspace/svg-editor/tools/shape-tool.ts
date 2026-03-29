import type { Tool, ToolContext } from './types'
import { SVG_NS } from './types'
import type { ToolName } from '../EditorContext'

let createdEl: SVGElement | null = null
let startX = 0
let startY = 0

function createShapeTool(shape: 'rect' | 'circle' | 'ellipse'): Tool {
  return {
    name: shape as ToolName,
    cursor: 'crosshair',

    onPointerDown(e, ctx) {
      if (e.button !== 0) return
      const pos = ctx.screenToSvg(e.clientX, e.clientY)
      startX = pos.x
      startY = pos.y

      const el = document.createElementNS(SVG_NS, shape)

      if (shape === 'rect') {
        el.setAttribute('x', String(startX))
        el.setAttribute('y', String(startY))
        el.setAttribute('width', '0')
        el.setAttribute('height', '0')
        el.setAttribute('fill', '#4A90D9')
        el.setAttribute('fill-opacity', '0.3')
        el.setAttribute('stroke', '#2C5F8A')
        el.setAttribute('stroke-width', '1.5')
      } else if (shape === 'circle') {
        el.setAttribute('cx', String(startX))
        el.setAttribute('cy', String(startY))
        el.setAttribute('r', '0')
        el.setAttribute('fill', '#4A90D9')
        el.setAttribute('fill-opacity', '0.3')
        el.setAttribute('stroke', '#2C5F8A')
        el.setAttribute('stroke-width', '1.5')
      } else if (shape === 'ellipse') {
        el.setAttribute('cx', String(startX))
        el.setAttribute('cy', String(startY))
        el.setAttribute('rx', '0')
        el.setAttribute('ry', '0')
        el.setAttribute('fill', '#4A90D9')
        el.setAttribute('fill-opacity', '0.3')
        el.setAttribute('stroke', '#2C5F8A')
        el.setAttribute('stroke-width', '1.5')
      }

      ctx.svgRoot.appendChild(el)
      createdEl = el
      ctx.dispatch({ type: 'SET_DRAWING', isDrawing: true, start: { x: startX, y: startY } })
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      e.preventDefault()
    },

    onPointerMove(e, ctx) {
      if (!createdEl) return
      const pos = ctx.screenToSvg(e.clientX, e.clientY)
      const shape = createdEl.tagName.toLowerCase()

      if (shape === 'rect') {
        const x = Math.min(startX, pos.x)
        const y = Math.min(startY, pos.y)
        const w = Math.abs(pos.x - startX)
        const h = Math.abs(pos.y - startY)
        createdEl.setAttribute('x', String(x))
        createdEl.setAttribute('y', String(y))
        createdEl.setAttribute('width', String(w))
        createdEl.setAttribute('height', String(h))
      } else if (shape === 'circle') {
        const r = Math.sqrt((pos.x - startX) ** 2 + (pos.y - startY) ** 2)
        createdEl.setAttribute('r', String(r))
      } else if (shape === 'ellipse') {
        createdEl.setAttribute('rx', String(Math.abs(pos.x - startX)))
        createdEl.setAttribute('ry', String(Math.abs(pos.y - startY)))
      }
    },

    onPointerUp(e, ctx) {
      if (!createdEl) return

      // If the shape is too small (click without drag), remove it
      const pos = ctx.screenToSvg(e.clientX, e.clientY)
      const dx = Math.abs(pos.x - startX)
      const dy = Math.abs(pos.y - startY)
      if (dx < 3 && dy < 3) {
        createdEl.remove()
        createdEl = null
        ctx.dispatch({ type: 'SET_DRAWING', isDrawing: false, start: null })
        return
      }

      ctx.commitChanges()
      ctx.setSelectedElement(createdEl)
      ctx.dispatch({ type: 'SET_DRAWING', isDrawing: false, start: null })
      // Switch back to select tool
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
}

export const rectTool = createShapeTool('rect')
export const circleTool = createShapeTool('circle')
export const ellipseTool = createShapeTool('ellipse')
