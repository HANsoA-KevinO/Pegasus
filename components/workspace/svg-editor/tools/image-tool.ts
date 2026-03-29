import type { Tool } from './types'
import { SVG_NS, XLINK_NS } from './types'

export const imageTool: Tool = {
  name: 'image',
  cursor: 'crosshair',

  onClick(e, ctx) {
    const pos = ctx.screenToSvg(e.clientX, e.clientY)

    // Create a hidden file input and trigger it
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'

    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = () => {
        const dataUri = reader.result as string

        const imgEl = document.createElementNS(SVG_NS, 'image')
        imgEl.setAttribute('x', String(pos.x))
        imgEl.setAttribute('y', String(pos.y))
        imgEl.setAttribute('width', '120')
        imgEl.setAttribute('height', '120')
        imgEl.setAttribute('href', dataUri)
        imgEl.setAttributeNS(XLINK_NS, 'xlink:href', dataUri)
        imgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet')

        ctx.svgRoot.appendChild(imgEl)
        ctx.commitChanges()
        ctx.setSelectedElement(imgEl as unknown as SVGElement)
        ctx.dispatch({ type: 'SET_TOOL', tool: 'select' })
      }
      reader.readAsDataURL(file)
    }

    document.body.appendChild(input)
    input.click()
    document.body.removeChild(input)
  },
}
