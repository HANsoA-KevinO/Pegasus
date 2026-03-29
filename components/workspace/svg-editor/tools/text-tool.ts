import type { Tool } from './types'
import { SVG_NS } from './types'

export const textTool: Tool = {
  name: 'text',
  cursor: 'text',

  onClick(e, ctx) {
    const pos = ctx.screenToSvg(e.clientX, e.clientY)

    const textEl = document.createElementNS(SVG_NS, 'text') as SVGTextElement
    textEl.setAttribute('x', String(pos.x))
    textEl.setAttribute('y', String(pos.y))
    textEl.setAttribute('font-family', 'Arial, sans-serif')
    textEl.setAttribute('font-size', '16')
    textEl.setAttribute('fill', '#333333')
    textEl.textContent = 'Text'

    ctx.svgRoot.appendChild(textEl)
    ctx.commitChanges()
    ctx.setSelectedElement(textEl as unknown as SVGElement)

    // Signal to open inline text editor
    ctx.dispatch({ type: 'SET_EDITING_TEXT', isEditingText: true })
    // Switch back to select after placing
    ctx.dispatch({ type: 'SET_TOOL', tool: 'select' })
  },
}
