import type { Tool } from './types'
import { SVG_NS } from './types'

let createdEl: SVGLineElement | null = null

const ARROWHEAD_ID = 'svg-editor-arrowhead'

/** Ensure the SVG has an arrowhead marker definition */
function ensureArrowMarker(svgRoot: SVGSVGElement) {
  if (svgRoot.querySelector(`#${ARROWHEAD_ID}`)) return

  let defs = svgRoot.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs')
    svgRoot.insertBefore(defs, svgRoot.firstChild)
  }

  const marker = document.createElementNS(SVG_NS, 'marker')
  marker.setAttribute('id', ARROWHEAD_ID)
  marker.setAttribute('viewBox', '0 0 10 10')
  marker.setAttribute('refX', '10')
  marker.setAttribute('refY', '5')
  marker.setAttribute('markerWidth', '8')
  marker.setAttribute('markerHeight', '8')
  marker.setAttribute('orient', 'auto-start-reverse')

  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z')
  path.setAttribute('fill', '#2C5F8A')

  marker.appendChild(path)
  defs.appendChild(marker)
}

export const arrowTool: Tool = {
  name: 'arrow',
  cursor: 'crosshair',

  onPointerDown(e, ctx) {
    if (e.button !== 0) return
    const pos = ctx.screenToSvg(e.clientX, e.clientY)

    ensureArrowMarker(ctx.svgRoot)

    const line = document.createElementNS(SVG_NS, 'line') as SVGLineElement
    line.setAttribute('x1', String(pos.x))
    line.setAttribute('y1', String(pos.y))
    line.setAttribute('x2', String(pos.x))
    line.setAttribute('y2', String(pos.y))
    line.setAttribute('stroke', '#2C5F8A')
    line.setAttribute('stroke-width', '2')
    line.setAttribute('stroke-linecap', 'round')
    line.setAttribute('marker-end', `url(#${ARROWHEAD_ID})`)

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
